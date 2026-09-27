import { afterEach, describe, expect, it } from "vitest"
import {
  buildMediaKey,
  extensionFor,
  isAllowedMediaType,
  isKeyOwnedBySchool,
  mediaEnvironment,
  parseMediaKey,
  publicMediaUrl,
  r2KeyFromPublicUrl,
  readR2Config,
} from "./r2"

const R2_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const

afterEach(() => {
  for (const name of R2_VARS) delete process.env[name]
})

describe("isAllowedMediaType", () => {
  it("accepte les trois formats d'image publiés", () => {
    expect(isAllowedMediaType("image/jpeg")).toBe(true)
    expect(isAllowedMediaType("image/png")).toBe(true)
    expect(isAllowedMediaType("image/webp")).toBe(true)
  })

  it("refuse tout le reste, y compris les types non texte", () => {
    // Un SVG passe le `Content-Type` du navigateur mais est du XML scripté :
    // c'est le vecteur XSS classique d'un upload d'image.
    expect(isAllowedMediaType("image/svg+xml")).toBe(false)
    expect(isAllowedMediaType("image/gif")).toBe(false)
    expect(isAllowedMediaType("application/pdf")).toBe(false)
    expect(isAllowedMediaType("text/html")).toBe(false)
    expect(isAllowedMediaType("")).toBe(false)
    expect(isAllowedMediaType(undefined)).toBe(false)
    expect(isAllowedMediaType(null)).toBe(false)
    expect(isAllowedMediaType(42)).toBe(false)
  })
})

describe("extensionFor", () => {
  it("déduit l'extension du type MIME, jamais du nom d'origine", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg")
    expect(extensionFor("image/png")).toBe("png")
    expect(extensionFor("image/webp")).toBe("webp")
  })

  it("retombe sur une extension neutre pour un type inconnu", () => {
    expect(extensionFor("application/x-exe")).toBe("bin")
  })
})

describe("buildMediaKey", () => {
  it("range l'objet sous schooly/{environnement}/360/{etablissement}/{uuid}", () => {
    const key = buildMediaKey("school-1", "360", "image/jpeg", "production")
    expect(key).toBe(
      `schooly/production/360/school-1/${key.split("/").at(-1)}`,
    )
    expect(key).toMatch(/^schooly\/production\/360\/school-1\/[0-9a-f-]{36}\.jpg$/)
  })

  it("isole la visite 360 de la galerie classique", () => {
    const panorama = buildMediaKey("s1", "360", "image/jpeg", "production")
    const gallery = buildMediaKey("s1", "gallery", "image/jpeg", "production")
    expect(panorama).toContain("/360/")
    expect(gallery).toContain("/photos/gallery/")
    expect(panorama).not.toBe(gallery)
  })

  it("n'utilise jamais le nom de fichier d'origine comme identifiant", () => {
    // Deux users envoyant « 360.jpg » ne peuvent pas se marcher dessus.
    const a = buildMediaKey("s1", "360", "image/jpeg", "production")
    const b = buildMediaKey("s1", "360", "image/jpeg", "production")
    expect(a).not.toBe(b)
  })
})

describe("mediaEnvironment", () => {
  const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV

  afterEach(() => {
    if (ORIGINAL_VERCEL_ENV === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV
  })

  it("sépare la production d'une prévisualisation Vercel", () => {
    // Sans cette séparation, une prévisualisation écrirait dans le préfixe de
    // la production et les deux environnements se pollueraient.
    process.env.VERCEL_ENV = "production"
    expect(mediaEnvironment()).toBe("production")
    process.env.VERCEL_ENV = "preview"
    expect(mediaEnvironment()).toBe("staging")
  })

  it("retombe sur development hors Vercel", () => {
    // NODE_ENV est en lecture seule dans les types : on vérifie seulement
    // qu'hors Vercel l'environnement ne retombe jamais sur « staging ».
    delete process.env.VERCEL_ENV
    expect(mediaEnvironment()).not.toBe("staging")
  })
})

describe("parseMediaKey", () => {
  it("découpe une clé Schooly valide", () => {
    const parsed = parseMediaKey("schooly/production/360/s1/8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f.jpg")
    expect(parsed).toEqual({
      environment: "production",
      group: "360",
      schoolId: "s1",
      mediaId: "8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
      extension: "jpg",
    })
  })

  it("refuse toute clé hors de la structure Schooly", () => {
    // Un objet écrit par un autre outil dans le même bucket ne doit jamais
    // pouvoir être traité comme un média Schooly.
    expect(parseMediaKey("autre/photo.jpg")).toBeNull()
    expect(parseMediaKey("schooly/production/s1/x.jpg")).toBeNull()
    expect(parseMediaKey("schooly/production/360/s1/sans-extension")).toBeNull()
    expect(parseMediaKey("schooly//360/s1/x.jpg")).toBeNull()
    expect(parseMediaKey("")).toBeNull()
  })
})

describe("isKeyOwnedBySchool", () => {
  it("accepte la clé de son propre établissement", () => {
    expect(isKeyOwnedBySchool("schooly/production/360/s1/abc.jpg", "s1")).toBe(true)
  })

  it("refuse une clé d'un autre établissement, même bien formée", () => {
    expect(isKeyOwnedBySchool("schooly/production/360/s2/abc.jpg", "s1")).toBe(false)
  })

  it("ne peut pas être trompé par un identifiant glissé dans un segment", () => {
    // "s1" ne doit pas matcher un segment qui commence par s1 mais n'est pas
    // exactement s1 : la comparaison est faite segment par segment.
    expect(isKeyOwnedBySchool("schooly/production/360/s1-bis/abc.jpg", "s1")).toBe(false)
    expect(isKeyOwnedBySchool("evil/s1/x/y.jpg", "s1")).toBe(false)
  })
})

describe("r2KeyFromPublicUrl", () => {
  it("retrouve la clé derrière une URL de notre base publique", () => {
    const base = "https://pub-86f196c5781c428caf42be75e4cce653.r2.dev"
    expect(r2KeyFromPublicUrl(base, `${base}/schooly/production/360/s1/abc.jpg`)).toBe(
      "schooly/production/360/s1/abc.jpg",
    )
  })

  it("refuse une URL héritée d'un autre stockage", () => {
    // Ancienne URL Supabase Storage : on refuse de la dérouter vers R2 plutôt
    // que d'inventer une clé qui n'existe pas.
    const supabaseUrl = "https://abc.supabase.co/storage/v1/object/public/trouvetou-media/s1/cover/x.jpg"
    expect(r2KeyFromPublicUrl("https://pub-86f196c5781c428caf42be75e4cce653.r2.dev", supabaseUrl)).toBeNull()
  })

  it("refuse la base publique elle-même et un préfixe partiel", () => {
    const base = "https://pub-86f196c5781c428caf42be75e4cce653.r2.dev"
    expect(r2KeyFromPublicUrl(base, base)).toBeNull()
    expect(r2KeyFromPublicUrl(base, `${base}evil/x.jpg`)).toBeNull()
  })
})

describe("publicMediaUrl", () => {
  it("joint la base publique et le chemin sans double barre", () => {
    expect(publicMediaUrl("https://media.exemple.ci", "s1/cover/a.jpg")).toBe(
      "https://media.exemple.ci/s1/cover/a.jpg",
    )
    expect(publicMediaUrl("https://media.exemple.ci/", "s1/cover/a.jpg")).toBe(
      "https://media.exemple.ci/s1/cover/a.jpg",
    )
    expect(publicMediaUrl("https://media.exemple.ci///", "s1/cover/a.jpg")).toBe(
      "https://media.exemple.ci/s1/cover/a.jpg",
    )
  })
})

describe("readR2Config", () => {
  it("renvoie null tant qu'une variable manque", () => {
    expect(readR2Config()).toBeNull()
    process.env.R2_ACCOUNT_ID = "acct"
    expect(readR2Config()).toBeNull()
  })

  it("ignore les valeurs vides ou uniquement blanches", () => {
    process.env.R2_ACCOUNT_ID = "acct"
    process.env.R2_ACCESS_KEY_ID = "key"
    process.env.R2_SECRET_ACCESS_KEY = "secret"
    process.env.R2_BUCKET = "medias"
    process.env.R2_PUBLIC_URL = "   "
    expect(readR2Config()).toBeNull()
  })

  it("compose l'endpoint S3 officiel de R2 a partir de l'account id", () => {
    process.env.R2_ACCOUNT_ID = "fe6f046166fb1f4f7ed1bc7088d89095"
    process.env.R2_ACCESS_KEY_ID = "key"
    process.env.R2_SECRET_ACCESS_KEY = "secret"
    process.env.R2_BUCKET = "schooly-media"
    process.env.R2_PUBLIC_URL = "https://pub-86f196c5781c428caf42be75e4cce653.r2.dev"
    const config = readR2Config()
    expect(config).not.toBeNull()
    // cloudflarestorage.com est l'endpoint S3 de R2 ; cloudflarest.com ne
    // l'est pas et toutes les signatures seraient refusees.
    expect(config?.endpoint).toBe("https://fe6f046166fb1f4f7ed1bc7088d89095.r2.cloudflarestorage.com")
    expect(config?.bucket).toBe("schooly-media")
  })

  it("laisse R2_S3_ENDPOINT prendre le pas pour un emulateur local", () => {
    process.env.R2_ACCOUNT_ID = "acct"
    process.env.R2_ACCESS_KEY_ID = "key"
    process.env.R2_SECRET_ACCESS_KEY = "secret"
    process.env.R2_BUCKET = "schooly-media"
    process.env.R2_PUBLIC_URL = "http://localhost:9000"
    process.env.R2_S3_ENDPOINT = "http://127.0.0.1:9000"
    try {
      expect(readR2Config()?.endpoint).toBe("http://127.0.0.1:9000")
    } finally {
      delete process.env.R2_S3_ENDPOINT
    }
  })
})