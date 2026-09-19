import { NextResponse } from "next/server"
import { TROUVETOU_FINALIZE_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}
const clean = (v: unknown, max = 180) => typeof v === "string" ? v.trim().slice(0, max) : ""

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const { data: role } = await admin.from("user_school_roles").select("school_id, role_code").eq("user_id", user.id).eq("is_active", true).in("role_code", [...TROUVETOU_FINALIZE_ROLES]).maybeSingle()
    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const body = await request.json()
    const id = clean(body.reservation_id, 80)
    const { data: reservation } = await admin.from("trouvetou_reservations").select("id, school_id, status").eq("id", id).maybeSingle()
    if (!reservation) return NextResponse.json({ error: "Reservation non trouvee" }, { status: 404 })
    if (role.role_code !== "super_admin" && reservation.school_id !== role.school_id) return NextResponse.json({ error: "Non autorise" }, { status: 403 })
    if (!["pending_payment", "reserved"].includes(reservation.status)) return NextResponse.json({ error: "Cette demande ne peut plus être modifiée." }, { status: 409 })

    const studentFullName = clean(body.student_full_name)
    const studentBirthdate = clean(body.student_birthdate, 10)
    const parentFullName = clean(body.parent_full_name)
    const parentPhone = clean(body.parent_phone, 40)
    const parentEmail = clean(body.parent_email, 160)
    if (!studentFullName || !studentBirthdate || !validDate(studentBirthdate) || !parentFullName || !parentPhone)
      return NextResponse.json({ error: "Nom élève, date de naissance, parent et téléphone sont obligatoires." }, { status: 400 })

    const { data: updated, error } = await admin.from("trouvetou_reservations").update({
      student_full_name: studentFullName, student_birthdate: studentBirthdate,
      parent_full_name: parentFullName, parent_phone: parentPhone,
      parent_email: parentEmail || null, updated_at: new Date().toISOString()
    }).eq("id", id).select("id, student_full_name, student_birthdate, parent_full_name, parent_phone, parent_email, status, updated_at").single()
    if (error) throw error
    return NextResponse.json({ success: true, reservation: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}