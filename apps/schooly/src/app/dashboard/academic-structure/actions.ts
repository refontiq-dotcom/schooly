"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  ERROR_BY_REASON,
  requireSchoolRole,
  type SupabaseUserClient,
} from "@/utils/supabase/require-role"
import { STRUCTURE_ADMIN_ROLES } from "@/utils/supabase/roles"

export type ActionResult<T = void> = {
  error?: string
  data?: T
}

export type { SchoolRoleResult }

type SchoolRoleResult = { school_id: string | null; error: Error | null }

async function getSchoolId(supabase: SupabaseUserClient): Promise<SchoolRoleResult> {
  // Audit P2-2 : garde partagée requireSchoolRole + source unique des rôles.
  // La structure académique (années, niveaux, classes, matières, affectations)
  // est un acte de direction ou de secrétariat — pas une opération enseignante.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...STRUCTURE_ADMIN_ROLES] })
  if (!guard.ok) return { school_id: null, error: new Error(guard.reason) }
  return { school_id: guard.context.schoolId, error: null }
}

 /**
 * Contrat minimal du client service_role consommé par les contrôles
 * d'appartenance ci-dessous. `from` est volontairement lâche : typer
 * précisément la chaîne `.from().select().eq()` fait diverger les instanciations
 * de `SupabaseClient` selon le site d'appel (même justification que
 * utils/supabase/require-role.ts, qui documente ce choix).
 */
type AdminClient = { from: (table: string) => any }

/**
 * Vrai si la ligne référencée appartient bien à l'école de la session.
 *
 * Les identifiants (niveau, classe, matière, enseignant) arrivent du client.
 * Sans ce contrôle, un utilisateur pouvait rattacher un niveau ou une matière
 * d'une AUTRE école : le client service_role contourne la RLS et la clé
 * étrangère ne vérifie que l'existence de la ligne, pas son école. Le
 * cloisonnement reposait donc uniquement sur la bonne foi du formulaire.
 */
async function existsInSchool(
  admin: AdminClient,
  table: "grade_levels" | "classes" | "subjects",
  id: string,
  schoolId: string
): Promise<boolean> {
  const { data } = await admin
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()
  return Boolean(data)
}

/** Vrai si l'utilisateur est membre actif du personnel de cette école. */
async function isSchoolStaff(
  admin: AdminClient,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { data } = await admin
    .from("user_school_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

/** Vrai si l'utilisateur enseigne dans cette école. */
async function isSchoolTeacher(
  admin: AdminClient,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { data } = await admin
    .from("user_school_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("role_code", "professeur")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

export async function getAcademicYears(): Promise<ActionResult<{ id: string; label: string; status: string; start_date: string; end_date: string }[]>> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("academic_years")
    .select("id, label, status, start_date, end_date")
    .eq("school_id", roleData.school_id)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createAcademicYear(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const label = formData.get("label") as string
  const startDate = formData.get("startDate") as string
  const endDate = formData.get("endDate") as string

  if (!label || !startDate || !endDate) {
    return { error: "Label, date de début et date de fin sont requis." }
  }
  if (endDate < startDate) {
    return { error: "La date de fin doit suivre la date de début." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Index unique partiel `(school_id, label) where deleted_at is null`
  // (migration 20260917020000) : on teste donc avec le même filtre — une année
  // supprimée logiquement libère son libellé — et on renvoie un message en
  // français plutôt qu'une erreur SQL.
  const { data: duplicate } = await admin
    .from("academic_years")
    .select("id")
    .eq("school_id", roleData.school_id)
    .eq("label", label)
    .is("deleted_at", null)
    .maybeSingle()
  if (duplicate) return { error: `L'année « ${label} » existe déjà.` }

  // Toujours créée « planifiée » : UN SEUL chemin de mise en service, le RPC
  // atomique activate_academic_year (bouton « Activer »). L'insertion est donc
  // une écriture unique — plus de fenêtre où la clôture de l'année précédente
  // réussissait et l'activation échouait, laissant l'école sans année active.
  // L'index unique partiel (migration 20260917000000) garantit en base qu'une
  // école ne peut pas avoir deux années « en_cours ».
  const { error } = await admin.from("academic_years").insert({
    school_id: roleData.school_id,
    label,
    start_date: startDate,
    end_date: endDate,
    status: "planifiee",
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getGradeLevels() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("grade_levels")
    .select("*")
    .eq("school_id", roleData.school_id)
    .is("deleted_at", null)
    .order("level", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createGradeLevel(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const name = formData.get("name") as string
  const level = parseInt((formData.get("level") as string) || "0", 10)
  const cycle = formData.get("cycle") as string

  if (!name || !Number.isInteger(level) || level <= 0 || !cycle) {
    return { error: "Nom, rang (entier positif) et cycle sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Un seul niveau par rang dans une école : `level` est l'échelle d'ordre
  // utilisée par la bascule (promotion = rang + 1). Deux niveaux au même rang
  // rendaient la promotion arbitraire (la table rang → niveau en gardait un au
  // hasard des résultats). L'index unique partiel (migration 20260917010000)
  // le garantit en base ; on le vérifie ici pour un message clair.
  const { data: sameLevel, error: sameLevelErr } = await admin
    .from("grade_levels")
    .select("name")
    .eq("school_id", roleData.school_id)
    .eq("level", level)
    .is("deleted_at", null)
    .maybeSingle()

  if (sameLevelErr) return { error: sameLevelErr.message }
  if (sameLevel) {
    return { error: `Le rang ${level} est déjà utilisé par le niveau « ${sameLevel.name} ».` }
  }

  const { error } = await admin.from("grade_levels").insert({
    school_id: roleData.school_id,
    name,
    level,
    cycle,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getClasses() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("classes")
    .select(`
      *,
      grade_levels ( name ),
      users ( full_name )
    `)
    .eq("school_id", roleData.school_id)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createClass(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const gradeLevelId = formData.get("gradeLevelId") as string
  const name = formData.get("name") as string
  const rawCapacity = formData.get("capacity") as string | null
  const capacity = rawCapacity ? parseInt(rawCapacity, 10) : null
  const headTeacherId = (formData.get("headTeacherId") as string | null) || null

  if (!gradeLevelId || !name) {
    return { error: "Niveau et nom de classe sont requis." }
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return { error: "La capacité doit être un nombre entier positif." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (!(await existsInSchool(admin, "grade_levels", gradeLevelId, roleData.school_id))) {
    return { error: "Niveau introuvable dans cet établissement." }
  }
  if (headTeacherId && !(await isSchoolStaff(admin, headTeacherId, roleData.school_id))) {
    return { error: "Ce titulaire n'appartient pas au personnel de l'établissement." }
  }

  const { error } = await admin.from("classes").insert({
    school_id: roleData.school_id,
    grade_level_id: gradeLevelId,
    name,
    capacity,
    head_teacher_id: headTeacherId,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getSubjects() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("subjects")
    .select("*")
    .eq("school_id", roleData.school_id)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createSubject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const name = formData.get("name") as string
  const code = formData.get("code") as string | null
  const coefficient = parseFloat((formData.get("coefficient") as string) || "1")

  if (!name) {
    return { error: "Nom de la matière est requis." }
  }
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    return { error: "Le coefficient doit être un nombre strictement positif." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("subjects").insert({
    school_id: roleData.school_id,
    name,
    code,
    coefficient,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getClassSubjectAssignments() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Tri volontairement sur une colonne LOCALÉ (created_at) : trier sur une
  // ressource embarquée ne se fait pas via la chaîne `order`
  // ("classes ( name )" avec espaces faisait échouer la requête en 400, donc
  // matrice vide). Le tri d'affichage (classe puis matière) est fait côté
  // page, sur un tableau local — aucune dépendance à la syntaxe d'embed.
  const { data, error } = await admin
    .from("class_subject_assignments")
    .select(`
      *,
      classes ( name, grade_levels ( name ) ),
      subjects ( name ),
      users ( full_name )
    `)
    .eq("school_id", roleData.school_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createClassSubjectAssignment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const classId = formData.get("classId") as string
  const subjectId = formData.get("subjectId") as string
  const teacherId = (formData.get("teacherId") as string | null) || null
  const coefficient = parseFloat((formData.get("coefficient") as string) || "1")

  if (!classId || !subjectId) {
    return { error: "Classe et matière sont requises." }
  }
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    return { error: "Le coefficient doit être un nombre strictement positif." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Appartenance à l'école : les trois identifiants viennent du client.
  if (!(await existsInSchool(admin, "classes", classId, roleData.school_id))) {
    return { error: "Classe introuvable dans cet établissement." }
  }
  if (!(await existsInSchool(admin, "subjects", subjectId, roleData.school_id))) {
    return { error: "Matière introuvable dans cet établissement." }
  }
  if (teacherId && !(await isSchoolTeacher(admin, teacherId, roleData.school_id))) {
    return { error: "Ce professeur n'enseigne pas dans cet établissement." }
  }

  // Unicité (école, classe, matière) — index partiel de la migration
  // 20260917020000 : message clair plutôt qu'une erreur SQL brute.
  const { data: existing } = await admin
    .from("class_subject_assignments")
    .select("id")
    .eq("school_id", roleData.school_id)
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing) return { error: "Cette matière est déjà affectée à cette classe." }

  const { error } = await admin.from("class_subject_assignments").insert({
    school_id: roleData.school_id,
    class_id: classId,
    subject_id: subjectId,
    teacher_id: teacherId || null,
    coefficient,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

/**
 * Enseignants rattachés à l'école de la session.
 *
 * Le formulaire de la matrice classe × matière proposait un sélecteur
 * « Professeur » définitivement vide (aucune liste n'était chargée) : il était
 * impossible d'affecter un enseignant depuis l'interface. La liste vient de
 * `user_school_roles` (rôle « professeur » actif de CETTE école), pas d'un
 * annuaire global — un professeur d'une autre école ne doit pas apparaître.
 */
export async function getTeachersForSchool(): Promise<ActionResult<{ id: string; full_name: string }[]>> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: roles, error: rolesError } = await admin
    .from("user_school_roles")
    .select("user_id")
    .eq("school_id", roleData.school_id)
    .eq("role_code", "professeur")
    .eq("is_active", true)

  if (rolesError) return { error: rolesError.message, data: [] }
  if (!roles?.length) return { data: [] }

  const { data, error } = await admin
    .from("users")
    .select("id, full_name")
    .in("id", roles.map((r) => r.user_id))
    .is("deleted_at", null)
    .order("full_name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

// ─── Corriger / retirer un élément du référentiel ────────────────────────────
//
// Le module ne savait que CRÉER : une faute de frappe dans un nom de classe, un
// coefficient faux ou une matière obsolète étaient définitifs — alors que le
// cahier des charges impose « toute suppression est un soft-delete tracé » et
// que `deleted_at` existe sur chaque table du référentiel. Ces actions ferment
// ce trou ; AUCUNE ligne n'est supprimée, les inscriptions et notes passées
// continuent donc de résoudre les libellés.
//
// Règles communes : école de la session uniquement, rôle direction/secrétariat/
// super_admin (STRUCTURE_ADMIN_ROLES), et refus explicite plutôt que cascade
// silencieuse quand l'élément est encore utilisé.

function nowIso() {
  return new Date().toISOString()
}

/** Contexte d'écriture : session habilitée + client service_role + école. */
async function writeContext() {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...STRUCTURE_ADMIN_ROLES],
  })
  if (!guard.ok) return { ok: false as const, error: ERROR_BY_REASON[guard.reason] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  return { ok: true as const, admin, schoolId: guard.context.schoolId }
}

export async function updateSubject(formData: FormData): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const id = formData.get("id") as string
  const name = ((formData.get("name") as string) || "").trim()
  const code = ((formData.get("code") as string) || "").trim() || null
  const coefficient = parseFloat((formData.get("coefficient") as string) || "1")

  if (!id || !name) return { error: "Nom de la matière requis." }
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    return { error: "Le coefficient doit être un nombre strictement positif." }
  }

  // L'unicité porte sur les lignes vivantes (index partiel) et la ligne éditée
  // ne doit pas se bloquer elle-même → on l'exclut du contrôle.
  const { data: duplicate } = await admin
    .from("subjects")
    .select("id")
    .eq("school_id", schoolId)
    .eq("name", name)
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (duplicate) return { error: `Une matière « ${name} » existe déjà.` }

  const { data: updated, error } = await admin
    .from("subjects")
    .update({ name, code, coefficient })
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Matière introuvable." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function archiveSubject(subjectId: string): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  // Une matière encore enseignée quelque part doit d'abord être retirée de la
  // matrice. On refuse au lieu de cascader en silence : archiver ses
  // affectations changerait des moyennes de bulletins déjà calculées.
  const { data: assignment } = await admin
    .from("class_subject_assignments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("subject_id", subjectId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle()
  if (assignment) {
    return {
      error:
        "Cette matière est encore affectée à une ou plusieurs classes : retirez d'abord ces affectations dans la matrice.",
    }
  }

  const { data: archived, error } = await admin
    .from("subjects")
    .update({ deleted_at: nowIso() })
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!archived?.length) return { error: "Matière introuvable (déjà archivée ?)." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function updateClass(formData: FormData): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const id = formData.get("id") as string
  const name = ((formData.get("name") as string) || "").trim()
  const rawCapacity = formData.get("capacity") as string | null
  const capacity = rawCapacity ? parseInt(rawCapacity, 10) : null
  const headTeacherId = (formData.get("headTeacherId") as string | null) || null

  if (!id || !name) return { error: "Nom de classe requis." }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return { error: "La capacité doit être un nombre entier positif." }
  }

  const { data: duplicate } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .eq("name", name)
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (duplicate) return { error: `Une classe « ${name} » existe déjà.` }

  if (headTeacherId && !(await isSchoolStaff(admin, headTeacherId, schoolId))) {
    return { error: "Ce titulaire n'appartient pas au personnel de l'établissement." }
  }

  const { data: updated, error } = await admin
    .from("classes")
    .update({ name, capacity, head_teacher_id: headTeacherId })
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Classe introuvable." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function archiveClass(classId: string): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const { data: assignment } = await admin
    .from("class_subject_assignments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle()
  if (assignment) {
    return {
      error:
        "Cette classe a encore des matières affectées : retirez d'abord ces lignes de la matrice.",
    }
  }

  // Élèves inscrits dans cette classe SUR L'ANNÉE ACTIVE : on refuse (la classe
  // sert à l'appel et aux moyennes). Les inscrits des années passées ne
  // bloquent pas — archiver ne doit pas réécrire l'histoire, seulement vider
  // les menus.
  const { data: activeYear } = await admin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "en_cours")
    .is("deleted_at", null)
    .maybeSingle()

  if (activeYear?.id) {
    const { data: enrolled } = await admin
      .from("enrollments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("academic_year_id", activeYear.id)
      .eq("class_id", classId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle()
    if (enrolled) {
      return {
        error:
          "Des élèves sont inscrits dans cette classe pour l'année en cours : déplacez-les d'abord.",
      }
    }
  }

  const { data: archived, error } = await admin
    .from("classes")
    .update({ deleted_at: nowIso() })
    .eq("id", classId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!archived?.length) return { error: "Classe introuvable (déjà archivée ?)." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function updateGradeLevel(formData: FormData): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const id = formData.get("id") as string
  const name = ((formData.get("name") as string) || "").trim()
  const cycle = ((formData.get("cycle") as string) || "").trim()
  const level = parseInt((formData.get("level") as string) || "0", 10)

  if (!id || !name || !cycle) return { error: "Nom et cycle sont requis." }
  if (!Number.isInteger(level) || level <= 0) {
    return { error: "Le rang doit être un entier positif (ordre croissant : 1 = première année)." }
  }

  const { data: sameLevel } = await admin
    .from("grade_levels")
    .select("name")
    .eq("school_id", schoolId)
    .eq("level", level)
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (sameLevel) return { error: `Le rang ${level} est déjà utilisé par le niveau « ${sameLevel.name} ».` }

  const { data: current } = await admin
    .from("grade_levels")
    .select("level")
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!current) return { error: "Niveau introuvable." }

  // Le rang détermine la promotion : le déplacer alors que des élèves y sont
  // inscrits les ferait promouvoir vers un autre niveau. Nom et cycle restent
  // modifiables à tout moment.
  if (current.level !== level) {
    const { data: enrolled } = await admin
      .from("enrollments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("grade_level_id", id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle()
    if (enrolled) {
      return {
        error:
          "Des élèves sont inscrits à ce niveau : son rang ne peut plus être modifié (il détermine la promotion).",
      }
    }
  }

  const { data: updated, error } = await admin
    .from("grade_levels")
    .update({ name, level, cycle })
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Niveau introuvable." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function archiveGradeLevel(levelId: string): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const { data: liveClass } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .eq("grade_level_id", levelId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle()
  if (liveClass) {
    return { error: "Ce niveau contient encore des classes : archivez-les d'abord." }
  }

  const { data: archived, error } = await admin
    .from("grade_levels")
    .update({ deleted_at: nowIso() })
    .eq("id", levelId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!archived?.length) return { error: "Niveau introuvable (déjà archivé ?)." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function archiveAcademicYear(yearId: string): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const { data: year } = await admin
    .from("academic_years")
    .select("id, status")
    .eq("id", yearId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!year) return { error: "Année introuvable." }

  if (year.status === "en_cours") {
    return {
      error: "L'année en cours ne peut pas être archivée : activez d'abord une autre année.",
    }
  }

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", yearId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle()
  if (enrollment) {
    return {
      error:
        "Cette année compte des inscriptions : elle ne peut pas être archivée (elle porte l'historique des élèves).",
    }
  }

  const { data: archived, error } = await admin
    .from("academic_years")
    .update({ deleted_at: nowIso() })
    .eq("id", yearId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!archived?.length) return { error: "Année introuvable (déjà archivée ?)." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function updateClassSubjectAssignment(formData: FormData): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const id = formData.get("id") as string
  const teacherId = (formData.get("teacherId") as string | null) || null
  const coefficient = parseFloat((formData.get("coefficient") as string) || "1")

  if (!id) return { error: "Affectation introuvable." }
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    return { error: "Le coefficient doit être un nombre strictement positif." }
  }
  if (teacherId && !(await isSchoolTeacher(admin, teacherId, schoolId))) {
    return { error: "Ce professeur n'enseigne pas dans cet établissement." }
  }

  const { data: updated, error } = await admin
    .from("class_subject_assignments")
    .update({ teacher_id: teacherId, coefficient })
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Affectation introuvable." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function archiveClassSubjectAssignment(id: string): Promise<ActionResult> {
  const ctx = await writeContext()
  if (!ctx.ok) return { error: ctx.error }
  const { admin, schoolId } = ctx

  const { data: archived, error } = await admin
    .from("class_subject_assignments")
    .update({ deleted_at: nowIso() })
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { error: error.message }
  if (!archived?.length) return { error: "Affectation introuvable (déjà retirée ?)." }

  revalidatePath("/dashboard/academic-structure")
  return {}
}
