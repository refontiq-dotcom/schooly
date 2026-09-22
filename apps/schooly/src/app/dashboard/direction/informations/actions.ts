"use server"

// ============================================================================
// Milestone 2 — Server actions « Fiche établissement » (wizard Direction)
// Lecture/écriture des 3 colonnes JSONB : cycles_offered, fees_structure,
// optional_services. Pattern projet : garde sur client de session (RLS),
// écriture via client service_role, normalisation via la couche lib/fiches.
// ============================================================================

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import {
  parseCyclesOffered,
  parseFeesStructure,
  parseOptionalServices,
} from "@/lib/fiches/normalize"
import type {
  CyclesOffered,
  FeesStructure,
  OptionalServices,
} from "@/lib/fiches/types"

type FicheJson = {
  communes: unknown
  cycles_offered: unknown
  fees_structure: unknown
  optional_services: unknown
}

export type FicheState = {
  communes: string[]
  cycles: CyclesOffered
  fees: FeesStructure
  services: OptionalServices
}

export type SaveFichePayload = {
  communes: string[]
  cycles: CyclesOffered
  fees: FeesStructure
  services: OptionalServices
}

export type FicheLoadResult =
  | { ok: true; state: FicheState; schoolName: string }
  | { ok: false; error: string }

export type FicheSaveResult = { ok: boolean; error?: string }

function syncExamFeeRows(cycles: CyclesOffered, fees: FeesStructure): FeesStructure {
  const detected = cycles.cycles.flatMap((cycle) => cycle.levels).map((level) => {
    const name = level.grade_level_name.trim()
    const key = name.toLowerCase().replace(/\s+/g, " ")
    if (key === "cm2") return { class_name: name, exam_name: "CEPE", diploma: "cep" as const }
    if (key === "3e" || key === "3ème" || key === "3eme") return { class_name: name, exam_name: "BEPC", diploma: "bepc" as const }
    if (key === "terminale" || key === "terminale technique") return { class_name: name, exam_name: "BAC", diploma: "bac" as const }
    if (key === "cap" || key.startsWith("cap ")) return { class_name: name, exam_name: "CAP", diploma: "cap" as const }
    if (key === "bt" || key.startsWith("bt ")) return { class_name: name, exam_name: "BT", diploma: "bt" as const }
    if (key === "bts" || key.startsWith("bts ")) return { class_name: name, exam_name: "BTS", diploma: "bts" as const }
    return null
  }).filter((item): item is { class_name: string; exam_name: string; diploma: "cep" | "bepc" | "bac" | "cap" | "bt" | "bts" } => Boolean(item))

  const merged = [...(fees.exam_fees ?? [])]
  for (const item of detected) {
    const row = merged.find((candidate) =>
      candidate.class_name.trim().toLowerCase() === item.class_name.trim().toLowerCase() &&
      candidate.exam_name.trim().toLowerCase() === item.exam_name.toLowerCase(),
    )
    if (row) {
      row.amount_affecte = row.amount_affecte ?? row.amount ?? 0
      row.amount_non_affecte = row.amount_non_affecte ?? row.amount ?? 0
      continue
    }
    merged.push({ ...item, amount: 0, amount_affecte: 0, amount_non_affecte: 0, is_mandatory: true })
  }
  return { ...fees, exam_fees: merged }
}

function syncFeeProfiles(cycles: CyclesOffered, fees: FeesStructure): FeesStructure {
  if (!fees.fee_profiles) return fees
  const profiles = { ...fees.fee_profiles }
  for (const cycle of cycles.cycles) {
    const profile = profiles[cycle.key]
    if (!profile) continue
    const synced = syncExamFeeRows({ ...cycles, cycles: [cycle] }, profile)
    const { fee_profiles: _ignored, ...cleanProfile } = synced
    profiles[cycle.key] = cleanProfile
  }
  return { ...fees, fee_profiles: profiles }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error("Configuration Supabase serveur manquante")
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Résout l'école active du directeur connecté (pattern garde projet).
 * Renvoie une erreur typée « NO_SCHOOL » si aucun rattachement actif.
 */
async function resolveActiveSchool() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "NOT_AUTH" }

  const { data: links, error: linkErr } = await supabase
    .from("user_school_roles")
    .select("school_id, role_code, is_active, schools(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "super_admin"])
    .limit(1)

  if (linkErr) return { ok: false as const, error: "DB_ERROR" }
  const link = links?.[0]
  if (!link) return { ok: false as const, error: "NO_SCHOOL" }

  const rawName = Array.isArray(link.schools) ? link.schools[0] : link.schools
  const schoolName =
    rawName && typeof rawName === "object" && "name" in rawName
      ? String((rawName as { name: unknown }).name ?? "")
      : ""

  return {
    ok: true as const,
    schoolId: String(link.school_id),
    schoolName,
  }
}

/** Charge l'état courant de la fiche pour l'école du directeur connecté. */
export async function getFicheState(): Promise<FicheLoadResult> {
  try {
    const ctx = await resolveActiveSchool()
    if (!ctx.ok) {
      return {
        ok: false,
        error:
          ctx.error === "NOT_AUTH"
            ? "Session expirée. Reconnectez-vous."
            : ctx.error === "NO_SCHOOL"
              ? "Aucune école rattachée à ce compte."
              : "Erreur de lecture. Réessayez.",
      }
    }

    const admin = adminClient()
    const { data, error } = await admin
      .from("schools")
      .select("name, communes, cycles_offered, fees_structure, optional_services")
      .eq("id", ctx.schoolId)
      .maybeSingle<FicheJson & { name: string | null }>()

    if (error || !data) {
      return { ok: false, error: "Établissement introuvable." }
    }

    return {
      ok: true,
      schoolName: data.name ?? ctx.schoolName,
      state: {
        communes: Array.isArray(data.communes) ? data.communes.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()) : [],
        cycles: parseCyclesOffered(data.cycles_offered),
        fees: syncFeeProfiles(parseCyclesOffered(data.cycles_offered), syncExamFeeRows(parseCyclesOffered(data.cycles_offered), parseFeesStructure(data.fees_structure))),
        services: parseOptionalServices(data.optional_services),
      },
    }
  } catch {
    return { ok: false, error: "Erreur inattendue. Réessayez." }
  }
}

/** Persiste les 3 JSONB de la fiche pour l'école du directeur connecté. */
export async function saveSchoolConfiguration(
  payload: SaveFichePayload,
): Promise<FicheSaveResult> {
  try {
    const ctx = await resolveActiveSchool()
    if (!ctx.ok) {
      return { ok: false, error: "Action non autorisée pour ce compte." }
    }

    // Normalisation défensive : les parseurs garantissent la conformité.
    const communes = Array.from(new Set((payload.communes ?? []).map((value) => String(value).trim().replace(/\s+/g, " ")).filter(Boolean)))
    const cycles = parseCyclesOffered(payload.cycles)
    const fees = syncFeeProfiles(cycles, syncExamFeeRows(cycles, parseFeesStructure(payload.fees)))
    const services = parseOptionalServices(payload.services)

    if (!cycles.cycles.length) {
      return {
        ok: false,
        error: "Sélectionnez au moins un cycle d'enseignement.",
      }
    }
    if (!cycles.cycles.some((c) => c.levels.length)) {
      return {
        ok: false,
        error: "Ajoutez au moins un niveau dans l'un des cycles activés.",
      }
    }

    const admin = adminClient()
    const { error } = await admin
      .from("schools")
      .update({
        communes,
        cycles_offered: cycles,
        fees_structure: fees,
        optional_services: services,
      })
      .eq("id", ctx.schoolId)

    if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." }
    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur inattendue. Réessayez." }
  }
}
