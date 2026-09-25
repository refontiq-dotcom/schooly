import { describe, expect, it } from "vitest";
import { normalizeHttpUrl, normalizeHttpUrlList } from "./safe-url.mjs";

describe("normalizeHttpUrl — script Trouvetou", () => {
  it("accepte une URL absolue HTTP(S)", () => {
    expect(normalizeHttpUrl(" https://cdn.example.com/photo.jpg ")).toBe(
      "https://cdn.example.com/photo.jpg",
    );
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "/photo.jpg", null])(
    "refuse la valeur non sûre %s",
    (value) => {
      expect(normalizeHttpUrl(value)).toBeNull();
    },
  );
});

describe("normalizeHttpUrlList — script Trouvetou", () => {
  it("filtre, déduplique et borne les médias", () => {
    const result = normalizeHttpUrlList([
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/1.jpg",
      "javascript:alert(1)",
      "https://cdn.example.com/2.jpg",
      ...Array.from({ length: 60 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
    ]);

    expect(result).toHaveLength(50);
    expect(result[0]).toBe("https://cdn.example.com/1.jpg");
    expect(result[1]).toBe("https://cdn.example.com/2.jpg");
  });
});