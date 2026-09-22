import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseCyclesOffered } from "@/lib/fiches/normalize"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

function checkAuth(request: Request) {
  const value = request.headers.get("authorization")
  if (!value?.startsWith("Bearer ")) return false
  const token = value.slice(7)
  return token === process.env.TROUVETOU_API_KEY_PEPPER || token === process.env.TROUVETOU_API_KEY
}
const clean = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : ""
function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id: schoolId } = await params
  try {
    const body = await request.json()
    const levelId = clean(body.level_id, 80)
    const formation = clean(body.formation, 40)
    const studentFullName = clean(body.student_full_name)
    const parentFullName = clean(body.parent_full_name)
    const parentPhone = clean(body.parent_phone, 40)
    const studentBirthdate = clean(body.student_birthdate, 10)
    const parentEmail = clean(body.parent_email, 160)

    if (!levelId || !formation || !studentFullName || !parentFullName || !parentPhone || !studentBirthdate)
      return NextResponse.json({ error: "Nom de l'élève, date de naissance, formation, niveau, parent et téléphone sont obligatoires." }, { status: 400 })
    if (!validDate(studentBirthdate)) return NextResponse.json({ error: "Date de naissance invalide." }, { status: 400 })
    if (parentEmail && !/^\S+@\S+\.\S+$/.test(parentEmail)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 })

    const { data: school } = await supabase.from("schools").select("id, published_to_trouvetou").eq("id", schoolId).is("deleted_at", null).maybeSingle()
    if (!school?.published_to_trouvetou) return NextResponse.json({ error: "École non trouvée ou non publiée" }, { status: 404 })

    const { data: ficheSchool } = await supabase.from("schools").select("cycles_offered").eq("id", schoolId).maybeSingle()
    const cycles = ficheSchool ? parseCyclesOffered(ficheSchool.cycles_offered) : null
    const selectedCycle = cycles?.cycles.find((cycle) => cycle.key === formation)
    if (!selectedCycle) return NextResponse.json({ error: "Formation invalide pour cet établissement." }, { status: 400 })

    const { data: levelById } = await supabase.from("grade_levels").select("id, name").eq("id", levelId).eq("school_id", schoolId).is("deleted_at", null).maybeSingle()
    const { data: levelByName } = !levelById ? await supabase.from("grade_levels").select("id, name").eq("name", levelId).eq("school_id", schoolId).is("deleted_at", null).maybeSingle() : { data: null }
    const level = levelById ?? levelByName
    if (!level) return NextResponse.json({ error: "Niveau scolaire invalide pour cet établissement." }, { status: 400 })
    const selectedLevel = selectedCycle.levels.find((item) => item.grade_level_name.trim().toLowerCase() === String(level.name).trim().toLowerCase())
    if (!selectedLevel) return NextResponse.json({ error: "Ce niveau ne correspond pas à la formation choisie." }, { status: 400 })

    const { data: reservation, error } = await supabase.from("trouvetou_reservations").insert({
      school_id: schoolId, grade_level_id: levelId, student_full_name: studentFullName,
      student_birthdate: studentBirthdate, parent_full_name: parentFullName, parent_phone: parentPhone,
      parent_email: parentEmail || null, status: "pending_payment"
    }).select("id, status, created_at").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, reservation_id: reservation.id, status: reservation.status, created_at: reservation.created_at, next_step: "payment", formation: { key: selectedCycle.key, label: selectedCycle.label }, level: { id: level.id, label: level.name } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
}