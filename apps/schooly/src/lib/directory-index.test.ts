import { describe, expect, it } from "vitest"
import { buildSearchHits, type DirectorySnapshot } from "./directory-index"

const snapshot: DirectorySnapshot = {
  students: [
    {
      id: "s1",
      first_name: "Jean",
      last_name: "Kouassi",
      enrollments: [{ grade_levels: { name: "6ème" }, classes: { name: "6ème A" } }],
    },
  ],
  guardians: [
    {
      id: "g1",
      full_name: "Awa Traoré",
      phone: "+225 07 00 00 00 00",
      enrollments: [{ students: { first_name: "Jean", last_name: "Kouassi" } }],
    },
  ],
  enrollments: [
    {
      id: "e1",
      student_id: "s1",
      matricule: "61CC-2026-0042",
      students: { first_name: "Jean", last_name: "Kouassi" },
      guardians: { full_name: "Awa Traoré", phone: "+2250700000000" },
      grade_levels: { name: "6ème" },
      classes: { name: "6ème A" },
    },
  ],
  preEnrollments: [
    {
      id: "p1",
      first_name: "Mamadou",
      last_name: "Diallo",
      code: "AB12CD",
      guardian_phone: "0102030405",
    },
  ],
}

describe("buildSearchHits", () => {
  it("groupe eleve, tuteur et inscription pour une meme recherche", () => {
    const hits = buildSearchHits(snapshot, "kouassi")
    expect(hits.some((h) => h.kind === "student" && h.title.includes("Kouassi"))).toBe(true)
    expect(hits.some((h) => h.kind === "guardian")).toBe(true)
    expect(hits.some((h) => h.kind === "enrollment")).toBe(true)
  })

  it("retrouve un tuteur par telephone", () => {
    const hits = buildSearchHits(snapshot, "0700")
    expect(hits.some((h) => h.kind === "guardian" && h.id === "g1")).toBe(true)
  })

  it("retrouve une inscription par matricule", () => {
    const hits = buildSearchHits(snapshot, "61CC-2026-0042")
    expect(hits.some((h) => h.kind === "enrollment" && h.id === "e1")).toBe(true)
  })

  it("ne renvoie rien si vide", () => {
    expect(buildSearchHits(snapshot, "   ")).toEqual([])
  })
})
