import { timingSafeEqual } from "node:crypto";

/**
 * Authentifie les appels serveur-à-serveur provenant de Trouvetou.
 *
 * TROUVETOU_API_KEY est la clé API propre à ce provider (tv_live_<id>.<secret>).
 * TROUVETOU_API_KEY_PEPPER est uniquement le pepper HMAC utilisé côté Trouvetou
 * pour vérifier les empreintes : il ne doit jamais être accepté comme jeton.
 */
export function isTrouvetouRequest(request: Request): boolean {
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
