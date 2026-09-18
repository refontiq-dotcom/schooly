import { describe, expect, it } from "vitest"
import {
  foldText,
  groupByInitial,
  initialOf,
  isPhoneLike,
  parseQuery,
  rankDirectory,
  stripPhoneCountry,
  withinOneEdit,
} from "./directory-search"

describe("foldText", () => {
  it("ignore casse, accents et cedilles", () => {
    expect(foldText("Kouassi")).toBe("kouassi")
    expect(foldText("KOUASSI")).toBe("kouassi")
    expect(foldText("Éloge")).toBe("eloge")
    expect(foldText("6ème")).toBe("6eme")
  })
})

describe("parseQuery", () => {
  it("decoupe une recherche nominative", () => {
    expect(parseQuery("Kouassi Jean")).toEqual({
      tokens: ["kouassi", "jean"],
      phone: null,
    })
  })

  it("detecte un numero meme mal formate", () => {
    expect(isPhoneLike("07 00 00 00 00")).toBe(true)
    expect(parseQuery("07 00 00 00 00")).toEqual({
      tokens: [],
      phone: "0700000000",
    })
    expect(parseQuery("+2250700000000").phone).toBe("0700000000")
    expect(stripPhoneCountry("2250700000000")).toBe("0700000000")
  })

  it("ne prend pas un nom ou un matricule pour un telephone", () => {
    expect(isPhoneLike("kouassi")).toBe(false)
    expect(isPhoneLike("61CC-2026-0042")).toBe(false)
    expect(parseQuery("6eme").tokens).toEqual(["6eme"])
    expect(parseQuery("61CC-2026-0042")).toEqual({
      tokens: ["61cc", "2026", "0042"],
      phone: null,
    })
  })
})

describe("withinOneEdit", () => {
  it("tolere une faute de frappe", () => {
    expect(withinOneEdit("kouasi", "kouassi")).toBe(true)
    expect(withinOneEdit("dialo", "diallo")).toBe(true)
    expect(withinOneEdit("kouassi", "traore")).toBe(false)
  })
})

const students = [
  {
    id: "1",
    last_name: "Kouassi",
    first_name: "Jean",
    grade: "6ème",
    className: "6ème A",
    phone: "+225 07 00 00 00 00",
    matricule: "61CC-2026-0042",
  },
  {
    id: "2",
    last_name: "Traoré",
    first_name: "Awa",
    grade: "5ème",
    className: "5ème B",
    phone: "+225 05 11 22 33 44",
    matricule: "61CC-2026-0099",
  },
  {
    id: "3",
    last_name: "Diallo",
    first_name: "Mamadou",
    grade: "6ème",
    className: "6ème A",
    phone: "0102030405",
    matricule: "61CC-2025-0001",
  },
]

function studentHay(s: (typeof students)[number]) {
  return {
    texts: [s.last_name, s.first_name, `${s.last_name} ${s.first_name}`, s.grade, s.className],
    phones: [s.phone],
    codes: [s.matricule],
  }
}

describe("rankDirectory", () => {
  it("retrouve par nom sans tenir compte des accents", () => {
    const hits = rankDirectory(students, "traore", studentHay)
    expect(hits.map((s) => s.id)).toEqual(["2"])
  })

  it("combine nom et classe", () => {
    const hits = rankDirectory(students, "kouassi 6eme", studentHay)
    expect(hits.map((s) => s.id)).toEqual(["1"])
  })

  it("retrouve par telephone partiel", () => {
    const hits = rankDirectory(students, "0700", studentHay)
    expect(hits.map((s) => s.id)).toEqual(["1"])
  })

  it("retrouve par matricule", () => {
    const hits = rankDirectory(students, "61CC-2026-0042", studentHay)
    expect(hits.map((s) => s.id)).toEqual(["1"])
  })

  it("classe le nom exact avant une correspondance partielle", () => {
    const list = [
      { id: "partial", name: "Kouakou" },
      { id: "exact", name: "Kouassi" },
    ]
    const hits = rankDirectory(list, "kouassi", (s) => ({ texts: [s.name] }))
    expect(hits[0].id).toBe("exact")
  })

  it("tolere une faute dans un nom assez long", () => {
    const hits = rankDirectory(students, "kouasi", studentHay)
    expect(hits.map((s) => s.id)).toEqual(["1"])
  })

  it("ne renvoie rien si aucun jeton ne correspond", () => {
    expect(rankDirectory(students, "xyzzy", studentHay)).toEqual([])
  })

  it("renvoie la liste intacte si la recherche est vide", () => {
    expect(rankDirectory(students, "  ", studentHay)).toBe(students)
  })
})

describe("groupByInitial", () => {
  it("regroupe par initiale du nom", () => {
    const groups = groupByInitial(students, (s) => s.last_name)
    expect(groups.map((g) => g.letter)).toEqual(["D", "K", "T"])
    expect(initialOf("Éloge")).toBe("E")
    expect(initialOf("8-bis")).toBe("#")
  })
})
