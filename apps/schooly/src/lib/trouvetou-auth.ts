import { timingSafeEqual } from "node:crypto";

/**
 * Authentifie les appels de réservation serveur-à-serveur depuis Trouvetou.
 *
 * Le secret de réservation est distinct de la clé de synchronisation provider
 * et du pepper HMAC. Il n'est jamais placé dans les annonces ni côté navigateur.
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
