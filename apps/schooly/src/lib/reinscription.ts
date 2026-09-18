/**
 * Réinscription en ligne — helpers purs.
 *
 * Pourquoi un module dédié : la réinscription repose sur une *recherche
 * d'identité* (retrouver l'élève par le téléphone du parent) et sur une
 * *progression de niveau*. Une erreur y est silencieuse et coûteuse :
 *   • un téléphone mal normalisé ⇒ le parent « n'existe pas » alors qu'il est
 *     en base, et l'élève est recréé en doublon ;
 *   • un niveau mal calculé ⇒ l'élève est réinscrit dans la mauvaise classe.
 *
 * `normalizePhone` est le MIROIR JS de `public.normalize_phone(text)` (migration
 * 20260918160000). Les deux doivent produire exactement la même chaîne : la
 * recherche se fait en SQL sur `guardians.phone_norm`.
 *
 * Cf. apps/schooly/src/app/dashboard/admissions/enrollment-utils.ts pour le
 * formatage d'affichage (formatGuardianPhone) — celui-ci est destiné à la
 * saisie, celui d'ici à la comparaison.
 */

export type GradeLevelRow = {
  id: string
  name: string
  level: number
}

/** Indicatif retenu par la normalisation (Côte d'Ivoire). */
export const PHONE_COUNTRY_CODE = "+225"

/**
 * Longueur d'un numéro ivoirien local (10 chiffres : « 07 00 00 00 00 »).
 * Sert à ne pas confondre un numéro local préfixé « 225… » par erreur.
 */
const LOCAL_LENGTH = 10

/**
 * Format canonique d'un numéro ivoirien : « +225 » suivi des chiffres, sans
 * espaces ni séparateurs. `null` si la chaîne ne contient aucun chiffre.
 *
 * Accepte : « 0700000000 », « 07 00 00 00 00 », « +2250700000000 »,
 * « +225 07 00 00 00 00 », « 002250700000000 », « 2250700000000 ».
 */
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
 * Clé de comparaison d'un libellé de niveau ou de classe : minuscules, sans
 * accents, sans séparateurs. « 6ème » et « 6EME » → « 6eme ».
 */
export function normalizeLevelName(name: string | null | undefined): string {
  if (!name) return ""
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/** Places restantes d'un niveau, jamais négatives. */
export function seatsAvailable(capacity: number | null | undefined, enrolled: number): number {
  return Math.max(0, (capacity ?? 0) - enrolled)
}

/**
 * Retrouve le niveau du référentiel correspondant à un libellé libre.
 *
 * Deux passes, dans cet ordre :
 *   1. correspondance exacte sur la clé normalisée ;
 *   2. correspondance par préfixe — la plus longue gagne — pour absorber les
 *      libellés composites saisis par les parents (« 6ème A » ⇒ niveau « 6ème »).
 */
export function findLevelByName(
  name: string | null | undefined,
  levels: readonly GradeLevelRow[]
): GradeLevelRow | null {
  const target = normalizeLevelName(name)
  if (!target) return null

  const exact = levels.find((l) => normalizeLevelName(l.name) === target)
  if (exact) return exact

  const prefixed = levels
    .filter((l) => {
      const key = normalizeLevelName(l.name)
      return key !== "" && target.startsWith(key)
    })
    .sort((a, b) => normalizeLevelName(b.name).length - normalizeLevelName(a.name).length)

  return prefixed[0] ?? null
}

/**
 * Niveau suivant dans la progression de l'école, à partir de la classe
 * actuelle de l'élève (nom de niveau, ou libellé de classe libre).
 *
 * Le classement utilise `level` (rang) et non la position dans le tableau :
 * les niveaux d'une école ne sont pas nécessairement contigus, et une école
 * peut n'avoir que le primaire. On retient le premier rang STRICTEMENT
 * supérieur — robuste aux trous dans la numérotation.
 *
 * `null` si le niveau actuel est inconnu du référentiel (l'école choisit alors
 * manuellement) ou si l'élève est déjà au dernier niveau (fin de cycle).
 */
export function pickNextLevel(
  currentName: string | null | undefined,
  levels: readonly GradeLevelRow[]
): GradeLevelRow | null {
  if (levels.length === 0) return null

  const current = findLevelByName(currentName, levels)
  if (!current) return null

  const ordered = [...levels].sort((a, b) => a.level - b.level)
  return ordered.find((l) => l.level > current.level) ?? null
}