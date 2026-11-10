import { NextResponse } from "next/server"
import { isTrouvetouRequest } from "@/lib/trouvetou-auth"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const clean = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : ""
function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

async function reserveWithoutPayment(reservationId: string) {
  const { data, error } = await supabase.rpc("reserve_seat", {
    p_reservation_id: reservationId,
    p_payment_ref: null,
    p_amount: null,
  })
  if (error) {
    console.error("[Trouvetou Schooly reserve_seat]", error.message)
    return { success: false, error: true }
  }
  return { success: data === true, error: false }
}

async function responseForExisting(reservation: {
  id: string
  status: string
  created_at: string
  qr_code_token?: string | null
  expires_at?: string | null
}, level: { id: string; name: string }) {
  if (reservation.status === "pending_payment") {
    const reserved = await reserveWithoutPayment(reservation.id)
    if (reserved.error) {
      return NextResponse.json({ error: "La réservation n'a pas pu être finalisée. Réessayez avec la même demande." }, { status: 500 })
    }
    if (!reserved.success) {
      const { data: current } = await supabase
        .from("trouvetou_reservations")
        .select("id, status, created_at, qr_code_token, expires_at")
        .eq("id", reservation.id)
        .maybeSingle()
      if (current && (current.status === "reserved" || current.status === "confirmed")) {
        reservation = current
      } else {
        if (current?.status === "pending_payment") {
          await supabase.from("trouvetou_reservations").update({ status: "expired" }).eq("id", reservation.id)
        }
        return NextResponse.json({ error: "Ce niveau ne dispose plus de place disponible.", code: "LEVEL_FULL" }, { status: 409 })
      }
    } else {
      const { data: updated, error } = await supabase
        .from("trouvetou_reservations")
        .select("id, status, created_at, qr_code_token, expires_at")
        .eq("id", reservation.id)
        .single()
      if (error || !updated) return NextResponse.json({ error: "La réservation a été créée mais son état ne peut pas être confirmé." }, { status: 502 })
      reservation = updated
    }
  }

  if (reservation.status === "reserved" && reservation.expires_at && new Date(reservation.expires_at) <= new Date()) {
    await supabase.from("trouvetou_reservations").update({ status: "expired" }).eq("id", reservation.id)
    return NextResponse.json({ error: "Cette réservation a expiré. Envoyez une nouvelle demande.", code: "RESERVATION_EXPIRED" }, { status: 409 })
  }

  if (reservation.status === "expired") {
    return NextResponse.json({ error: "Cette réservation a expiré. Envoyez une nouvelle demande.", code: "RESERVATION_EXPIRED" }, { status: 409 })
  }

  const seatReserved = reservation.status === "reserved" || reservation.status === "confirmed"
  return NextResponse.json({
    success: true,
    reservation_id: reservation.id,
    status: reservation.status,
    created_at: reservation.created_at,
    qr_code: reservation.qr_code_token ?? null,
    expires_at: reservation.expires_at ?? null,
    next_step: "school_contact",
    payment_required: false,
    availability_confirmed: seatReserved,
    level: { id: level.id, label: level.name },
    reused: true,
  }, { status: 200 })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrouvetouRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id: schoolId } = await params
  try {
    const body = await request.json()
    const levelId = clean(body.level_id, 80)
    const studentFullName = clean(body.student_full_name)
    const parentFullName = clean(body.parent_full_name)
    const parentPhone = clean(body.parent_phone, 40)
    const studentBirthdate = clean(body.student_birthdate, 10)
    const parentEmail = clean(body.parent_email, 160)
    const rawIdempotencyKey = body.idempotency_key
    const idempotencyKey = typeof rawIdempotencyKey === "string" && UUID_PATTERN.test(rawIdempotencyKey)
      ? rawIdempotencyKey
      : null

    if (!levelId || !studentFullName || !parentFullName || !parentPhone || !studentBirthdate)
      return NextResponse.json({ error: "Nom de l'élève, date de naissance, niveau, parent et téléphone sont obligatoires." }, { status: 400 })
    if (!validDate(studentBirthdate)) return NextResponse.json({ error: "Date de naissance invalide." }, { status: 400 })
    if (parentEmail && !/^\S+@\S+\.\S+$/.test(parentEmail)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 })
    if (!idempotencyKey)
      return NextResponse.json({ error: "Une clé d'idempotence UUID valide est obligatoire." }, { status: 400 })

    const { data: school } = await supabase.from("schools").select("id, published_to_trouvetou").eq("id", schoolId).is("deleted_at", null).maybeSingle()
    if (!school?.published_to_trouvetou) return NextResponse.json({ error: "École non trouvée ou non publiée" }, { status: 404 })

    const { data: level } = await supabase.from("grade_levels").select("id, name").eq("id", levelId).eq("school_id", schoolId).is("deleted_at", null).maybeSingle()
    if (!level) return NextResponse.json({ error: "Niveau scolaire invalide pour cet établissement." }, { status: 400 })

    if (idempotencyKey) {
      const { data: previous, error: previousError } = await supabase
        .from("trouvetou_reservations")
        .select("id, status, created_at, qr_code_token, expires_at")
        .eq("school_id", schoolId)
        .eq("external_idempotency_key", idempotencyKey)
        .maybeSingle()
      if (previousError) return NextResponse.json({ error: "Impossible de vérifier cette demande." }, { status: 500 })
      if (previous) return responseForExisting(previous, level)
    }

    // Les demandes sans capacité configurée sont conservées comme demandes à
    // confirmer. Quand la capacité est connue, la place est bloquée atomiquement.
    const { data: classes, error: classesError } = await supabase
      .from("classes").select("capacity").eq("school_id", schoolId).eq("grade_level_id", levelId).is("deleted_at", null)
    if (classesError) return NextResponse.json({ error: "Impossible de vérifier les places disponibles." }, { status: 500 })
    const capacity = (classes ?? []).reduce((sum, row) => sum + (Number(row.capacity) || 0), 0)

    if (capacity > 0) {
      const [{ data: enrollments, error: enrollmentError }, { data: reservations, error: reservationError }] = await Promise.all([
        supabase.from("enrollments").select("id").eq("school_id", schoolId).eq("grade_level_id", levelId).in("status", ["confirmed", "active"]).is("deleted_at", null),
        supabase.from("trouvetou_reservations").select("id").eq("school_id", schoolId).eq("grade_level_id", levelId).eq("status", "reserved").gt("expires_at", new Date().toISOString()),
      ])
      if (enrollmentError || reservationError) return NextResponse.json({ error: "Impossible de vérifier les places disponibles." }, { status: 500 })
      if ((enrollments?.length ?? 0) + (reservations?.length ?? 0) >= capacity)
        return NextResponse.json({ error: "Ce niveau ne dispose plus de places disponibles pour le moment.", code: "LEVEL_FULL" }, { status: 409 })
    }

    const initialStatus = capacity > 0 ? "pending_payment" : "requested"
    const { data: reservation, error } = await supabase.from("trouvetou_reservations").insert({
      school_id: schoolId,
      grade_level_id: levelId,
      student_full_name: studentFullName,
      student_birthdate: studentBirthdate,
      parent_full_name: parentFullName,
      parent_phone: parentPhone,
      parent_email: parentEmail || null,
      status: initialStatus,
      external_idempotency_key: idempotencyKey,
    }).select("id, status, created_at, qr_code_token, expires_at").single()

    if (error) {
      if (error.code === "23505" && idempotencyKey) {
        const { data: previous } = await supabase
          .from("trouvetou_reservations")
          .select("id, status, created_at, qr_code_token, expires_at")
          .eq("school_id", schoolId)
          .eq("external_idempotency_key", idempotencyKey)
          .maybeSingle()
        if (previous) return responseForExisting(previous, level)
      }
      console.error("[Trouvetou school request] insert failed:", error.message)
      return NextResponse.json({ error: "La demande n'a pas pu être enregistrée." }, { status: 500 })
    }

    if (initialStatus === "pending_payment") {
      const reserved = await reserveWithoutPayment(reservation.id)
      if (reserved.error) {
        return NextResponse.json({ error: "La demande est enregistrée mais la réservation de place n'a pas pu être finalisée. Réessayez sans modifier le formulaire." }, { status: 500 })
      }
      if (!reserved.success) {
        await supabase.from("trouvetou_reservations").update({ status: "expired" }).eq("id", reservation.id)
        return NextResponse.json({ error: "La dernière place vient d'être prise. Choisissez un autre niveau ou contactez l'école.", code: "LEVEL_FULL" }, { status: 409 })
      }
    }

    const { data: saved, error: savedError } = await supabase
      .from("trouvetou_reservations")
      .select("id, status, created_at, qr_code_token, expires_at")
      .eq("id", reservation.id)
      .single()
    if (savedError || !saved) return NextResponse.json({ error: "La demande est enregistrée mais son état ne peut pas être confirmé." }, { status: 502 })

    const seatReserved = saved.status === "reserved"
    return NextResponse.json({
      success: true,
      reservation_id: saved.id,
      status: saved.status,
      created_at: saved.created_at,
      qr_code: saved.qr_code_token ?? null,
      expires_at: saved.expires_at ?? null,
      next_step: "school_contact",
      payment_required: false,
      availability_confirmed: seatReserved,
      level: { id: level.id, label: level.name },
      reused: false,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 })
  }
}