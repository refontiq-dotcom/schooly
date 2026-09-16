"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

// ============================================================================
// Contexte de sécurité
// Le RLS actuel ne couvre que le personnel (is_school_member). Les parents sont
// des `guardians` liés au compte auth PAR EMAIL. Toutes les lectures/écritures
// passent donc par un client admin (service role) MAIS toujours scopées par le
// guardian_id / enrollment_id dérivés du compte connecté — jamais par un id
// envoyé par le client sans vérification.
// ============================================================================

type AdminClient = SupabaseClient<any, "public", "public", any, any>

async function requireGuardian() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("UNAUTHENTICATED")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, full_name, phone, email")
    .eq("email", user.email)
    .is("deleted_at", null)
    .maybeSingle()

  if (!guardian) throw new Error("NO_GUARDIAN_PROFILE")



  return { admin, guardian, user }
}

// ---------------------------------------------------------------- types ----
export type Child = {
  enrollmentId: string
  studentId: string
  studentName: string
  matricule: string | null
  className: string | null
  classId: string | null
  gradeLevel: string
  yearLabel: string
  schoolName: string
}

export type PaymentItem = {
  id: string
  amount: number
  method: string
  reference: string | null
  receivedAt: string
}

export type ReceiptItem = {
  receiptNumber: string
  verificationCode: string
  issuedAt: string
  amount: number
}

export type FinanceData = {
  totalDue: number
  totalPaid: number
  pending: number
  lastPaymentAt: string | null
  payments: PaymentItem[]
  receipts: ReceiptItem[]
}

export type HomeworkItem = {
  id: string
  title: string
  description: string | null
  dueDate: string
  subject: string
  teacher: string | null
}

export type GradeItem = {
  id: string
  label: string
  gradeType: string
  value: number
  maxValue: number
  weight: number
  subject: string
  comment: string | null
}

export type MoratoriumItem = {
  id: string
  reason: string
  requestedAmount: number
  approvedAmount: number | null
  status: string
  dueDate: string
  requestedAt: string
}

export type ParentDashboardData = {
  guardianName: string
  children: Child[]
  selectedChild: Child | null
  finance: FinanceData | null
  homeworks: HomeworkItem[]
  grades: GradeItem[]
  generalAverage: number | null
  moratoriums: MoratoriumItem[]
}

// ============================================================================
// PARTIE 2 — Lecture du tableau de bord parent
// ============================================================================

type EnrollmentRow = {
  id: string
  matricule: string | null
  status: string
  school_id: string
  grade_level_id: string
  academic_year_id: string
  financial_profile_id: string | null
  class_id: string | null
  students: { id: string; first_name: string; last_name: string } | null
  classes: { name: string } | null
  grade_levels: { name: string; cycle: string } | null
  academic_years: { label: string } | null
  schools: { name: string } | null
}

function toChild(e: EnrollmentRow): Child {
  return {
    enrollmentId: e.id,
    studentId: e.students?.id ?? "",
    studentName: `${e.students?.first_name ?? ""} ${e.students?.last_name ?? ""}`.trim(),
    matricule: e.matricule,
    className: e.classes?.name ?? null,
    classId: e.class_id,
    gradeLevel: e.grade_levels?.name ?? "—",
    yearLabel: e.academic_years?.label ?? "—",
    schoolName: e.schools?.name ?? "—",
  }
}

export type DashboardResult =
  | { ok: true; data: ParentDashboardData }
  | { ok: false; code: "UNAUTHENTICATED" | "NO_GUARDIAN_PROFILE" | "NOT_YOUR_CHILD" | "DB_ERROR" }

async function loadChildren(
  admin: AdminClient,
  guardianId: string
) {
  const { data, error } = await admin
    .from("enrollments")
    .select(
      `id, matricule, status, school_id, grade_level_id, academic_year_id,
       financial_profile_id, class_id,
       students ( id, first_name, last_name ),
       classes ( name ),
       grade_levels ( name, cycle ),
       academic_years ( label ),
       schools ( name )`
    )
    .eq("guardian_id", guardianId)
    .is("deleted_at", null)
    .order("enrollment_date", { ascending: false })

  if (error) return null
  return (data ?? []) as unknown as (EnrollmentRow & {
    students: { id: string; first_name: string; last_name: string } | null
  })[]
}

async function loadFinance(
  admin: AdminClient,
  child: EnrollmentRow
): Promise<FinanceData> {
  // Total dû : tarif standard (profil null) ou profil financier dédié de l'inscription
  const { data: fees } = await admin
    .from("fee_schedules")
    .select("amount, financial_profile_id")
    .eq("school_id", child.school_id)
    .eq("grade_level_id", child.grade_level_id)
    .eq("academic_year_id", child.academic_year_id)
    .is("deleted_at", null)

  const feeRows = (fees ?? []) as unknown as { amount: number; financial_profile_id: string | null }[]
  const matchingProfile = child.financial_profile_id
    ? feeRows.find((f) => f.financial_profile_id === child.financial_profile_id)
    : undefined
  const standardRow = feeRows.find((f) => f.financial_profile_id === null)
  const totalDue = matchingProfile?.amount ?? standardRow?.amount ?? 0

  // Paiements
  const { data: payments } = await admin
    .from("payments")
    .select("id, amount, payment_method, reference, received_at")
    .eq("enrollment_id", child.id)
    .is("deleted_at", null)
    .order("received_at", { ascending: false })

  const paymentRows = (payments ?? []) as unknown as { id: string; amount: number; payment_method: string; reference: string | null; received_at: string }[]
  const totalPaid = paymentRows.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)

  // Reçus (le montant vit sur payments, receipts ne porte que le numéro)
  const amountByPayment = new Map(paymentRows.map((p) => [p.id, Number(p.amount ?? 0)]))
  let receipts: ReceiptItem[] = []
  if (paymentRows.length > 0) {
    const { data: rc } = await admin
      .from("receipts")
      .select("receipt_number, verification_code, issued_at, payment_id")
      .in("payment_id", paymentRows.map((p) => p.id))
      .is("deleted_at", null)
      .order("issued_at", { ascending: false })

    const rcRows = (rc ?? []) as unknown as { receipt_number: string; verification_code: string; issued_at: string; payment_id: string }[]
    receipts = rcRows.map((r) => ({
      receiptNumber: r.receipt_number,
      verificationCode: r.verification_code,
      issuedAt: r.issued_at,
      amount: amountByPayment.get(r.payment_id) ?? 0,
    }))
  }

  return {
    totalDue,
    totalPaid,
    pending: Math.max(totalDue - totalPaid, 0),
    lastPaymentAt: paymentRows[0]?.received_at ?? null,
    payments: paymentRows.map((p) => ({
      id: p.id,
      amount: Number(p.amount ?? 0),
      method: p.payment_method,
      reference: p.reference,
      receivedAt: p.received_at,
    })),
    receipts,
  }
}

export async function getDashboardData(
  selectedEnrollmentId?: string
): Promise<DashboardResult> {
  try {
    const { admin, guardian } = await requireGuardian()

    const rows = await loadChildren(admin, guardian.id)
    if (rows === null) return { ok: false, code: "DB_ERROR" }

    const children = rows.map(toChild)
    const selected =
      children.find((c) => c.enrollmentId === selectedEnrollmentId) ?? children[0] ?? null

    if (!selected) {
      return {
        ok: true,
        data: {
          guardianName: guardian.full_name,
          children: [],
          selectedChild: null,
          finance: null,
          homeworks: [],
          grades: [],
          generalAverage: null,
          moratoriums: [],
        },
      }
    }

    const selectedRow = rows.find((r) => r.id === selected.enrollmentId)!

    // Devoirs publiés de la classe
    let homeworks: HomeworkItem[] = []
    if (selectedRow.class_id) {
      const { data: hws } = await admin
        .from("homeworks")
        .select("id, title, description, due_date, subjects ( name ), users ( full_name )")
        .eq("class_id", selectedRow.class_id)
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("due_date", { ascending: true })
        .limit(30)

      homeworks = (hws ?? []).map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        dueDate: h.due_date,
                subject: (Array.isArray(h.subjects) && h.subjects.length > 0
          ? (h.subjects[0] as any).name
          : h.subjects
            ? (h.subjects as any)?.name ?? "—"
            : "—"),
        teacher: (Array.isArray(h.users) && h.users.length > 0
          ? (h.users[0] as any).full_name
          : h.users
            ? (h.users as any)?.full_name ?? null
            : null),
      }))
    }

    // Notes + moyenne générale pondérée (normalisée /20)
    const { data: gr } = await admin
      .from("grade_entries")
      .select("id, label, value, max_value, weight, comment, subjects ( name )")
      .eq("enrollment_id", selected.enrollmentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    const grades: GradeItem[] = (gr ?? []).map((g) => ({
      id: g.id,
      label: g.label,
      value: Number(g.value),
      maxValue: Number(g.max_value),
      weight: Number(g.weight),
      subject: (g.subjects as any)?.name ?? "—",
      comment: g.comment,
    })) as GradeItem[]

    let weightedSum = 0
    let totalWeight = 0
    for (const g of grades) {
      weightedSum += (g.value / g.maxValue) * 20 * g.weight
      totalWeight += g.weight
    }
    const generalAverage = totalWeight > 0 ? weightedSum / totalWeight : null

    // Moratoires du guardian (tous enfants)
    const { data: mors } = await admin
      .from("moratoriums")
      .select("id, reason, requested_amount, approved_amount, status, due_date, requested_at")
      .eq("guardian_id", guardian.id)
      .is("deleted_at", null)
      .order("requested_at", { ascending: false })

    const moratoriums: MoratoriumItem[] = (mors ?? []).map((m) => ({
      id: m.id,
      reason: m.reason,
      requestedAmount: Number(m.requested_amount),
      approvedAmount: m.approved_amount === null ? null : Number(m.approved_amount),
      status: m.status,
      dueDate: m.due_date,
      requestedAt: m.requested_at,
    }))

    const finance = await loadFinance(admin, selectedRow)

    return {
      ok: true,
      data: {
        guardianName: guardian.full_name,
        children,
        selectedChild: selected,
        finance,
        homeworks,
        grades,
        generalAverage,
        moratoriums,
      },
    }
  } catch (err) {
    if (err instanceof Error) {
      return { ok: false, code: err.message as "UNAUTHENTICATED" | "NO_GUARDIAN_PROFILE" }
    }
    return { ok: false, code: "DB_ERROR" }
  }
}

export type SubjectAverage = {
  subject: string
  average: number | null
  count: number
}

export type BulletinData = {
  child: Child
  schoolCity: string | null
  grades: GradeItem[]
  subjectAverages: SubjectAverage[]
  generalAverage: number | null
  decision: string
  observations: string | null
  councilAverage: number | null
}

export type BulletinResult =
  | { ok: true; data: BulletinData }
  | { ok: false; code: "UNAUTHENTICATED" | "NO_GUARDIAN_PROFILE" | "NOT_YOUR_CHILD" | "DB_ERROR" }

export async function getBulletinData(enrollmentId: string): Promise<BulletinResult> {
  try {
    const { admin, guardian } = await requireGuardian()

    // L'inscription DOIT appartenir au guardian connecté — jamais d'id client naïf.
    const { data: rows, error } = await admin
      .from("enrollments")
      .select(
        `id, matricule, status, school_id, grade_level_id, academic_year_id,
         financial_profile_id, class_id,
         students ( id, first_name, last_name ),
         classes ( name ),
         grade_levels ( name, cycle ),
         academic_years ( label ),
         schools ( name )`
      )
      .eq("guardian_id", guardian.id)
      .eq("id", enrollmentId)
      .is("deleted_at", null)
      .limit(1)

    if (error) return { ok: false, code: "DB_ERROR" }
        const row = (rows ?? [])[0] as unknown as (EnrollmentRow & { school_id: string; academic_year_id: string }) | undefined
    if (!row) return { ok: false, code: "NOT_YOUR_CHILD" }

    const child = toChild(row)

    // Notes de l'inscription
    const { data: gr, error: grError } = await admin
      .from("grade_entries")
      .select("id, label, value, max_value, weight, comment, subjects ( name )")
      .eq("enrollment_id", enrollmentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })

    if (grError) return { ok: false, code: "DB_ERROR" }

    const grades: GradeItem[] = (gr ?? []).map((g) => ({
      id: g.id,
      label: g.label,
      value: Number(g.value),
      maxValue: Number(g.max_value),
      weight: Number(g.weight),
      subject: (g.subjects as any)?.name ?? "—",
      comment: g.comment,
    })) as GradeItem[]
    // Moyennes par matière (notes normalisées /20, pondérées) + moyenne générale
    const bySubject = new Map<string, { sum: number; weight: number; count: number }>()
    let weightedSum = 0
    let totalWeight = 0
    for (const g of grades) {
      const normalized = (g.value / g.maxValue) * 20
      const entry = bySubject.get(g.subject) ?? { sum: 0, weight: 0, count: 0 }
      entry.sum += normalized * g.weight
      entry.weight += g.weight
      entry.count += 1
      bySubject.set(g.subject, entry)
      weightedSum += normalized * g.weight
      totalWeight += g.weight
    }
    const subjectAverages: SubjectAverage[] = Array.from(bySubject.entries())
      .map(([subject, e]) => ({
        subject,
        average: e.weight > 0 ? e.sum / e.weight : null,
        count: e.count,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, "fr"))
    const generalAverage = totalWeight > 0 ? weightedSum / totalWeight : null

    // Décision du conseil de classe (dernière pour l'année de l'inscription)
    const { data: decisionRow } = await admin
      .from("academic_decisions")
      .select("decision, observations, average")
      .eq("enrollment_id", enrollmentId)
      .eq("academic_year_id", row.academic_year_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)

    // Ville de l'école (affichée sur le bulletin)
    const { data: schoolRow } = await admin
      .from("schools")
      .select("city")
      .eq("id", row.school_id)
      .maybeSingle()

    return {
      ok: true,
      data: {
        child,
        schoolCity: schoolRow?.city ?? null,
        grades,
        subjectAverages,
        generalAverage,
        decision: decisionRow?.[0]?.decision ?? "pending",
        observations: decisionRow?.[0]?.observations ?? null,
        councilAverage:
          decisionRow?.[0]?.average === null || decisionRow?.[0]?.average === undefined
            ? null
            : Number(decisionRow[0].average),
      },
    }
  } catch (err) {
    if (err instanceof Error) {
      return { ok: false, code: err.message as "UNAUTHENTICATED" | "NO_GUARDIAN_PROFILE" }
    }
    return { ok: false, code: "DB_ERROR" }
  }
}
export type MoratoriumResult =
  | { ok: true }
  | {
      ok: false
      code: "UNAUTHENTICATED" | "NO_GUARDIAN_PROFILE" | "NOT_YOUR_CHILD" | "VALIDATION" | "DB_ERROR"
      message?: string
    }

export async function requestMoratorium(formData: FormData): Promise<MoratoriumResult> {
  try {
    const { admin, guardian } = await requireGuardian()

    const enrollmentId = String(formData.get("enrollmentId") ?? "")
    const reason = String(formData.get("reason") ?? "").trim()
    const requestedAmount = Number(formData.get("requestedAmount") ?? 0)
    const notes = String(formData.get("notes") ?? "").trim()

    if (!enrollmentId || reason.length < 5 || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Enfant, motif (5 caractères min.) et montant valide sont requis.",
      }
    }

    // Vérifier que l'inscription appartient bien au guardian connecté
    const { data: owned, error: ownedError } = await admin
      .from("enrollments")
      .select("id, school_id")
      .eq("id", enrollmentId)
      .eq("guardian_id", guardian.id)
      .is("deleted_at", null)
      .limit(1)

    if (ownedError) return { ok: false, code: "DB_ERROR" }
    const enrollment = (owned ?? [])[0]
    if (!enrollment) return { ok: false, code: "NOT_YOUR_CHILD" }

    // Échéance par défaut : +30 jours
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { error: insertError } = await admin.from("moratoriums").insert({
      school_id: enrollment.school_id,
      enrollment_id: enrollment.id,
      guardian_id: guardian.id,
      reason,
      requested_amount: Math.round(requestedAmount),
      due_date: dueDate,
      status: "pending",
      notes: notes || null,
    })

    if (insertError) return { ok: false, code: "DB_ERROR" }
    return { ok: true }
  } catch (err) {
    if (err instanceof Error) {
      return { ok: false, code: err.message as "UNAUTHENTICATED" | "NO_GUARDIAN_PROFILE" }
    }
    return { ok: false, code: "DB_ERROR" }
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
