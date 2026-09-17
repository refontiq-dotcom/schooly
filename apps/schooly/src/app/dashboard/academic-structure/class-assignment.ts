/**
 * Destination d'un élève lors de la bascule d'année : niveau suivant et CLASSE.
 *
 * Modèle de données : `classes` est un objet d'ÉCOLE (`school_id`,
 * `grade_level_id`, `name`, `capacity`…) et **non un objet d'année** — une
 * classe est réutilisée d'une année sur l'autre. La promotion doit donc
 * décider, pour chaque élève, dans quelle classe du niveau supérieur il entre.
 *
 * ⚠️ Convention de `level` : c'est un RANG CROISSANT (1 = première année de
 * l'école, n = dernière année), pas un numéro de classe. La promotion vaut donc
 * `rang + 1`, et l'absence de rang supérieur vaut diplôme. Une école qui
 * saisirait « 6ème » = 6 puis « 5ème » = 5 (rangs descendants) verrait tous ses
 * élèves de dernier rang diplômés à tort : le panneau de bascule compte et
 * affiche explicitement ces élèves « diplômés » avant l'exécution pour que
 * l'anomalie saute aux yeux.
 *
 * Règles (décision produit) :
 *   1. le niveau de destination est celui de la promotion (rang + 1) ; un
 *      redoublant reste dans son niveau ;
 *   2. s'il n'existe qu'UNE classe dans ce niveau, elle est choisie — aucune
 *      ambiguïté possible ;
 *   3. sinon on apparie le « parallèle », c'est-à-dire le dernier mot du nom de
 *      classe (« 6ème A » → « a »). Un parallèle unique dans le niveau de
 *      destination l'emporte ;
 *   4. si l'appariement reste ambigu (aucun ou plusieurs candidats), l'élève est
 *      réinscrit **sans classe** (`class_id = null`) et compté dans le rapport
 *      de bascule. On ne l'affecte jamais au hasard ;
 *   5. au dernier rang de l'école, un admis est diplômé : il n'est pas réinscrit.
 *
 * Module volontairement PUR et hors du fichier `"use server"` (celui-ci ne peut
 * exporter que des fonctions asynchrones) : la logique de promotion est ainsi
 * testable sans doublure Supabase, et partagée par la prévisualisation et
 * l'exécution — une seule source de vérité, pas deux implémentations qui
 * divergent.
 */

export type ClassRef = {
  id: string
  name: string
  grade_level_id: string
}

export type GradeLevelRef = {
  id: string
  level: number
}

export type RolloverTarget =
  /** Non réinscrit : exclu par le conseil, ou sans décision. */
  | { kind: "skipped"; reason: "excluded" | "pending" }
  /** Dernier rang de l'école : l'élève sort diplômé, aucun enrollment créé. */
  | { kind: "graduated" }
  /** Réinscription : niveau de destination + classe (null si ambigu). */
  | { kind: "enrolled"; gradeLevelId: string; classId: string | null }

/** Dernier mot du nom, en minuscules : « 6ème A » → « a ». */
function parallelOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[parts.length - 1] ?? "").toLowerCase()
}

/**
 * Classe de destination dans `targetGradeLevelId`, ou `null` si le choix n'est
 * pas univoque (l'appelant compte alors l'élève comme « sans classe »).
 */
export function pickTargetClass(
  classes: readonly ClassRef[],
  targetGradeLevelId: string,
  sourceClassId: string | null
): string | null {
  const candidates = classes.filter((c) => c.grade_level_id === targetGradeLevelId)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].id

  const source = sourceClassId ? classes.find((c) => c.id === sourceClassId) : undefined
  if (source) {
    // Redoublant : le niveau ne change pas, on conserve la classe exacte.
    const same = candidates.find((c) => c.id === source.id)
    if (same) return same.id

    // Promu : le parallèle suit l'élève (« A » reste « A »).
    const parallel = parallelOf(source.name)
    const matches = candidates.filter((c) => parallelOf(c.name) === parallel)
    if (matches.length === 1) return matches[0].id
  }

  return null
}

/**
 * Décision complète pour un élève : rien (exclu / sans décision), diplômé, ou
 * réinscription avec niveau et classe de destination.
 */
export function resolveRolloverTarget(
  gradeLevels: readonly GradeLevelRef[],
  classes: readonly ClassRef[],
  student: {
    gradeLevelId: string
    classId: string | null
    decision: string
  }
): RolloverTarget {
  if (student.decision === "excluded") return { kind: "skipped", reason: "excluded" }
  if (student.decision !== "admitted" && student.decision !== "repeated") {
    return { kind: "skipped", reason: "pending" }
  }

  if (student.decision === "repeated") {
    return {
      kind: "enrolled",
      gradeLevelId: student.gradeLevelId,
      classId: pickTargetClass(classes, student.gradeLevelId, student.classId),
    }
  }

  // Admis : promotion au rang suivant.
  const current = gradeLevels.find((g) => g.id === student.gradeLevelId)
  if (!current) {
    // Niveau absent du référentiel (niveau supprimé ou mal configuré) : on ne
    // devine pas un rang, l'élève est réinscrit dans son niveau actuel.
    return {
      kind: "enrolled",
      gradeLevelId: student.gradeLevelId,
      classId: pickTargetClass(classes, student.gradeLevelId, student.classId),
    }
  }

  const next = gradeLevels.find((g) => g.level === current.level + 1)
  if (!next) return { kind: "graduated" }

  return {
    kind: "enrolled",
    gradeLevelId: next.id,
    classId: pickTargetClass(classes, next.id, student.classId),
  }
}
