import { describe, expect, it } from "vitest"
import { errorMessage, profileCompletion, reservationLabel } from "./helpers"
import { normalizeAds, normalizeReservations, normalizeSchool } from "./types"

const FULL_STATE = {
  coverPhoto: "https://cdn.example.com/cover.jpg",
  description: "Établissement familial.",
  address: "Cocody Danga",
  latitude: "5.36",
  longitude: "-4.006",
  phone: "+2250700000001",
  email: "contact@palmiers.ci",
  gallery: ["https://cdn.example.com/g1.jpg"],
  videoUrl: "",
  highlights: ["Cantine", "Transport"],
  admissionNotes: "Rentrée en septembre.",
}

describe("reservationLabel", () => {
  it("traduit les statuts connus et renvoie le brut sinon", () => {
    expect(reservationLabel("pending_payment")).toBe("Attente paiement")
    expect(reservationLabel("reserved")).toBe("Réservée")
    expect(reservationLabel("confirmed")).toBe("Confirmée")
    expect(reservationLabel("expired")).toBe("Expirée")
    expect(reservationLabel("custom_status")).toBe("custom_status")
  })
})

describe("profileCompletion", () => {
  it("compte 7/8 avec un profil quasi complet (vidéo manquante)", () => {
    const result = profileCompletion(FULL_STATE)
    expect(result.total).toBe(8)
    expect(result.done).toBe(7)
    expect(result.percent).toBe(88)
  })

  it("tombe à 0/8 pour un profil vide", () => {
    const result = profileCompletion({
      coverPhoto: "",
      description: "   ",
      address: "",
      latitude: "",
      longitude: "",
      phone: "",
      email: "",
      gallery: [],
      videoUrl: "",
      highlights: [],
      admissionNotes: "",
    })
    expect(result.done).toBe(0)
    expect(result.percent).toBe(0)
  })

  it("considère la localisation comme couverte par les coordonnées seules", () => {
    const result = profileCompletion({
      ...FULL_STATE,
      address: "",
      latitude: "5.36",
      longitude: "-4.006",
    })
    const localisation = result.checks.find(([, label]) => label === "Localisation")
    expect(localisation?.[0]).toBe(true)
  })
})

describe("errorMessage", () => {
  it("retire le message d'une Error, sinon le fallback", () => {
    expect(errorMessage(new Error("Échec"), "Fallback")).toBe("Échec")
    expect(errorMessage("boom", "Fallback")).toBe("Fallback")
    expect(errorMessage(undefined, "Fallback")).toBe("Fallback")
    expect(errorMessage(new Error(""), "Fallback")).toBe("Fallback")
  })
})

describe("normalisation trouvetou", () => {
  it("normalizeSchool écarte les lignes invalides", () => {
    expect(normalizeSchool({ id: "s1", name: "Les Palmiers", city: "Abidjan" })?.name).toBe(
      "Les Palmiers",
    )
    expect(normalizeSchool({ name: "sans id" })).toBeNull()
    expect(normalizeSchool(null)).toBeNull()
  })

  it("normalizeReservations/normalizeAds écartent les lignes sans id", () => {
    const reservations = normalizeReservations([
      { id: "r1", student_full_name: "Awa", status: "reserved" },
      { student_full_name: "orphelin" },
      "junk",
    ])
    expect(reservations).toHaveLength(1)
    expect(reservations[0].status).toBe("reserved")

    const ads = normalizeAds([
      { id: "a1", title: "Titre", is_active: true },
      { id: "a2" },
    ])
    expect(ads).toHaveLength(1)
    expect(ads[0].title).toBe("Titre")
    expect(normalizeAds("nawak")).toEqual([])
  })
})
