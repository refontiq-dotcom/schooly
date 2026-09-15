"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export type DashboardMetrics = {
  schoolName: string
  academicYearLabel: string | null
  activeStudents: number
  collectedThisMonth: number
  configuredClasses: number
  expectedForYear: number
  collectedForYear: number
  recoveryRate: number | null
}

const EMPTY_METRICS: Omit<DashboardMetrics, "schoolName"> = {
  academicYearLabel: null,
  activeStudents: 0,
  collectedThisMonth: 0,
  configuredClasses: 0,
  expectedForYear: 0,
  collectedForYear: 0,
  recoveryRate: null,
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("NOT_AUTHENTICATED")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: role } = await supabase
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!role?.school_id) throw new Error("UNAUTHORIZED")

  const schoolId = role.school_id

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single()

  const schoolName = school?.name ?? "Schooly"

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [classesResult, monthPaymentsResult] = await Promise.all([
    admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    admin
      .from("payments")
      .select("amount")
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .gte("received_at", monthStart.toISOString()),
  ])

  const configuredClasses = classesResult.count ?? 0
  const collectedThisMonth = (monthPaymentsResult.data ?? []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  )

  const { data: years } = await admin
    .from("academic_years")
    .select("id, label, status")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })

  const currentYear =
    (years ?? []).find((y) => y.status === "en_cours") ?? (years ?? [])[0]

  if (!currentYear) {
    return {
      ...EMPTY_METRICS,
      schoolName,
      collectedThisMonth,
      configuredClasses,
    }
  }

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, grade_level_id, financial_profile_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", currentYear.id)
    .eq("status", "active")
    .is("deleted_at", null)

  const enrollmentRows = enrollments ?? []
  const enrollmentIds = enrollmentRows.map((e) => e.id)

  const [feeSchedulesResult, yearPaymentsResult] = await Promise.all([
    admin
      .from("fee_schedules")
      .select("grade_level_id, financial_profile_id, amount")
      .eq("school_id", schoolId)
      .eq("academic_year_id", currentYear.id)
      .is("deleted_at", null),
    enrollmentIds.length > 0
      ? admin
          .from("payments")
          .select("amount")
          .eq("school_id", schoolId)
          .is("deleted_at", null)
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [] as { amount: number }[] }),
  ])

  const feeKey = (gradeId: string | null, profileId: string | null) =>
    `${gradeId ?? ""}::${profileId ?? ""}`

  const feeByGradeAndProfile = new Map<string, number>()
  for (const fee of feeSchedulesResult.data ?? []) {
    feeByGradeAndProfile.set(
      feeKey(fee.grade_level_id, fee.financial_profile_id),
      fee.amount || 0
    )
  }

  const expectedForYear = enrollmentRows.reduce(
    (sum, e) =>
      sum + (feeByGradeAndProfile.get(feeKey(e.grade_level_id, e.financial_profile_id)) ?? 0),
    0
  )

  const collectedForYear = (yearPaymentsResult.data ?? []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  )

  const recoveryRate =
    expectedForYear > 0
      ? Math.min(100, Math.round((collectedForYear / expectedForYear) * 100))
      : null

  return {
    schoolName,
    academicYearLabel: currentYear.label,
    activeStudents: enrollmentRows.length,
    collectedThisMonth,
    configuredClasses,
    expectedForYear,
    collectedForYear,
    recoveryRate,
  }
}
