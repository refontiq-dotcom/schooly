import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

type Status = "missing" | "received" | "verified" | "rejected"

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

async function getAuthorizedContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null, admin: null }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: role } = await admin
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "secretariat", "super_admin"])
    .limit(1)
    .maybeSingle()

  return { user, role, admin }
}

function canAccess(role: { school_id?: string | null; role_code?: string | null } | null, schoolId: string) {
  return Boolean(role && (role.role_code === "super_admin" || role.school_id === schoolId))
}

export async function GET(request: Request) {
  const { user, role, admin } = await getAuthorizedContext()
  if (!user || !role || !admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const url = new URL(request.url)
  const reservationId = clean(url.searchParams.get("reservation_id"), 80)
  if (!reservationId) return NextResponse.json({ error: "Préinscription manquante." }, { status: 400 })

  const { data: reservation } = await admin
    .from("trouvetou_reservations")
    .select("id, school_id, grade_level_id")
    .eq("id", reservationId)
    .maybeSingle()

  if (!reservation) return NextResponse.json({ error: "Préinscription introuvable." }, { status: 404 })
  if (!canAccess(role, reservation.school_id)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

  await admin.rpc("sync_missing_required_documents_for_reservation", { p_reservation_id: reservationId })

  const { data: documents, error } = await admin
    .from("preinscription_documents")
    .select("id, required_document_id, document_label, required, status, received_at, verified_at, rejection_reason, notes")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: "Lecture des pièces impossible." }, { status: 500 })
  return NextResponse.json({ documents: documents ?? [] })
}

export async function PATCH(request: Request) {
  const { user, role, admin } = await getAuthorizedContext()
  if (!user || !role || !admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const body = await request.json()
    const documentId = clean(body.document_id, 80)
    const status = clean(body.status, 20) as Status
    const rejectionReason = clean(body.rejection_reason, 500)
    const notes = clean(body.notes, 1000)

    if (!documentId || !["missing", "received", "verified", "rejected"].includes(status)) {
      return NextResponse.json({ error: "État de pièce invalide." }, { status: 400 })
    }
    if (status === "rejected" && !rejectionReason) {
      return NextResponse.json({ error: "Indique le motif du refus ou de la pièce à compléter." }, { status: 400 })
    }

    const { data: document } = await admin
      .from("preinscription_documents")
      .select("id, school_id, reservation_id, status")
      .eq("id", documentId)
      .maybeSingle()

    if (!document) return NextResponse.json({ error: "Pièce introuvable." }, { status: 404 })
    if (!canAccess(role, document.school_id)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = {
      status,
      rejection_reason: status === "rejected" ? rejectionReason : null,
      notes: notes || null,
      updated_at: now,
    }

    if (status === "received") {
      patch.received_at = now
      patch.received_by = user.id
      patch.verified_at = null
      patch.verified_by = null
    } else if (status === "verified") {
      patch.received_at = document.status === "missing" ? now : undefined
      patch.received_by = document.status === "missing" ? user.id : undefined
      patch.verified_at = now
      patch.verified_by = user.id
    } else if (status === "rejected") {
      patch.received_at = document.status === "missing" ? now : undefined
      patch.received_by = document.status === "missing" ? user.id : undefined
      patch.verified_at = null
      patch.verified_by = null
    } else {
      patch.received_at = null
      patch.received_by = null
      patch.verified_at = null
      patch.verified_by = null
    }

    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key])

    const { data: updated, error } = await admin
      .from("preinscription_documents")
      .update(patch)
      .eq("id", documentId)
      .eq("school_id", document.school_id)
      .select("id, required_document_id, document_label, required, status, received_at, verified_at, rejection_reason, notes")
      .single()

    if (error) return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 })
    return NextResponse.json({ document: updated })
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 })
  }
}
