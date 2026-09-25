import { describe, expect, it } from "vitest"
import { trouvetouAdSchema, trouvetouProfileSchema } from "./trouvetou"

const validProfile = {
  description_publique: "Établissement familial",
  latitude: "5.36",
  longitude: "-4.006",
  itineraire: "Cocody Danga",
  video_url: "https://youtube.com/watch?v=schooly",
  photos_360: ["https://cdn.example.com/360.jpg"],
  cover_photo_url: "https://cdn.example.com/cover.jpg",
  gallery_photos: ["https://cdn.example.com/gallery.jpg"],
  public_address: "Cocody Danga",
  public_phone: "+225 07 00 00 00 00",
  public_email: "contact@ecole.ci",
  public_website_url: "https://ecole.ci",
  public_highlights: ["Cantine", "Transport"],
  admission_notes: "Rentrée en septembre",
}

const validAd = {
  title: "Rentrée 2026",
  message: "Les inscriptions sont ouvertes",
  image_url: "https://cdn.example.com/affiche.jpg",
  target_url: "https://ecole.ci/inscriptions",
  start_date: "2026-09-01",
  end_date: "2026-09-30",
}

describe("trouvetouProfileSchema", () => {
  it("accepte et normalise un profil complet", () => {
    const parsed = trouvetouProfileSchema.safeParse(validProfile)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.latitude).toBe(5.36)
      expect(parsed.data.cover_photo_url).toBe("https://cdn.example.com/cover.jpg")
    }
  })

  it("normalise les champs facultatifs vides à null ou []", () => {
    const parsed = trouvetouProfileSchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.cover_photo_url).toBeNull()
      expect(parsed.data.gallery_photos).toEqual([])
      expect(parsed.data.latitude).toBeNull()
    }
  })

  it.each([
    ["cover_photo_url", "javascript:alert(1)"],
    ["video_url", "data:text/html,bad"],
    ["public_website_url", "/site"],
    ["gallery_photos", ["https://cdn.example.com/ok.jpg", "javascript:alert(2)"]],
  ])("refuse une URL non sûre dans %s", (field, value) => {
    expect(trouvetouProfileSchema.safeParse({ [field]: value }).success).toBe(false)
  })

  it("refuse des coordonnées, textes ou listes hors bornes", () => {
    expect(trouvetouProfileSchema.safeParse({ latitude: "95" }).success).toBe(false)
    expect(trouvetouProfileSchema.safeParse({ longitude: "-200" }).success).toBe(false)
    expect(trouvetouProfileSchema.safeParse({ public_email: "invalide" }).success).toBe(false)
    expect(trouvetouProfileSchema.safeParse({ description_publique: "x".repeat(2001) }).success).toBe(false)
    expect(
      trouvetouProfileSchema.safeParse({
        gallery_photos: Array.from({ length: 51 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
      }).success,
    ).toBe(false)
  })
})

describe("trouvetouAdSchema", () => {
  it("accepte une publicité avec des dates cohérentes", () => {
    expect(trouvetouAdSchema.safeParse(validAd).success).toBe(true)
  })

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "/affiche.jpg"])(
    "refuse l'image non sûre %s",
    (imageUrl) => {
      expect(trouvetouAdSchema.safeParse({ ...validAd, image_url: imageUrl }).success).toBe(false)
    },
  )

  it("refuse une destination non sûre et une période inversée", () => {
    expect(trouvetouAdSchema.safeParse({ ...validAd, target_url: "javascript:alert(2)" }).success).toBe(false)
    expect(
      trouvetouAdSchema.safeParse({ ...validAd, start_date: "2026-10-01", end_date: "2026-09-01" }).success,
    ).toBe(false)
  })

  it("exige titre, message et dates", () => {
    expect(trouvetouAdSchema.safeParse({ ...validAd, title: "" }).success).toBe(false)
    expect(trouvetouAdSchema.safeParse({ ...validAd, message: "" }).success).toBe(false)
    expect(trouvetouAdSchema.safeParse({ ...validAd, start_date: "2026-02-31" }).success).toBe(false)
    expect(trouvetouAdSchema.safeParse({ ...validAd, end_date: "2026-99-30" }).success).toBe(false)
  })
})