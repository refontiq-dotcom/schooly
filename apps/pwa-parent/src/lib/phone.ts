/**
 * Normalisation téléphone — miroir EXACT de la fonction SQL
 * `public.normalize_phone` (migration 20260918160000) et du module
 * `apps/schooly/src/lib/reinscription.ts`. Les trois implémentations
 * doivent rester identiques : c'est la clé de rapprochement des parents.
 *
 * Accepte : « 0700000000 », « 07 00 00 00 00 », « +2250700000000 »,
 * « +225 07 00 00 00 00 », « 002250700000000 », « 2250700000000 ».
 */
const PHONE_COUNTRY_CODE = "+225"
const LOCAL_LENGTH = 10

export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const digits = String(raw).replace(/\D/g, "")
  if (digits === "") return null

  let rest = digits
  if (rest.startsWith("00225")) {
    rest = rest.slice(5)
  } else if (rest.startsWith("225") && rest.length > LOCAL_LENGTH) {
    rest = rest.slice(3)
  }

  return `${PHONE_COUNTRY_CODE}${rest}`
}

/**
 * Email d'authentification synthétique dérivé du téléphone normalisé.
 * Il n'est jamais utilisé comme email de contact : il sert uniquement
 * d'identifiant Supabase Auth pour le compte parent (le parent, lui,
 * se connecte avec son numéro).
 */
export function parentSyntheticEmail(phoneNorm: string): string {
  const digits = phoneNorm.replace(/\D/g, "")
  return `${digits}@parents.schooly.app`
}
