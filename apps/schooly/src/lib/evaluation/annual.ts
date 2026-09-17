import { computeAnnualAverage, proposeDecision, validateRules, type Average, type Rules } from "./calculations"

export type AnnualPeriod = {
  id: string
  position: number
  isPassage: boolean
  startsAt: string
  endsAt: string
  lockedAt: string | null
  average: Average
}

export type AnnualPreview = {
  average: Average
  proposal: ReturnType<typeof proposeDecision>
  allPeriodsClosed: boolean
  readyForValidation: boolean
  blockers: string[]
}

/** Aperçu uniquement : aucune décision persistée, aucun instantané de publication. */
export function computeAnnualPreview(periods: readonly AnnualPeriod[], rules: Rules, now: number): AnnualPreview {
  validateRules(rules)
  if (!Number.isFinite(now)) throw new Error("Heure serveur invalide.")
  const ids = new Set<string>()
  const positions = new Set<number>()
  for (const period of periods) {
    if (!period.id || ids.has(period.id) || !Number.isInteger(period.position) ||
        period.position < 1 || positions.has(period.position)) {
      throw new Error("Identifiant ou position de période invalide ou en double.")
    }
    ids.add(period.id); positions.add(period.position)
    const start = Date.parse(period.startsAt), end = Date.parse(period.endsAt)
    const lock = period.lockedAt === null ? null : Date.parse(period.lockedAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
        (lock !== null && (!Number.isFinite(lock) || lock > now))) {
      throw new Error("Calendrier de période invalide.")
    }
    const value = period.average.value
    if ((value !== null && (!Number.isFinite(value) || value < 0 || value > rules.scale)) ||
        (period.average.complete && value === null)) {
      throw new Error("Moyenne de période invalide.")
    }
  }
  const chronological = [...periods].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  if (chronological.some((period, index) => index > 0 && Date.parse(period.startsAt) < Date.parse(chronological[index - 1].endsAt))) {
    throw new Error("Les périodes se chevauchent.")
  }
  const regular = periods.filter(p => !p.isPassage)
  const passage = periods.filter(p => p.isPassage)
  const primary = rules.mode === "COMPOSITION_PRIMAIRE"
  const expected = rules.mode === "TRIMESTRE" ? 3 : 2
  const calendarComplete = primary
    ? regular.length > 0 && passage.length === 1
    : passage.length === 0 && regular.length === expected && regular.every(p => p.position <= expected)
  const blockers: string[] = []
  if (!calendarComplete) blockers.push(primary
    ? "Au moins une composition régulière et une unique composition de passage sont requises."
    : `${expected} périodes ordinaires sont requises pour ce régime.`)
  const average = calendarComplete
    ? computeAnnualAverage(regular.map(p => p.average), rules, passage[0]?.average)
    : { value: null, complete: false }
  if (calendarComplete && !average.complete) blockers.push("Une ou plusieurs périodes sont incomplètes ou non calculables.")
  // L'échéance exclusive verrouille aussi les écritures, sans attendre une clôture manuelle.
  const allPeriodsClosed = periods.length > 0 && periods.every(p => p.lockedAt !== null || now >= Date.parse(p.endsAt))
  if (!allPeriodsClosed) blockers.push("Toutes les périodes doivent être verrouillées avant validation.")
  return {
    average, proposal: proposeDecision(average, rules), allPeriodsClosed,
    readyForValidation: calendarComplete && average.complete && allPeriodsClosed, blockers,
  }
}
