"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

// ============================================================================
// Contexte de sécurité
// Le RLS actuel ne couvre que le personnel (is_school_member). Les parents sont
// des `guardians` liés au compte auth PAR EMAIL. Toutes les lectures/écritures
// passent donc par un client admin (service role) MAIS toujours scopées par le
// guardian_id / enrollment_id dérivés du compte connecté — jamais par un id
// envoyé par le client sans vérification.
// ============================================================================

export class ParentPortalError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

async function requireGuardian() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new ParentPortalError("UNAUTHENTICATED")

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

  if (!guardian) throw new ParentPortalError("NO_GUARDIAN_PROFILE")

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

// __APPEND__
