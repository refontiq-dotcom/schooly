// ─────────────────────────────────────────────────────────────────────────
// Moteur de « guidance » (Schooly vous guide).
//
// Reste volontairement un moteur de règles explicites (pas de ML) : chaque
// page calcule ses propres GuidanceItem à partir de conditions métier. Ce
// module fournit uniquement la mécanique commune :
//   - le classement (sévérité + poids optionnel), sur la liste ENTIÈRE —
//     `IntelligentGuidance` décide ensuite combien en montrer ;
//   - des seuils sensibles à la progression de l'année scolaire, pour éviter
//     de comparer un taux de recouvrement de novembre à un seuil pensé pour
//     juin ;
//   - rien côté stockage/dismissal ici : ça vit dans le composant client
//     (localStorage), ce fichier doit rester importable depuis un Server
//     Component sans dépendre du navigateur.
// ─────────────────────────────────────────────────────────────────────────

export type GuidanceSeverity = "critical" | "action" | "warning" | "info"

export type GuidanceItem = {
  id: string
  title: string
  description: string
  severity: GuidanceSeverity
  actionLabel?: string
  /** Lien de navigation optionnel — sinon onAction est utilisé. */
  href?: string
  onAction?: () => void
  /**
   * Poids fin pour départager deux items de même sévérité (plus grand =
   * plus prioritaire). Par défaut 0. Utile par ex. pour faire remonter le
   * plus grand nombre d'éléments en attente en premier.
   */
  weight?: number
  /**
   * Un item "critical" reste toujours affiché tant que la condition est
   * vraie (non masquable). Pour les autres sévérités, `dismissible: false`
   * force le même comportement — à réserver aux items dont ignorer
   * l'alerte aurait un vrai coût (ex. échéance de paiement imminente).
   * Par défaut : true sauf pour "critical".
   */
  dismissible?: boolean
}

const SEVERITY_WEIGHT: Record<GuidanceSeverity, number> = {
  critical: 3000,
  action: 2000,
  warning: 1000,
  info: 0,
}

/**
 * Classe la liste ENTIÈRE par priorité (sévérité, puis poids fin, puis
 * ordre d'origine pour stabilité). Ne tronque rien — c'est à l'appelant de
 * décider combien afficher.
 */
export function rankGuidanceItems(items: GuidanceItem[]): GuidanceItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const scoreA = SEVERITY_WEIGHT[a.item.severity] + (a.item.weight ?? 0)
      const scoreB = SEVERITY_WEIGHT[b.item.severity] + (b.item.weight ?? 0)
      if (scoreB !== scoreA) return scoreB - scoreA
      return a.index - b.index
    })
    .map(({ item }) => item)
}

export function isDismissible(item: GuidanceItem): boolean {
  if (item.severity === "critical") return false
  return item.dismissible ?? true
}

// ─────────────────────────────────────────── Seuils sensibles au temps ──

/** Fraction (0 à 1) de l'année scolaire déjà écoulée à la date `now`. */
export function termProgress(startDate: string, endDate: string, now: Date = new Date()): number {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  const elapsed = now.getTime() - start
  return Math.min(1, Math.max(0, elapsed / (end - start)))
}

/**
 * Interpole un seuil entre `atStart` (début d'année) et `atEnd` (fin
 * d'année) selon la progression `progress` (0 à 1). Ex. le taux de
 * recouvrement qu'on est en droit d'attendre est plus bas en octobre qu'en
 * mai : `progressiveThreshold(40, 85, progress)`.
 */
export function progressiveThreshold(atStart: number, atEnd: number, progress: number): number {
  return atStart + (atEnd - atStart) * Math.min(1, Math.max(0, progress))
}
