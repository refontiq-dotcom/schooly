export type EvaluationMode = "TRIMESTRE" | "SEMESTRE" | "COMPOSITION_PRIMAIRE"
export type Category = "interrogation" | "devoir" | "composition"
export type Average = { value: number | null; complete: boolean }
export type Grade = {
  value: number | null
  maxValue: number
  weight: number
  category: Category
  status: "graded" | "excused" | "missing"
}
export type Rules = {
  mode: EvaluationMode
  scale: number
  threshold: number
  rescueMargin: number
  categoryWeights: Record<Category, number> | null
}

function finite(value: number, min: number, label: string) {
  if (!Number.isFinite(value) || value < min) throw new Error(`${label} invalide.`)
}

export function validateRules(rules: Rules): void {
  if (!["TRIMESTRE", "SEMESTRE", "COMPOSITION_PRIMAIRE"].includes(rules.mode)) {
    throw new Error("Mode d'évaluation invalide.")
  }
  finite(rules.scale, Number.MIN_VALUE, "Barème")
  finite(rules.threshold, 0, "Seuil")
  finite(rules.rescueMargin, 0, "Marge de rachat")
  if (rules.threshold > rules.scale || rules.rescueMargin > rules.threshold) {
    throw new Error("Seuil ou marge hors barème.")
  }
  if (rules.categoryWeights) {
    const weights = ["interrogation", "devoir", "composition"].map(category =>
      rules.categoryWeights![category as Category])
    weights.forEach(weight => finite(weight, 0, "Pondération"))
    if (Math.abs(weights.reduce((a, b) => a + b, 0) - 100) > 1e-9) {
      throw new Error("Les pondérations doivent totaliser 100 %.")
    }
  }
}

/** Aucun arrondi intermédiaire ; null n'est jamais une note zéro. */
export function computeSubjectAverage(grades: Grade[], rules: Rules): Average {
  validateRules(rules)
  for (const grade of grades) {
    finite(grade.maxValue, Number.MIN_VALUE, "Barème de l'évaluation")
    finite(grade.weight, 0, "Poids")
    if (!["graded", "excused", "missing"].includes(grade.status) ||
        !["interrogation", "devoir", "composition"].includes(grade.category)) {
      throw new Error("Statut ou catégorie invalide.")
    }
    if (grade.status === "graded") {
      if (grade.value === null) throw new Error("Note requise.")
      finite(grade.value, 0, "Note")
      if (grade.value > grade.maxValue) throw new Error("Note hors barème.")
    } else if (grade.value !== null) throw new Error("Une absence ou note manquante ne porte pas de valeur.")
  }
  const active = grades.filter(g => g.weight > 0 &&
    (!rules.categoryWeights || rules.categoryWeights[g.category] > 0))
  const included = active.filter(g => g.status === "graded")
  const weighted = (items: Grade[]): number | null => {
    const weight = items.reduce((sum, g) => sum + g.weight, 0)
    return weight > 0 ? items.reduce((sum, g) =>
      sum + (g.value! / g.maxValue) * rules.scale * g.weight, 0) / weight : null
  }
  const complete = !active.some(g => g.status === "missing")
  if (!rules.categoryWeights) {
    const value = weighted(included)
    return { value, complete: complete && value !== null }
  }
  let total = 0
  for (const category of ["interrogation", "devoir", "composition"] as const) {
    const weight = rules.categoryWeights[category]
    if (!weight) continue
    const value = weighted(included.filter(g => g.category === category))
    // Politique explicite : catégorie obligatoire manquante => incomplet.
    if (value === null) return { value: null, complete: false }
    total += value * weight / 100
  }
  return { value: total, complete }
}

export function computePeriodAverage(subjects: { average: Average; coefficient: number }[]): Average {
  subjects.forEach(s => {
    finite(s.coefficient, Number.MIN_VALUE, "Coefficient matière")
    if (s.average.value !== null) finite(s.average.value, 0, "Moyenne matière")
  })
  const available = subjects.filter(s => s.average.value !== null)
  const weight = available.reduce((sum, s) => sum + s.coefficient, 0)
  return {
    value: weight > 0 ? available.reduce((sum, s) => sum + s.average.value! * s.coefficient, 0) / weight : null,
    complete: subjects.length > 0 && subjects.every(s => s.average.complete && s.average.value !== null),
  }
}

export function computeAnnualAverage(periods: Average[], rules: Rules, passage?: Average): Average {
  validateRules(rules)
  const expected = rules.mode === "TRIMESTRE" ? 3 : rules.mode === "SEMESTRE" ? 2 : periods.length
  if (expected === 0 || periods.length !== expected ||
      periods.some(p => !p.complete || p.value === null) ||
      (rules.mode === "COMPOSITION_PRIMAIRE" && (!passage?.complete || passage.value === null))) {
    return { value: null, complete: false }
  }
  for (const result of [...periods, ...(passage ? [passage] : [])]) {
    if (result.value !== null) {
      finite(result.value, 0, "Moyenne")
      if (result.value > rules.scale) throw new Error("Moyenne hors barème.")
    }
  }
  const mean = periods.reduce((sum, p) => sum + p.value!, 0) / expected
  return { value: rules.mode === "COMPOSITION_PRIMAIRE" ? mean * 0.4 + passage!.value! * 0.6 : mean, complete: true }
}

export function proposeDecision(average: Average, rules: Rules): "incomplete" | "admitted" | "rescuable" | "deferred" {
  validateRules(rules)
  if (!average.complete || average.value === null) return "incomplete"
  finite(average.value, 0, "Moyenne")
  if (average.value > rules.scale) throw new Error("Moyenne hors barème.")
  if (average.value >= rules.threshold) return "admitted"
  return average.value >= rules.threshold - rules.rescueMargin ? "rescuable" : "deferred"
}
