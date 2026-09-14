import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function checkAuth(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false
  const token = authHeader.split(" ")[1]
  return token === process.env.TROUVETOU_API_KEY_PEPPER || token === process.env.TROUVETOU_API_KEY
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: schoolId } = await params

  try {
    const body = await request.json()
    const {
      level_id,
      student_full_name,
      parent_full_name,
      parent_phone,
      student_birthdate,
      parent_email
    } = body

    if (!level_id || !student_full_name || !parent_full_name || !parent_phone) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 })
    }

    // Vérifier que l'école est publiée
    const { data: school } = await supabase
      .from("schools")
      .select("published_to_trouvetou")
      .eq("id", schoolId)
      .single()

    if (!school || !school.published_to_trouvetou) {
      return NextResponse.json({ error: "École non trouvée ou non publiée" }, { status: 404 })
    }

    // Créer la réservation 'pending_payment'
    const { data: reservation, error } = await supabase
      .from("trouvetou_reservations")
      .insert({
        school_id: schoolId,
        grade_level_id: level_id,
        student_full_name,
        student_birthdate: student_birthdate || null,
        parent_full_name,
        parent_phone,
        parent_email: parent_email || null,
        status: "pending_payment"
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      reservation_id: reservation.id,
      status: "pending_payment"
    }, { status: 201 })

  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
}
