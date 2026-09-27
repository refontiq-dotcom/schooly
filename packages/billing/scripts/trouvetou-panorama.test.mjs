/**
 * Tests du contrat 360° transmis à Trouvetou.
 *
 * ⚠️ Fiches synthétiques : aucun panorama réel n'existe encore. Ces tests
 * décrivent le contrat, ils ne le prouvent pas sur une vraie image.
 */
import { describe, expect, it } from "vitest";
import { buildPanoramaPayload, toPanoramaContract } from "./trouvetou-panorama.mjs";

const URL = "https://pub.example.r2.dev/schooly/production/360/s1/m1.jpg";

/** Fiche synthétique d'une visite publiée. */
const published = (overrides = {}) => ({
  id: "m1",
  school_id: "s1",
  kind: "panorama_360",
  status: "published",
  public_url: URL,
  width: 6000,
  height: 3000,
  byte_size: 4_200_000,
  content_type: "image/jpeg",
  room_id: null,
  validated_at: "2026-09-28T10:00:00.000Z",
  ...overrides,
});

describe("toPanoramaContract — contrat d'une visite", () => {
  it("transmet une visite publiée avec son marqueur de type", () => {
    const contract = toPanoramaContract(published());
    expect(contract.media_type).toBe("photo_360");
    expect(contract.projection).toBe("equirectangular_2_1");
    expect(contract.url).toBe(URL);
    expect(contract.width).toBe(6000);
  });

  it("porte l'identifiant de la chambre quand la visite est rattachée", () => {
    expect(toPanoramaContract(published({ room_id: "chambre-7" })).room_id).toBe("chambre-7");
  });

  it.each(["uploaded", "validated", "rejected"])(
    "refuse de transmettre une visite au statut %s",
    (status) => {
      expect(toPanoramaContract(published({ status }))).toBeNull();
    },
  );

  it("refuse un média qui n'est pas un panorama", () => {
    expect(toPanoramaContract(published({ kind: "photo" }))).toBeNull();
  });

  it("écarte une URL non sûre plutôt que de la pousser vers le site public", () => {
    expect(toPanoramaContract(published({ public_url: "javascript:alert(1)" }))).toBeNull();
  });

  it("complète les dimensions manquantes par null plutôt que par undefined", () => {
    // `undefined` disparaîtrait silencieusement du JSON et laisserait
    // Trouvetou deviner au lieu de savoir que l'information manque.
    const contract = toPanoramaContract(published({ width: null, height: null, byte_size: null }));
    expect(contract.width).toBeNull();
    expect(contract.height).toBeNull();
    expect(contract.byte_size).toBeNull();
  });
});

describe("buildPanoramaPayload — charge utile d'une école", () => {
  it("reprend l'historique quand aucune visite n'est publiée", () => {
    const payload = buildPanoramaPayload({
      media: [published({ status: "validated" })],
      legacyPhotos360: ["https://cdn.example.com/ancien.jpg"],
    });
    expect(payload.panoramas).toHaveLength(0);
    expect(payload.photos_360).toEqual(["https://cdn.example.com/ancien.jpg"]);
  });

  it("privilégie la visite publiée et laisse le champ historique aligned", () => {
    const payload = buildPanoramaPayload({
      media: [published()],
      legacyPhotos360: ["https://cdn.example.com/ancien.jpg"],
    });
    expect(payload.panoramas).toHaveLength(1);
    // `photos_360` reste le même champ texte pour les lecteurs actuels.
    expect(payload.photos_360).toEqual([URL]);
  });

  it("n'émet rien pour une école sans visite ni historique", () => {
    const payload = buildPanoramaPayload({ media: [], legacyPhotos360: [] });
    expect(payload.panoramas).toEqual([]);
    expect(payload.photos_360).toEqual([]);
  });

  it("filtre les URLs non sûres du repli historique", () => {
    const payload = buildPanoramaPayload({
      media: [],
      legacyPhotos360: ["javascript:alert(1)", "https://cdn.example.com/ok.jpg"],
    });
    expect(payload.photos_360).toEqual(["https://cdn.example.com/ok.jpg"]);
  });

  it("conserve au plus une source 360°, comme la contrainte SQL l'impose", () => {
    const payload = buildPanoramaPayload({
      media: [],
      legacyPhotos360: [
        "https://cdn.example.com/1.jpg",
        "https://cdn.example.com/2.jpg",
        "https://cdn.example.com/3.jpg",
      ],
    });
    expect(payload.photos_360).toHaveLength(1);
  });
});
