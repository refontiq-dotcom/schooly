import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const sharedSecret = process.env.METRICS_PUSH_SECRET

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: Request) {
  if (!sharedSecret || req.headers.get("authorization") !== `Bearer ${sharedSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const admin = getAdmin()
  const [{ data: access, error: accessError }, { data: schools, error: schoolsError }] = await Promise.all([
    admin.from("school_billing_access")
      .select("school_id,status,billable_students,billed_amount,covered_amount,remaining_amount,oldest_unpaid_at,days_overdue,last_evaluated_at")
      .order("remaining_amount", { ascending: false }),
    admin.from("schools").select("id,name,city").is("deleted_at", null).order("name"),
  ])

  if (accessError || schoolsError) {
    console.error("[Control Center billing overview]", accessError || schoolsError)
    return NextResponse.json({ error: "Impossible de charger le recouvrement" }, { status: 500 })
  }

  const schoolMap = new Map((schools ?? []).map((school) => [school.id, school]))
  const rows = (access ?? []).map((row) => ({
    ...row,
    school_name: schoolMap.get(row.school_id)?.name ?? "Établissement inconnu",
    city: schoolMap.get(row.school_id)?.city ?? null,
  }))

  return NextResponse.json({ rows, evaluatedAt: new Date().toISOString() })
}
