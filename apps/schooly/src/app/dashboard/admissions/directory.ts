"use server"

import { createClient } from "@/utils/supabase/server"
import {
  MAX_PAGE_SIZE,
  resolvePageRequest,
  type PageRequestOptions,
} from "@/lib/pagination"
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
