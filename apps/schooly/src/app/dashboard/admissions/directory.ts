"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import {
  MAX_PAGE_SIZE,
  resolvePageRequest,
  type PageRequestOptions,
} from "@/lib/pagination"
import { parseQuery } from "@/lib/directory-search"
import {
  buildSearchHits,
  type DirectoryEnrollment,
  type DirectoryGuardian,
  type DirectoryPreEnrollment,
  type DirectorySnapshot,
  type DirectoryStudent,
  type SearchHit,
} from "@/lib/directory-index"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import { getPreEnrollments } from "./pre-enrollments"
import { getGuardians, getStudents } from "./people"
import { getEnrollments } from "./enrollments"

/**
 * Couverture du snapshot : permet à l'interface d'être honnête quand la
 * recherche locale ne voit pas toute l'école.
 */
export type DirectorySnapshotMeta = {
  /** Lignes réellement transportées (somme des quatre listes). */
  loaded: number
  /** Lignes connues en base (somme des `total` des quatre listes). */
  total: number
  /** `true` = snapshot borné : des personnes manquent à l'index local. */
  truncated: boolean
}

/**
 * Snapshot annuaire pour la recherche globale (header dashboard).
 * Regroupe élèves / tuteurs / inscriptions / pré-inscriptions de l'école
 * en un seul appel — le ranking/fuzzy est fait côté client (lib/directory-*).
 *
 * S2 : chaque liste est lue **bornée** en base (`opts.pageSize`, plafonné à
 * `MAX_PAGE_SIZE`) au lieu de rapatrier l'école entière à chaque ouverture du
 * ⌘K. Conséquence assumée : au-delà du plafond, la recherche locale ne couvre
 * plus tout l'annuaire — `meta.truncated` le signale à l'utilisateur plutôt que
 * de laisser croire à un annuaire exhaustif. La couverture complète suppose la
 * recherche côté Postgres (S3), pas un snapshot plus gros.
 */
export async function getDirectorySnapshot(opts?: PageRequestOptions) {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, {})
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const schoolId = guard.context.schoolId
  const { pageSize } = resolvePageRequest({
    pageSize: opts?.pageSize ?? MAX_PAGE_SIZE,
  })

  const [preRes, stuRes, guardRes, enrollRes] = await Promise.all([
    getPreEnrollments(schoolId, { pageSize }),
    getStudents(schoolId, { pageSize }),
    getGuardians(schoolId, { pageSize }),
    getEnrollments(schoolId, { pageSize }),
  ])

  const data = {
    students: stuRes.data ?? [],
    guardians: guardRes.data ?? [],
    enrollments: enrollRes.data ?? [],
    preEnrollments: preRes.data ?? [],
  }

  const loaded = Object.values(data).reduce((sum, rows) => sum + rows.length, 0)
  const total = [stuRes.total, guardRes.total, enrollRes.total, preRes.total].reduce(
    (sum, value) => sum + (value ?? 0),
    0
  )

  const meta: DirectorySnapshotMeta = {
    loaded,
    total,
    truncated: loaded < total,
  }

  return { data, meta }
}


/**
 * S3 : recherche d'annuaire filtrée en base, classée côté serveur.
 *
 * Répartition du travail : Postgres filtre (index trigram de la migration
 * 20260926000000), le serveur classe. Le classement réutilise
 * `buildSearchHits` à l'identique — même moteur de ranking, mêmes sous-titres,
 * mêmes tests — mais sur une poignée de lignes au lieu de toute l'école.
 *
 * Deux subtilités :
 * - un `.or()` par token, donc AND entre tokens et OR entre colonnes, ce qu'exige
 *   déjà le classement (tous les tokens doivent matcher) ;
 * - les sous-titres des hits reprennent matricule, niveau, classe et tuteur :
 *   il faut donc relire les inscriptions des personnes trouvées, et elles
 *   seules (bornées par `budget`).
 */
export async function searchDirectory(
  query: string,
  opts?: { limitPerKind?: number }
): Promise<
  | { data: { hits: SearchHit[]; mayHaveMore: boolean } }
  | { error: string }
> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, {})
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const parsed = parseQuery(query)
  if (parsed.tokens.length === 0 && !parsed.phone) {
    return { data: { hits: [], mayHaveMore: false } }
  }

  const schoolId = guard.context.schoolId
  const limitPerKind = Math.min(10, Math.max(1, Math.floor(opts?.limitPerKind ?? 5)))
  // Marge au-delà de `limitPerKind` : le classement doit avoir le choix.
  const budget = limitPerKind * 4

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let studentsQuery = admin
    .from("students")
    .select(
      `
      id, first_name, last_name,
      enrollments ( grade_level_id, class_id, grade_levels ( name ), classes ( name ) )
    `
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .limit(budget)
  for (const token of parsed.tokens) {
    studentsQuery = studentsQuery.or(
      `last_name.ilike.*${token}*,first_name.ilike.*${token}*`
    )
  }

  let guardiansQuery = admin
    .from("guardians")
    .select(
      `
      id, full_name, phone,
      enrollments ( student_id, students ( first_name, last_name ) )
    `
    )
    .or(`enrollments.school_id.eq.${schoolId}`)
    .is("deleted_at", null)
    .limit(budget)
  for (const token of parsed.tokens) {
    guardiansQuery = guardiansQuery.or(`full_name.ilike.*${token}*`)
  }
  if (parsed.phone) {
    guardiansQuery = guardiansQuery.or(`phone.ilike.*${parsed.phone}*`)
  }

  let preQuery = admin
    .from("pre_enrollments")
    .select("id, first_name, last_name, code, guardian_phone, grade_levels ( name )")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .limit(budget)
  for (const token of parsed.tokens) {
    preQuery = preQuery.or(
      `first_name.ilike.*${token}*,last_name.ilike.*${token}*,code.ilike.*${token}*`
    )
  }

  // Un matricule saisi par un parent doit sortir une inscription : ce filtre est
  // propre aux inscriptions, il ne dépend d'aucun token.
  let enrollmentQuery = admin
    .from("enrollments")
    .select(
      `
      id, student_id, matricule, status,
      students ( first_name, last_name ),
      guardians ( full_name, phone ),
      grade_levels ( name ),
      classes ( name )
    `
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .limit(budget)
  for (const token of parsed.tokens) {
    enrollmentQuery = enrollmentQuery.or(`matricule.ilike.*${token}*`)
  }

  const [studentsRes, guardiansRes, preRes, enrollmentsRes] = await Promise.all([
    studentsQuery,
    guardiansQuery,
    preQuery,
    enrollmentQuery,
  ])

  // Les embeds PostgREST reviennent en tableaux quand la relation est multiple :
  // le double cast est le motif déjà utilisé par les autres getters.
  const students = (studentsRes.data ?? []) as unknown as DirectoryStudent[]
  const guardians = (guardiansRes.data ?? []) as unknown as DirectoryGuardian[]
  const preEnrollments = (preRes.data ?? []) as unknown as DirectoryPreEnrollment[]
  const directEnrollments =
    (enrollmentsRes.data ?? []) as unknown as DirectoryEnrollment[]

  // Deuxième aller-retour : les inscriptions rattachées aux personnes trouvées,
  // pour que `buildSearchHits` puisse rattacher matricule et tuteur.
  const studentIds = students.map((student) => student.id)
  const guardianIds = guardians.map((guardian) => guardian.id)
  const relatedFilters = [
    studentIds.length ? `student_id.in.(${studentIds.join(",")})` : null,
    guardianIds.length ? `guardian_id.in.(${guardianIds.join(",")})` : null,
  ].filter((value): value is string => value !== null)

  const relatedRes =
    relatedFilters.length > 0
      ? await admin
          .from("enrollments")
          .select(
            `
            id, student_id, matricule, status,
            students ( first_name, last_name ),
            guardians ( full_name, phone ),
            grade_levels ( name ),
            classes ( name )
          `
          )
          .eq("school_id", schoolId)
          .is("deleted_at", null)
          .or(relatedFilters.join(","))
          .limit(budget * 2)
      : { data: [] }

  const byId = new Map<string, DirectoryEnrollment>()
  for (const row of [
    ...directEnrollments,
    ...((relatedRes.data ?? []) as unknown as DirectoryEnrollment[]),
  ]) {
    byId.set(row.id, row)
  }

  const snapshot: DirectorySnapshot = {
    students,
    guardians,
    enrollments: [...byId.values()],
    preEnrollments,
  }

  const hits = buildSearchHits(snapshot, query, limitPerKind)
  // Un plafond atteint signifie que des candidats ont été écartés : l'interface
  // doit proposer d'affiner plutôt que d'afficher « aucun résultat ».
  const mayHaveMore = [students, guardians, preEnrollments, directEnrollments].some(
    (rows) => rows.length >= budget
  )

  return { data: { hits, mayHaveMore } }
}
