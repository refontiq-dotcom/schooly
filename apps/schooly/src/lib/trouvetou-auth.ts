import { timingSafeEqual } from "node:crypto";

/**
 * Authentifie les appels de réservation serveur-à-serveur depuis Trouvetou.
 *
 * Le secret de réservation est distinct de la clé de synchronisation provider
 * et du pepper HMAC. Il n'est jamais placé dans les annonces ni côté navigateur.
 * Les valeurs Preview et Production sont configurées séparément.
 * Cette branche sert à valider le parcours partenaire en environnement Preview.
 */
export function isTrouvetouRequest(request: Request): boolean {
  const expected = process.env.TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET?.trim();
  const provided = request.headers.get("x-trouvetou-booking-secret")?.trim() ?? "";
  if (!expected || !provided) return false;

  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * Authentifie une requête de synchronisation / service provider Trouvetou.
 * Cette clé est distincte du secret de réservation et du pepper HMAC.
 */
export function isTrouvetouProviderRequest(request: Request): boolean {
  const expected = process.env.TROUVETOU_API_KEY?.trim();
  if (!expected) return false;

  const headerKey = request.headers.get("x-trouvetou-api-key")?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const bearerKey = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim();
  const provided = headerKey || bearerKey || "";
  if (!provided) return false;

  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);
}
