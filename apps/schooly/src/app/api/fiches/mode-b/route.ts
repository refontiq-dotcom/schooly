// ============================================================================
// M6 — Génération PDF « Mode B » (Vue Secrétariat) : GET /api/fiches/mode-b
// PDF institutionnel : grille tarifaire GLOBALE de l'école + QR code dynamique
// pointant vers la fiche publique Trouvetou (/fiche/[schoolId]) avec la
// consigne « Scannez pour télécharger la liste des fournitures ».
// NE contient jamais les fournitures (c'est le rôle du Mode A côté parent).
// Garde : session direction/super_admin (même pattern que actions.ts M2).
// Génération server-side : @react-pdf/renderer + qrcode (runtime node).
// ============================================================================

import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js"
import {
  parseCyclesOffered,
  parseFeesStructure,
  parseOptionalServices,
} from "@/lib/fiches/normalize"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SchoolRow = {
  id: string
  name: string | null
  city: string | null
  public_address: string | null
  public_phone: string | null
  public_email: string | null
  cycles_offered: unknown
  fees_structure: unknown
  optional_services: unknown
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error("Configuration Supabase serveur manquante")
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase() || "ecole"
  )
}

export async function GET(request: Request) {
  try {
    // 1. Garde session + rôles (direction / super_admin)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: "Session expirée. Reconnectez-vous." },
        { status: 401 },
      )
    }

    const { data: links, error: linkErr } = await supabase
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", ["direction", "super_admin"])
    if (linkErr) {
      return NextResponse.json(
        { error: "Erreur de vérification des droits." },
        { status: 500 },
      )
    }
    const allowed = links ?? []
    if (!allowed.length) {
      return NextResponse.json(
        { error: "Aucune école rattachée à ce compte." },
        { status: 403 },
      )
    }

    // École cible : param optionnel (super_admin sur une autre école),
    // sinon l'école active du directeur.
    const { searchParams } = new URL(request.url)
    const requested = searchParams.get("ecoleId")
    const isSuperAdmin = allowed.some((l) => l.role_code === "super_admin")
    const schoolId =
      requested && (isSuperAdmin || allowed.some((l) => String(l.school_id) === requested))
        ? requested
        : String(allowed[0].school_id)

    // 2. Données école (service_role : lecture des JSONB bruts)
    const admin = adminClient()
    const { data: school, error } = await admin
      .from("schools")
      .select(
        "id, name, city, public_address, public_phone, public_email, cycles_offered, fees_structure, optional_services",
      )
      .eq("id", schoolId)
      .is("deleted_at", null)
      .maybeSingle<SchoolRow>()
    if (error || !school) {
      return NextResponse.json(
        { error: "Établissement introuvable." },
        { status: 404 },
      )
    }

    // 3. QR code → page publique Trouvetou de l'école
    const trouvetouBase = (
      process.env.NEXT_PUBLIC_TROUVETOU_URL ?? "http://localhost:3001"
    ).replace(/\/+$/, "")
    const qrTargetUrl = `${trouvetouBase}/fiche/${school.id}`
    const QRCode = (await import("qrcode")).default
    const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
    })

    // 4. PDF (import dynamique : react-pdf hors du bundle serveur initial)
    const { renderModeB } = await import("@/lib/fiches/mode-b-document")
    const generatedAt = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date())
    const pdf = await renderModeB({
      schoolName: school.name ?? "Établissement",
      city: school.city,
      address: school.public_address,
      phone: school.public_phone,
      email: school.public_email,
      cycles: parseCyclesOffered(school.cycles_offered),
      fees: parseFeesStructure(school.fees_structure),
      services: parseOptionalServices(school.optional_services),
      qrDataUrl,
      qrTargetUrl,
      generatedAt,
    })

    // 5. Réponse téléchargeable
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="grille-tarifaire-${slugify(school.name ?? "ecole")}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Génération du PDF impossible. Réessayez." },
      { status: 500 },
    )
  }
}