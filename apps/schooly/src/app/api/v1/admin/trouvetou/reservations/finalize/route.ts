import { NextResponse } from "next/server"
import { TROUVETOU_FINALIZE_ROLES } from "@/utils/supabase/roles"
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
      .in("role_code", [...TROUVETOU_FINALIZE_ROLES])
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
    const { data: details } = await admin
      .from("trouvetou_reservations")
      .select("student_birthdate")
      .eq("id", reservation_id)
      .single()

    if (!details?.student_birthdate) {
      return NextResponse.json({ error: "Date de naissance de l'élève manquante. Ouvre la qualification pour la compléter." }, { status: 422 })
    }

    const { data: success, error } = await admin.rpc("finalize_reservation", {
      p_reservation_id: reservation_id,
    })

    if (error) {
      console.error("[Trouvetou Finalize]", error)
      return NextResponse.json({ error: "La finalisation a échoué. Vérifie l'année académique en cours et les informations du dossier." }, { status: 422 })
    }
    if (!success) {
      return NextResponse.json({ error: "Le dossier ne peut pas encore être finalisé. Vérifie les informations obligatoires." }, { status: 422 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
