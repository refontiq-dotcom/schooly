/**
 * Codes de mouvement TRF/ORT — validation locale avant appel serveur.
 *
 * L'algorithme doit rester identique à `public.movement_code_checksum` du SQL :
 * modifier l'un sans l'autre invalide des codes légitimes. Le checksum détecte
 * une faute de frappe ; il ne constitue jamais une autorisation d'accès.
 */
export const MOVEMENT_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

export type MovementKind = "TRF" | "ORT"

/** Checksum d'un corps de 7 caractères (préfixe inclus), ou null si invalide. */
export function movementCodeChecksum(body: string): string | null {
  if (body.length !== 7) return null
  const prefix = body.slice(0, 3)
  if (prefix !== "TRF" && prefix !== "ORT") return null
  let total = body.charCodeAt(0) + 3 * body.charCodeAt(1) + 5 * body.charCodeAt(2)
  for (let position = 4; position <= 7; position++) {
    const index = MOVEMENT_ALPHABET.indexOf(body[position - 1] ?? "")
    if (index < 0) return null
    total += index * (2 * position - 1)
  }
  return MOVEMENT_ALPHABET[total % 32] ?? null
}

/** Un code complet : préfixe connu, 4 symboles de l'alphabet et checksum exact. */
export function isValidMovementCode(code: string): boolean {
  const normalized = code.trim().toUpperCase()
  if (normalized.length !== 8) return false
  const checksum = movementCodeChecksum(normalized.slice(0, 7))
  return checksum !== null && checksum === normalized.slice(7)
}

/** Préfixe déclaré par un code de 8 caractères, ou null si le format est inconnu. */
export function movementKind(code: string): MovementKind | null {
  const normalized = code.trim().toUpperCase()
  if (normalized.length !== 8) return null
  const prefix = normalized.slice(0, 3)
  return prefix === "TRF" || prefix === "ORT" ? prefix : null
}

/** Normalise une saisie humaine (majuscules, espaces et tirets retirés). */
export function normalizeMovementCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase()
}
