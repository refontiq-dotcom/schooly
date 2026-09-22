// ============================================================================
// M4 — Fiche publique Trouvetou : GET /api/v1/public/ecoles/[id]/fiche
// SANS clé API (QR code scanné par n'importe quel parent) mais garde-fou dur :
// école published_to_trouvetou + fournitures status=published uniquement.
// Normalisation via lib/fiches (M1) : le portail affiche du JSON déjà sûr.
// ============================================================================

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  listSupplyClassNames,
  parseCyclesOffered,
  parseFeesStructure,
  parseOptionalServices,
  parseSchoolSupplies,
} from "@/lib/fiches/normalize"

function supa() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const className = searchParams.get("classe")
  const formation = searchParams.get("formation")
  const sb = supa()

  const { data: school, error } = await sb
    .from("schools")
    .select("id, name, city, public_address, public_phone, public_email, cover_photo_url, cycles_offered, fees_structure, optional_services")
    .eq("id", id)
    .eq("published_to_trouvetou", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !school) return NextResponse.json({ error: "Ecole introuvable." }, { status: 404 })

  const cycles = parseCyclesOffered((school as { cycles_offered: unknown }).cycles_offered)
  const fees = parseFeesStructure((school as { fees_structure: unknown }).fees_structure)
  const services = parseOptionalServices((school as { optional_services: unknown }).optional_services)
  const selectedCycle = formation ? cycles.cycles.find((cycle) => cycle.key === formation) ?? null : null
  const selectedFees = formation && fees.fee_profiles?.[formation as keyof typeof fees.fee_profiles] ? fees.fee_profiles[formation as keyof typeof fees.fee_profiles] : fees

  const { data: rows } = await sb
    .from("school_supplies")
    .select("class_name, configurations")
    .eq("school_id", id)
    .eq("status", "published")
    .is("deleted_at", null)
  const raw: Record<string, unknown> = {}
  for (const r of rows ?? []) {
    raw[String((r as { class_name: string }).class_name)] = (r as { configurations: unknown }).configurations
  }
  const all = parseSchoolSupplies(raw)
  const published = Object.fromEntries(Object.entries(all).filter(([, v]) => v.status === "published"))
  const classes = listSupplyClassNames(published)

  return NextResponse.json({
    ecole: {
      id: school.id,
      nom: school.name,
      ville: (school as { city: string | null }).city,
      adresse: (school as { public_address: string | null }).public_address,
      telephone: (school as { public_phone: string | null }).public_phone,
      email: (school as { public_email: string | null }).public_email,
      logo: (school as { cover_photo_url: string | null }).cover_photo_url,
    },
    cycles,
    formation: selectedCycle ? { key: selectedCycle.key, label: selectedCycle.label, levels: selectedCycle.levels } : null,
    formations: cycles.cycles.map((cycle) => ({ key: cycle.key, label: cycle.label, levels: cycle.levels })),
    tarifs: selectedFees,
    services,
    classes,
    fournitures: className ? (published[className] ?? null) : null,
  })
}
