import { NextResponse } from "next/server"
import { TROUVETOU_FINALIZE_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const clean = (value: unknown, max = 80) =>
  typeof value === "string" ? value.trim().slice(0, max) : ""

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    )
    const { data: role, error: roleError } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", [...TROUVETOU_FINALIZE_ROLES])
      .maybeSingle()

    if (roleError) return NextResponse.json({ error: "Impossible de vérifier les autorisations." }, { status: 500 })
    if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

    const body = await request.json()
    const reservationId = clean(body.reservation_id)
    if (!reservationId) return NextResponse.json({ error: "reservation_id requis" }, { status: 400 })

    const { data: reservation, error: reservationError } = await admin
      .from("trouvetou_reservations")
      .select("id, school_id, status")
      .eq("id", reservationId)
      .maybeSingle()

    if (reservationError) return NextResponse.json({ error: "Impossible de lire cette demande." }, { status: 500 })
    if (!reservation) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 })
    if (role.role_code !== "super_admin" && reservation.school_id !== role.school_id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }
    const reservationFields = "id, status, created_at, qr_code_token, expires_at, student_full_name, student_birthdate, parent_full_name, parent_phone, parent_email"

    if (reservation.status === "reserved") {
      const { data: existing } = await admin
        .from("trouvetou_reservations")
        .select(reservationFields)
        .eq("id", reservationId)
        .maybeSingle()
      return NextResponse.json({
        success: true,
        reservation: existing ?? { id: reservationId, status: "reserved" },
        reused: true,
      })
    }
    if (reservation.status !== "requested") {
      return NextResponse.json({ error: "Seules les demandes à confirmer peuvent être réservées." }, { status: 409 })
    }

    const { data: reserved, error: reserveError } = await admin.rpc("reserve_seat", {
      p_reservation_id: reservationId,
      p_payment_ref: null,
      p_amount: null,
    })
    if (reserveError) {
      console.error("[Trouvetou admin confirm]", reserveError.message)
      return NextResponse.json({ error: "La réservation de la place n'a pas pu être effectuée." }, { status: 500 })
    }

    const { data: updated } = await admin
      .from("trouvetou_reservations")
      .select(reservationFields)
      .eq("id", reservationId)
      .maybeSingle()

    if (reserved !== true && updated?.status !== "reserved") {
      return NextResponse.json({
        error: "Capacité non configurée ou niveau complet. Vérifiez les classes et les places disponibles avant de confirmer.",
        code: "CAPACITY_NOT_AVAILABLE",
      }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      reservation: updated ?? { id: reservationId, status: "reserved" },
      reused: reserved !== true,
    })
  } catch (error) {
    console.error("[Trouvetou admin confirm]", error)
    return NextResponse.json({ error: "Une erreur est survenue pendant la confirmation." }, { status: 500 })
  }
}
