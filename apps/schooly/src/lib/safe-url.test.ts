import { describe, expect, it } from "vitest"
import { normalizeHttpUrl, normalizeHttpUrlList } from "./safe-url"

describe("normalizeHttpUrl", () => {
  it("accepte et normalise une URL HTTP(S) absolue", () => {
    expect(normalizeHttpUrl(" https://cdn.example.com/photo.jpg ")).toBe(
      "https://cdn.example.com/photo.jpg",
    )
    expect(normalizeHttpUrl("http://example.com/école")).toBe(
      "http://example.com/%C3%A9cole",
    )
  })

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/photo.jpg",
    "//cdn.example.com/photo.jpg",
    "not-a-url",
    `https://example.com/${"a".repeat(2049)}`,
    null,
    42,
  ])("rejette une URL non sûre : %s", (value) => {
    expect(normalizeHttpUrl(value)).toBeNull()
  })
})

describe("normalizeHttpUrlList", () => {
  it("conserve uniquement les URL HTTP(S), déduplique et borne la liste", () => {
    const values = [
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/1.jpg",
      "javascript:alert(1)",
      "https://cdn.example.com/2.jpg",
      ...Array.from({ length: 60 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
    ]

    const result = normalizeHttpUrlList(values)

    expect(result).toHaveLength(50)
    expect(result[0]).toBe("https://cdn.example.com/1.jpg")
    expect(result[1]).toBe("https://cdn.example.com/2.jpg")
    expect(result.every((value) => value.startsWith("https://"))).toBe(true)
  })

  it("retourne une liste vide pour une valeur non tableau", () => {
    expect(normalizeHttpUrlList("https://cdn.example.com/1.jpg")).toEqual([])
  })
})