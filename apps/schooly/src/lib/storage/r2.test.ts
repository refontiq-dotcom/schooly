import { afterEach, describe, expect, it } from "vitest"
import {
  buildMediaPath,
  extensionFor,
  isAllowedMediaType,
  publicMediaUrl,
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

describe("buildMediaPath", () => {
  it("range les objets par établissement puis par type", () => {
    const path = buildMediaPath("school-1", "gallery", "image/jpeg")
    expect(path).toMatch(/^school-1\/gallery\/[0-9a-f-]{36}\.jpg$/)
  })

  it("produit un chemin unique à chaque appel", () => {
    const a = buildMediaPath("school-1", "cover", "image/png")
    const b = buildMediaPath("school-1", "cover", "image/png")
    expect(a).not.toBe(b)
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

  it("compose l'endpoint R2 a partir de l'account id", () => {
    process.env.R2_ACCOUNT_ID = "abc123"
    process.env.R2_ACCESS_KEY_ID = "key"
    process.env.R2_SECRET_ACCESS_KEY = "secret"
    process.env.R2_BUCKET = "medias"
    process.env.R2_PUBLIC_URL = "https://pub.example.dev"
    const config = readR2Config()
    expect(config).not.toBeNull()
    expect(config?.endpoint).toBe("https://abc123.r2.cloudflarest.com")
    expect(config?.bucket).toBe("medias")
  })
})