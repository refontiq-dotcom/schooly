import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: role } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", ["direction", "secretariat", "super_admin"])
      .maybeSingle()

    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const { reservation_id } = await request.json()
    if (!reservation_id) return NextResponse.json({ error: "reservation_id requis" }, { status: 400 })

    // Verifier que la reservation appartient a l ecole
    const { data: reservation } = await admin
      .from("trouvetou_reservations")
      .select("id, status, school_id")
      .eq("id", reservation_id)
      .maybeSingle()

    if (!reservation) return NextResponse.json({ error: "Reservation non trouvee" }, { status: 404 })
    if (role.role_code !== "super_admin" && reservation.school_id !== role.school_id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 403 })
    }
    if (reservation.status !== "reserved") {
      return NextResponse.json({ error: "La reserve n'est pas en statut 'reserve'" }, { status: 409 })
    }

    // Appeller finalize_reservation
    const { data: success, error } = await admin.rpc("finalize_reservation", {
      p_reservation_id: reservation_id,
    })

    if (error || !success) {
      return NextResponse.json({ error: "Echec de la finalisation" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
