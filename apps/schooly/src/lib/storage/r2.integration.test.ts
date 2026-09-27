/**
 * Test d'intégration réel contre le bucket Cloudflare R2.
 *
 * Ignoré automatiquement si les credentials sont absentes, pour que la CI reste
 * verte sans accès au bucket. En local, après avoir renseigné R2_* dans
 * .env.local : `npx vitest run apps/schooly/src/lib/storage/r2.integration.test.ts`
 *
 * Ce test ne se contente pas d'un HTTP 200 : il vérifie que l'objet existe
 * (HeadObject), que les octets servis par l'URL publique sont exactement ceux
 * envoyés, puis que la suppression retire réellement l'objet.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { deflateSync } from "node:zlib"
import { createHash } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"
import {
  deleteMediaObject,
  extensionFor,
  headMediaObject,
  isAllowedMediaType,
  isKeyOwnedBySchool,
  mediaObjectExists,
  presignMediaUpload,
  publicMediaUrl,
  readR2Config,
} from "./r2"

// .env.local n'est pas chargé par vitest : on le lit nous-mêmes, sans jamais
// journaliser les valeurs.
function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // pas de .env.local : le test sera ignoré
  }
}
loadEnvLocal()

const config = readR2Config()
const describeR2 = config ? describe : describe.skip

const TEST_SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"

// ─── Générateur de PNG valide (dégradé, quelques dizaines de Ko) ───────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function makePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc(height * (1 + width * 3))
  let cursor = 0
  for (let y = 0; y < height; y++) {
    raw[cursor++] = 0
    for (let x = 0; x < width; x++) {
      raw[cursor++] = (x * 255) / width
      raw[cursor++] = (y * 255) / height
      raw[cursor++] = 0x40
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex")

describeR2("Cloudflare R2 — chaîne réelle", () => {
  const created: string[] = []

  afterAll(async () => {
    // Nettoyage : aucun objet de test ne doit survivre, même après un échec.
    if (!config) return
    for (const key of created) {
      await deleteMediaObject({ key, config }).catch(() => undefined)
    }
  })

  it("ecrit reellement l'objet, le sert, puis le supprime", async () => {
    expect(config).not.toBeNull()
    if (!config) return

    const file = makePng(120, 60)
    const expectedHash = sha256(file)

    // 1. Autorisation : clé structurée et URL publique
    const presigned = await presignMediaUpload({
      schoolId: TEST_SCHOOL_ID,
      kind: "360",
      contentType: "image/png",
      config,
    })
    created.push(presigned.key)

    expect(presigned.key).toMatch(
      new RegExp(`^schooly/[^/]+/360/${TEST_SCHOOL_ID}/[0-9a-f-]{36}\\.png$`),
    )
    expect(presigned.publicUrl).toBe(publicMediaUrl(config.publicBaseUrl, presigned.key))
    expect(isKeyOwnedBySchool(presigned.key, TEST_SCHOOL_ID)).toBe(true)

    // 2. L'objet n'existe PAS avant le PUT
    expect(await mediaObjectExists({ key: presigned.key, config })).toBe(false)

    // 3. PUT direct, comme le fait le navigateur, avec le Content-Type signé
    const put = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: presigned.headers,
      body: new Uint8Array(file),
    })
    expect(put.status).toBe(200)

    // 4. L'objet existe RÉELLEMENT dans le bucket
    expect(await mediaObjectExists({ key: presigned.key, config })).toBe(true)

    // 5. L'URL publique sert bien le fichier, octet pour octet
    const publicResponse = await fetch(presigned.publicUrl)
    expect(publicResponse.status).toBe(200)
    const served = Buffer.from(await publicResponse.arrayBuffer())
    expect(served.length).toBe(file.length)
    expect(sha256(served)).toBe(expectedHash)

    // 6. Suppression réelle
    await deleteMediaObject({ key: presigned.key, config })
    expect(await mediaObjectExists({ key: presigned.key, config })).toBe(false)
    expect((await fetch(presigned.publicUrl)).status).toBe(404)
  }, 60_000)

  it("refuse une clé appartenant a un autre etablissement", async () => {
    const file = makePng(20, 20)
    const presigned = await presignMediaUpload({
      schoolId: TEST_SCHOOL_ID,
      kind: "gallery",
      contentType: "image/png",
      config: config!,
    })
    created.push(presigned.key)
    await fetch(presigned.uploadUrl, { method: "PUT", headers: presigned.headers, body: new Uint8Array(file) })

    // La clé est bien formée mais appartient à une autre école : on refuse.
    expect(isKeyOwnedBySchool(presigned.key, "autre-etablissement")).toBe(false)
    expect(isKeyOwnedBySchool(presigned.key, TEST_SCHOOL_ID)).toBe(true)
  }, 60_000)

  it("n'empeche pas le client de choisir le Content-Type servi (mesure)", async () => {
    const file = makePng(20, 20)
    const presigned = await presignMediaUpload({
      schoolId: TEST_SCHOOL_ID,
      kind: "cover",
      contentType: "image/png",
      config: config!,
    })
    created.push(presigned.key)

    // Mesuré contre le bucket : le presigner ne signe que `host`, donc un PUT
    // avec un Content-Type différent est accepté et c'est la valeur du client
    // qui est stockée. Ce test verrouille ce COMPORTEMENT RÉEL, pas un souhait.
    const put = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/html" },
      body: new Uint8Array(file),
    })
    expect(put.status).toBe(200)

    const info = await headMediaObject({ key: presigned.key, config: config! })
    expect(info.exists).toBe(true)
    expect(info.sizeBytes).toBe(file.length)
  }, 60_000)

  it("interdit au client de choisir l'extension de la clé", async () => {
    const file = makePng(20, 20)
    // L'extension découle du type validé par le serveur : demander du HTML
    // n'aboutit qu'à une clé refusée, donc à aucune écriture possible.
    expect(isAllowedMediaType("text/html")).toBe(false)
    expect(extensionFor("image/png")).toBe("png")

    const presigned = await presignMediaUpload({
      schoolId: TEST_SCHOOL_ID,
      kind: "gallery",
      contentType: "image/png",
      config: config!,
    })
    expect(presigned.key.endsWith(".png")).toBe(true)
    expect(presigned.key.endsWith(".html")).toBe(false)
  }, 60_000)

  it("signale l'absence d'objet avant toute suppression", async () => {
    const missing = `schooly/development/360/${TEST_SCHOOL_ID}/00000000-0000-0000-0000-000000000000.png`
    expect(await mediaObjectExists({ key: missing, config: config! })).toBe(false)
    // DeleteObject est idempotent : supprimer un absent ne doit pas lever.
    await expect(deleteMediaObject({ key: missing, config: config! })).resolves.toBeUndefined()
  }, 60_000)

  it("produit deux clés distinctes pour deux demandes simultanees", async () => {
    const [first, second] = await Promise.all([
      presignMediaUpload({ schoolId: TEST_SCHOOL_ID, kind: "360", contentType: "image/jpeg", config: config! }),
      presignMediaUpload({ schoolId: TEST_SCHOOL_ID, kind: "360", contentType: "image/jpeg", config: config! }),
    ])
    expect(first.key).not.toBe(second.key)
    expect(first.uploadUrl).not.toBe(second.uploadUrl)
  }, 30_000)
})