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
  cycles_offered: unknown
  fees_structure: unknown
  optional_services: unknown
}

export type FicheState = {
  cycles: CyclesOffered
  fees: FeesStructure
  services: OptionalServices
}

export type SaveFichePayload = {
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
    const key = name.toLowerCase()
    if (key === "cm2" || key === "cm2") return { class_name: name, exam_name: "CEPE", diploma: "cep" as const }
    if (key === "3e") return { class_name: name, exam_name: "BEPC", diploma: "bepc" as const }
    if (key === "terminale" || key === "terminale technique") return { class_name: name, exam_name: "BAC", diploma: "bac" as const }
    return null
  }).filter((item): item is { class_name: string; exam_name: string; diploma: "cep"|"bepc"|"bac" } => Boolean(item))
  const existing = fees.exam_fees ?? []
  const merged = [...existing]
  for (const item of detected) {
    if (merged.some((row) => row.class_name === item.class_name && row.exam_name === item.exam_name)) continue
    merged.push({ ...item, amount: 0, is_mandatory: true })
  }
  return { ...fees, exam_fees: merged }
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
      .select("name, cycles_offered, fees_structure, optional_services")
      .eq("id", ctx.schoolId)
      .maybeSingle<FicheJson & { name: string | null }>()

    if (error || !data) {
      return { ok: false, error: "Établissement introuvable." }
    }

    return {
      ok: true,
      schoolName: data.name ?? ctx.schoolName,
      state: {
        cycles: parseCyclesOffered(data.cycles_offered),
        fees: syncExamFeeRows(parseCyclesOffered(data.cycles_offered), parseFeesStructure(data.fees_structure)),
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
    const cycles = parseCyclesOffered(payload.cycles)
    const fees = syncExamFeeRows(cycles, parseFeesStructure(payload.fees))
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
