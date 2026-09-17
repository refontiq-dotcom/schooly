"use server"

import { createClient } from "@/utils/supabase/server"
import { ROLLOVER_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { alertRolloverCompleted } from "@/lib/telegram"
import { resolveRolloverTarget } from "./class-assignment"

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
    .in("role_code", [...ROLLOVER_ROLES])
    .limit(1)
    .maybeSingle()

  if (!role) throw new Error("UNAUTHORIZED")
  return { userId: user.id, schoolId: role.school_id }
}

// ─── Lecture / création des années ─────────────────────────────────────────
// Volontairement absentes de ce fichier : `getAcademicYears` et
// `createAcademicYear` n'existent plus qu'à UN endroit — actions.ts, module
// Structure académique. Le panneau de bascule en entretenait une seconde copie
// divergente (champs `start_date`/`end_date` au lieu de `startDate`/`endDate`,
// statut forcé, filtre deleted_at présent), donc deux formulaires de création
// sur la même page écrivant la même table avec deux contrats différents.

/** Messages des gardes de session, côté lecture (aucune exception remontée). */
const GUARD_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Session expirée — reconnectez-vous.",
  UNAUTHORIZED: "Action réservée à la direction.",
}

function guardMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : ""
  return GUARD_MESSAGES[raw] ?? (raw || "Action impossible.")
}

/**
 * Droit d'exécuter la bascule, testable sans exception.
 * Le panneau l'interroge avant d'appeler les actions réservées à la direction
 * (ROLLOVER_ROLES) : sans ce test, un membre du secrétariat — pourtant autorisé
 * à consulter la page — voyait un écran vide, l'action rejetant en silence.
 */
export async function canRunRollover(): Promise<{ allowed: boolean; error?: string }> {
  try {
    await getContext()
    return { allowed: true }
  } catch (err) {
    return { allowed: false, error: guardMessage(err) }
  }
}

// ─── Activer une année (clôture l'année "en_cours", active la nouvelle) ──────

export async function activateAcademicYear(yearId: string) {
  // Pas d'exception ici : l'onglet « Années » est accessible au secrétariat,
  // qui ne peut pas activer. Il doit lire pourquoi, pas rester devant rien.
  let schoolId: string
  try {
    schoolId = (await getContext()).schoolId
  } catch (err) {
    return { error: guardMessage(err) }
  }
  const admin = getAdmin()

  // Tenant AVANT le RPC : le client service_role appelle avec auth.uid() nul,
  // donc le RPC saute sa propre garde de rôle. Sans ce contrôle, un UUID
  // d'année d'une autre école activait (et clôturait) cette année-là.
  const { data: year } = await admin
    .from("academic_years")
    .select("school_id")
    .eq("id", yearId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!year || year.school_id !== schoolId) {
    return { error: "Année introuvable." }
  }

  // RPC atomique (migration 20260917000000) : clôture de l'ancienne année +
  // activation de la nouvelle en UNE transaction. Avant : deux updates séparés,
  // si le second échouait l'école restait sans aucune année active (notes et
  // appel bloqués). Le RPC garantit aussi une seule année "en_cours" par école.
  const { data, error } = await admin.rpc("activate_academic_year", {
    p_year_id: yearId,
  })

  if (error) {
    const code = String(error.message).split(":")[0]?.trim()
    const messages: Record<string, string> = {
      YEAR_NOT_FOUND: "Année introuvable.",
      YEAR_CLOSED: "Une année clôturée ne peut pas être réactivée.",
      UNAUTHORIZED: "Action réservée à la direction.",
    }
    return { error: messages[code] ?? error.message }
  }

  return { ok: true, status: typeof data === "string" ? data : undefined }
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
      id, status, class_id,
      students ( id, first_name, last_name ),
      classes ( name ),
      grade_levels ( id, name, level ),
      academic_decisions ( decision )
    `)
    .eq("school_id", schoolId)
    .eq("academic_year_id", oldYearId)
    .in("status", ["confirmed", "active"])
    .is("deleted_at", null)

  if (enrollErr) return { error: enrollErr.message }

  // Référentiels nécessaires au calcul de la DESTINATION (niveau + classe) :
  // exactement les mêmes règles que l'exécution, via le module pur
  // class-assignment — la prévisualisation ne peut donc pas annoncer autre
  // chose que ce que la bascule fera.
  const [{ data: gradeLevels }, { data: classes }] = await Promise.all([
    admin.from("grade_levels").select("id, level").eq("school_id", schoolId).is("deleted_at", null),
    admin.from("classes").select("id, name, grade_level_id").eq("school_id", schoolId).is("deleted_at", null),
  ])

  const classNames = new Map((classes ?? []).map((c) => [c.id, c.name]))

  const rows = (enrollments || []).map((e) => {
    const decision = (e.academic_decisions as any)?.[0]?.decision ?? "pending"
    const target = resolveRolloverTarget(gradeLevels ?? [], classes ?? [], {
      gradeLevelId: (e.grade_levels as any)?.id,
      classId: (e as any).class_id ?? null,
      decision,
    })
    return {
      id: e.id,
      studentName: `${(e.students as any)?.last_name} ${(e.students as any)?.first_name}`,
      className: (e.classes as any)?.name ?? "—",
      gradeLevelId: (e.grade_levels as any)?.id,
      gradeLevelName: (e.grade_levels as any)?.name ?? "—",
      gradeLevelOrder: (e.grade_levels as any)?.level ?? 0,
      decision,
      targetStatus: target.kind,
      targetClassId: target.kind === "enrolled" ? target.classId : null,
      targetClassName:
        target.kind === "enrolled" && target.classId
          ? classNames.get(target.classId) ?? null
          : null,
    }
  })

  // Combien d'élèves seront réinscrits SANS classe : annoncé AVANT la bascule,
  // c'est l'information qui manquait (elle n'apparaissait nulle part, et sans
  // classe un élève est invisible des listes de classe, moyennes et appels).
  const withoutClass = rows.filter(
    (r) => r.targetStatus === "enrolled" && r.targetClassId === null
  ).length
  const graduated = rows.filter((r) => r.targetStatus === "graduated").length

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
      withoutClass,
      graduated,
      enrollments: rows,
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
    .select("id, academic_year_id")
    .eq("id", enrollmentId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .single()

  if (!enrollment) return { error: "Inscription introuvable." }

  // L'année de la décision est celle de L'INSCRIPTION, jamais celle annoncée
  // par le formulaire : `oldYearId` vient du client. Sans ce contrôle, une
  // décision pouvait être écrite sur une autre année — or la bascule lit la
  // décision via l'embed de l'inscription, donc une décision mal rattachée
  // était quand même appliquée (promotion d'un élève sur la mauvaise décision).
  if (enrollment.academic_year_id !== oldYearId) {
    return { error: "Cette inscription n'appartient pas à l'année sélectionnée." }
  }

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

  // Garde-fous sur le couple source/destination : rejouer la même année ferait
  // « basculer » les élèves vers l'année où ils sont déjà (tout le monde serait
  // ignoré par la garde anti-doublon, mais un journal « réussi » à 0 élève
  // laisserait croire à une bascule effectuée), et réinscrire dans une année
  // clôturée produit des inscriptions dans une année close.
  if (oldYearId === newYearId) {
    return { error: "L'année source et l'année de destination doivent être différentes." }
  }
  if (newYear.status === "cloturee") {
    return { error: "Impossible de réinscrire dans une année clôturée." }
  }

  // Récupérer tous les enrollments de l'ancienne année avec leurs décisions
  // (source de vérité : academic_decisions, partagée avec le module Pédagogie
  // et getRolloverPreview — PAS enrollment_decisions).
  const { data: enrollments, error: enrollErr } = await admin
    .from("enrollments")
    .select(`
      id, student_id, guardian_id, financial_profile_id, grade_level_id, class_id, matricule,
      academic_decisions ( decision )
    `)
    .eq("school_id", schoolId)
    .eq("academic_year_id", oldYearId)
    .in("status", ["confirmed", "active"])
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

  // Référentiels nécessaires : niveaux (rang suivant) et CLASSES (destination).
  const { data: gradeLevels } = await admin
    .from("grade_levels")
    .select("id, level")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level")

  // La classe est un objet d'école réutilisé d'année en année : sans ce
  // renseignement, chaque élève basculé arrivait avec class_id null, donc
  // invisible des listes de classe, des moyennes de classe et de l'appel.
  const { data: classes } = await admin
    .from("classes")
    .select("id, name, grade_level_id")
    .eq("school_id", schoolId)
    .is("deleted_at", null)

  let promoted = 0, repeated = 0, excluded = 0, pending = 0, withoutClass = 0
  const errors: string[] = []
  const newEnrollments: any[] = []

  for (const enr of enrollments) {
    // Déjà réinscrit sur la nouvelle année (rejouée idempotente) → on saute.
    if (rolledStudentIds.has(enr.student_id)) continue

    const decision = ((enr as any).academic_decisions as any)?.[0]?.decision ?? "pending"

    // Une SEULE source de vérité pour la promotion (niveau + classe), partagée
    // avec getRolloverPreview : module pur class-assignment.
    const target = resolveRolloverTarget(gradeLevels ?? [], classes ?? [], {
      gradeLevelId: enr.grade_level_id,
      classId: (enr as any).class_id ?? null,
      decision,
    })

    if (target.kind === "skipped") {
      if (target.reason === "excluded") excluded++
      else pending++
      continue
    }

    if (decision === "admitted") promoted++
    else repeated++

    // Dernier rang de l'école : diplômé, aucune réinscription.
    if (target.kind === "graduated") continue

    // Appariement ambigu : réinscrit sans classe, compté dans le rapport — la
    // direction le place ensuite, jamais d'affectation au hasard.
    if (target.classId === null) withoutClass++

    newEnrollments.push({
      school_id: schoolId,
      student_id: enr.student_id,
      guardian_id: enr.guardian_id,
      grade_level_id: target.gradeLevelId,
      class_id: target.classId,
      financial_profile_id: enr.financial_profile_id,
      academic_year_id: newYearId,
      // Réinscription : pas 'confirmed' (le trigger handle_enrollment_confirmed
      // facturerait à nouveau la plateforme). 'active' est le défaut du schéma
      // et est déjà accepté par les lectures (dashboard, Trouvetou, caisse).
      status: "active",
      enrollment_date: new Date().toISOString().slice(0, 10),
      // Matricule d'État de l'élève : on le RECOPIE, on n'en invente pas un.
      matricule: (enr as { matricule?: string | null }).matricule ?? null,
    })
  }

  // Un seul INSERT : une requête = une transaction Postgres. Les lots de 50
  // laissaient une bascule partielle (lot 1 écrit, lot 2 en échec). La reprise
  // après échec reste gérée par rolledStudentIds.
  if (newEnrollments.length > 0) {
    const { error: insertErr } = await admin.from("enrollments").insert(newEnrollments)
    if (insertErr) errors.push(insertErr.message)
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
    students_without_class: withoutClass,
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
    summary: { promoted, repeated, excluded, pending, withoutClass, total: enrollments.length },
  }
}

// ─── Historique des bascules ─────────────────────────────────────────────────

export async function getRolloverLogs() {
  const { schoolId } = await getContext()
  const admin = getAdmin()
  // Embeds PostgREST avec hint de relation FK obligatoire : year_rollover_logs
  // possède DEUX FK vers academic_years (old_year_id, new_year_id) — sans hint
  // explicite (table!colonne), l'embed est ambigu et la requête échoue en 400.
  // C'est le bug qui laissait l'historique de bascule vide en permanence.
  const { data, error } = await admin
    .from("year_rollover_logs")
    .select(`
      *,
      old_year:academic_years!year_rollover_logs_old_year_id_fkey ( label ),
      new_year:academic_years!year_rollover_logs_new_year_id_fkey ( label ),
      initiator:users!year_rollover_logs_initiated_by_fkey ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("initiated_at", { ascending: false })
    .limit(10)
  if (error) return { error: error.message }
  return { data: data || [] }
}
