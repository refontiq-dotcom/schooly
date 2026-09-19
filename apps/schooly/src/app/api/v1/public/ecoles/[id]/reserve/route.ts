import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function checkAuth(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false
  const token = authHeader.split(" ")[1]
  return token === process.env.TROUVETOU_API_KEY_PEPPER || token === process.env.TROUVETOU_API_KEY
}

/**
 * POST /api/v1/public/ecoles/[id]/reserve
 *
 * Confirmation post-paiement depuis Trouvetou.
 * Appelle reserve_seat() pour bloquer la place.
 *
 * Body: { reservation_id: string, payment_reference: string, amount: number }
 */
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
    const { reservation_id, payment_reference, amount } = body

    if (!reservation_id || !payment_reference || !amount) {
      return NextResponse.json({ error: "Parametres manquants" }, { status: 400 })
    }

    // Verifier que l ecole est publiee
    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .eq("published_to_trouvetou", true)
      .maybeSingle()

    if (!school) {
      return NextResponse.json({ error: "Ecole non trouvee ou non publiee" }, { status: 404 })
    }

    // Verifier que la reservation appartient a cette ecole
    const { data: reservation } = await supabase
      .from("trouvetou_reservations")
      .select("id, status")
      .eq("id", reservation_id)
      .eq("school_id", schoolId)
      .maybeSingle()

    if (!reservation) {
      return NextResponse.json({ error: "Reservation non trouvee" }, { status: 404 })
    }

    if (reservation.status !== "pending_payment") {
      return NextResponse.json({ error: "Reservation deja traitee" }, { status: 409 })
    }

    // Appeller reserve_seat
    const { data: success, error } = await supabase.rpc("reserve_seat", {
      p_reservation_id: reservation_id,
      p_payment_ref: payment_reference,
      p_amount: amount,
    })

    if (error || !success) {
      return NextResponse.json({ error: "Echec de la reservation" }, { status: 500 })
    }

    // Recuperer la reservation mise a jour
    const { data: updated } = await supabase
      .from("trouvetou_reservations")
      .select("id, status, qr_code_token, expires_at")
      .eq("id", reservation_id)
      .single()

    return NextResponse.json({
      success: true,
      reservation: {
        id: updated!.id,
        status: updated!.status,
        qr_code: updated!.qr_code_token,
        expires_at: updated!.expires_at,
      },
    })
  } catch (err: any) {
    console.error("[Trouvetou Reserve] Error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
