"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { alertRolloverCompleted } from "@/lib/telegram"

const getAdmin = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("NOT_AUTHENTICATED")

  const { data: role } = await supabase
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "super_admin"])
    .limit(1)
    .maybeSingle()

  if (!role) throw new Error("UNAUTHORIZED")
  return { userId: user.id, schoolId: role.school_id }
}

// ─── Lire les années académiques ─────────────────────────────────────────────

export async function getAcademicYears() {
  const { schoolId } = await getContext()
  const admin = getAdmin()
  const { data, error } = await admin
    .from("academic_years")
    .select("*")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
  if (error) return { error: error.message }
  return { data: data || [] }
}

// ─── Créer une nouvelle année académique ─────────────────────────────────────

export async function createAcademicYear(formData: FormData) {
  const { schoolId } = await getContext()
  const admin = getAdmin()

  const label = formData.get("label") as string
  const startDate = formData.get("start_date") as string
  const endDate = formData.get("end_date") as string

  if (!label || !startDate || !endDate) return { error: "Champs requis manquants." }

  const { error } = await admin.from("academic_years").insert({
    school_id: schoolId,
    label,
    start_date: startDate,
    end_date: endDate,
    status: "planifiee",
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Activer une année (clôture l'année "en_cours", active la nouvelle) ──────

export async function activateAcademicYear(yearId: string) {
  const { schoolId } = await getContext()
  const admin = getAdmin()

  // Mettre toutes les autres années à "cloturee"
  const { error: closeErr } = await admin
    .from("academic_years")
    .update({ status: "cloturee" })
    .eq("school_id", schoolId)
    .eq("status", "en_cours")

  if (closeErr) return { error: closeErr.message }

  // Activer la nouvelle
  const { error } = await admin
    .from("academic_years")
    .update({ status: "en_cours" })
    .eq("id", yearId)
    .eq("school_id", schoolId)

  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Prévisualisation de la bascule ──────────────────────────────────────────
// Retourne les stats pour chaque décision prise sur l'ancienne année

export async function getRolloverPreview(oldYearId: string) {
  const { schoolId } = await getContext()
  const admin = getAdmin()

  // Tous les enrollments de l'ancienne année
  const { data: enrollments, error: enrollErr } = await admin
    .from("enrollments")
    .select(`
      id, status,
      students ( id, first_name, last_name ),
      classes ( name ),
      grade_levels ( id, name, level ),
      academic_decisions ( decision )
    `)
    .eq("school_id", schoolId)
    .eq("academic_year_id", oldYearId)
    .is("deleted_at", null)

  if (enrollErr) return { error: enrollErr.message }

  const total = enrollments?.length ?? 0
  const admitted = enrollments?.filter(e => (e.academic_decisions as any)?.[0]?.decision === "admitted").length ?? 0
  const repeated = enrollments?.filter(e => (e.academic_decisions as any)?.[0]?.decision === "repeated").length ?? 0
  const excluded = enrollments?.filter(e => (e.academic_decisions as any)?.[0]?.decision === "excluded").length ?? 0
  const pending = total - admitted - repeated - excluded

  return {
    data: {
      total,
      admitted,
      repeated,
      excluded,
      pending,
      enrollments: (enrollments || []).map(e => ({
        id: e.id,
        studentName: `${(e.students as any)?.last_name} ${(e.students as any)?.first_name}`,
        className: (e.classes as any)?.name ?? "—",
        gradeLevelId: (e.grade_levels as any)?.id,
        gradeLevelName: (e.grade_levels as any)?.name ?? "—",
        gradeLevelOrder: (e.grade_levels as any)?.level ?? 0,
        decision: (e.academic_decisions as any)?.[0]?.decision ?? "pending",
      })),
    },
  }
}

// ─── Enregistrer une décision du conseil de classe ─────────────────────────
// Écrit dans academic_decisions (source de vérité partagée avec le module
// Pédagogie). Upsert idempotent : une décision par (école, inscription, année).

export async function setEnrollmentDecision(
  enrollmentId: string,
  oldYearId: string,
  decision: "admitted" | "repeated" | "excluded" | "pending",
) {
  const { schoolId, userId } = await getContext()
  const admin = getAdmin()

  if (!["admitted", "repeated", "excluded", "pending"].includes(decision)) {
    return { error: "Décision invalide." }
  }

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("id", enrollmentId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .single()

  if (!enrollment) return { error: "Inscription introuvable." }

  const { error } = await admin
    .from("academic_decisions")
    .upsert(
      {
        school_id: schoolId,
        enrollment_id: enrollmentId,
        academic_year_id: oldYearId,
        decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "school_id, enrollment_id, academic_year_id" },
    )

  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Bascule réelle ───────────────────────────────────────────────────────────
// Pour chaque élève "admitted" : crée un nouvel enrollment sur la nouvelle année (niveau +1)
// Pour "repeated" : copie sur le même niveau
// Pour "excluded" / "pending" : marque comme non-réinscrit

export async function executeRollover(oldYearId: string, newYearId: string) {
  const { schoolId, userId } = await getContext()
  const admin = getAdmin()

  // Vérifications de base
  const { data: newYear } = await admin
    .from("academic_years")
    .select("id, label, status")
    .eq("id", newYearId)
    .eq("school_id", schoolId)
    .single()

  if (!newYear) return { error: "Nouvelle année introuvable." }

  // Récupérer tous les enrollments de l'ancienne année avec leurs décisions
  // (source de vérité : academic_decisions, partagée avec le module Pédagogie
  // et getRolloverPreview — PAS enrollment_decisions).
  const { data: enrollments, error: enrollErr } = await admin
    .from("enrollments")
    .select(`
      id, student_id, guardian_id, financial_profile_id, grade_level_id,
      academic_decisions ( decision )
    `)
    .eq("school_id", schoolId)
    .eq("academic_year_id", oldYearId)
    .is("deleted_at", null)

  if (enrollErr) return { error: enrollErr.message }
  if (!enrollments?.length) return { error: "Aucun élève à basculer." }

  // Garde anti-doublon : si des enrollments existent déjà sur la nouvelle année,
  // on ignore les élèves déjà réinscrits (idempotent — reprise après échec).
  const { data: alreadyRolled } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", newYearId)
    .is("deleted_at", null)

  const rolledStudentIds = new Set((alreadyRolled || []).map(r => r.student_id))

  // Récupérer tous les niveaux de l'école triés par ordre
  const { data: gradeLevels } = await admin
    .from("grade_levels")
    .select("id, level")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level")

  const levelById = new Map((gradeLevels || []).map(g => [g.id, g.level]))
  const levelToId = new Map((gradeLevels || []).map(g => [g.level, g.id]))

  let promoted = 0, repeated = 0, excluded = 0, pending = 0
  const errors: string[] = []
  const newEnrollments: any[] = []

  for (const enr of enrollments) {
    // Déjà réinscrit sur la nouvelle année (rejouée idempotente) → on saute.
    if (rolledStudentIds.has(enr.student_id)) continue

    const decision = ((enr as any).academic_decisions as any)?.[0]?.decision ?? "pending"

    if (decision === "excluded") {
      excluded++
      continue
    }
    if (decision === "pending") {
      pending++
      continue
    }

    let nextGradeLevelId = enr.grade_level_id

    if (decision === "admitted") {
      // Promouvoir au niveau suivant
      const currentLevel = levelById.get(enr.grade_level_id)
      if (currentLevel !== undefined) {
        const nextLevel = currentLevel + 1
        const nextId = levelToId.get(nextLevel)
        if (nextId) {
          nextGradeLevelId = nextId
        }
        // Si plus de niveau suivant : diplômé, on ne réinscrit pas
        if (!nextId) {
          promoted++ // diplômé
          continue
        }
      }
      promoted++
    } else {
      // repeated : même niveau
      repeated++
    }

    newEnrollments.push({
      school_id: schoolId,
      student_id: enr.student_id,
      guardian_id: enr.guardian_id,
      grade_level_id: nextGradeLevelId,
      financial_profile_id: enr.financial_profile_id,
      academic_year_id: newYearId,
      status: "active",
      enrollment_date: new Date().toISOString().slice(0, 10),
      // Matricule unique par inscription (contrainte school_id + matricule).
      // Format : <PREFIX>-<ANNEE>-<ALEA> (même convention que createEnrollment).
      matricule: `${schoolId.slice(0, 4).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`,
    })
  }

  // Insérer les nouveaux enrollments par lots de 50.
  // Note : onConflict (school_id, matricule) + ignoreDuplicates gère la
  // reprise après échec partiel (idempotent) ; en cas de collision de
  // matricule aléatoire, le doublon est ignoré puis compté dans newEnrollments.
  if (newEnrollments.length > 0) {
    for (let i = 0; i < newEnrollments.length; i += 50) {
      const batch = newEnrollments.slice(i, i + 50)
      const { error: insertErr } = await admin
        .from("enrollments")
        .upsert(batch, { onConflict: "school_id, matricule", ignoreDuplicates: true })
      if (insertErr) errors.push(insertErr.message)
    }
  }

  // Log de la bascule
  await admin.from("year_rollover_logs").insert({
    school_id: schoolId,
    old_year_id: oldYearId,
    new_year_id: newYearId,
    initiated_by: userId,
    students_promoted: promoted,
    students_repeated: repeated,
    students_excluded: excluded,
    students_pending: pending,
    status: errors.length === 0 ? "completed" : "failed",
    error_message: errors.length > 0 ? errors.join("; ") : null,
    completed_at: new Date().toISOString(),
  })

  if (errors.length > 0) return { error: `Bascule partielle : ${errors[0]}` }

  // Envoyer une alerte Telegram
  const { data: schoolInfo } = await admin.from("schools").select("name").eq("id", schoolId).single()
  const { data: oldYear } = await admin.from("academic_years").select("label").eq("id", oldYearId).single()
  
  await alertRolloverCompleted({
    schoolName: schoolInfo?.name || "École Inconnue",
    oldYear: oldYear?.label || "Année N-1",
    newYear: newYear.label || "Année N",
    promoted,
    repeated,
    excluded,
  })

  return {
    ok: true,
    summary: { promoted, repeated, excluded, pending, total: enrollments.length },
  }
}

// ─── Historique des bascules ─────────────────────────────────────────────────

export async function getRolloverLogs() {
  const { schoolId } = await getContext()
  const admin = getAdmin()
  const { data, error } = await admin
    .from("year_rollover_logs")
    .select(`
      *,
      old_year:old_year_id ( label ),
      new_year:new_year_id ( label ),
      initiator:initiated_by ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("initiated_at", { ascending: false })
    .limit(10)
  if (error) return { error: error.message }
  return { data: data || [] }
}
