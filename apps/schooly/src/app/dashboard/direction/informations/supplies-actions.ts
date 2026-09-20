"use server"

// ============================================================================
// M3 — Server actions « Fournitures par classe » (table school_supplies).
// Garde : user_school_roles (direction/super_admin). Lecture session (RLS),
// écritures via service_role. Normalisation via lib/fiches (M1).
// ============================================================================

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import {
  duplicateClassSupplies,
  mergeKitPreset,
  parseClassSupplies,
  parseSchoolSupplies,
} from "@/lib/fiches/normalize"
import { SUPPLY_KIT_PRESETS } from "@/lib/fiches/presets"
import type {
  ClassSuppliesConfiguration,
  SchoolSuppliesByClass,
  SupplyStatus,
} from "@/lib/fiches/types"

const PATH = "/dashboard/direction/informations"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error("Configuration Supabase serveur manquante")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Ctx = { ok: true; schoolId: string } | { ok: false; error: string }

async function resolveSchool(): Promise<Ctx> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Session expiree. Reconnectez-vous." }
  const { data: links, error } = await supabase
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "super_admin"])
    .limit(1)
  if (error || !links?.[0]) return { ok: false, error: "Action non autorisee pour ce compte." }
  return { ok: true, schoolId: String(links[0].school_id) }
}

async function currentYearId(admin: ReturnType<typeof adminClient>, schoolId: string): Promise<string | null> {
  const { data } = await admin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "en_cours")
    .maybeSingle()
  return data ? String(data.id) : null
}

export type SuppliesLoadResult =
  | { ok: true; supplies: SchoolSuppliesByClass; yearId: string | null }
  | { ok: false; error: string }

export type SuppliesSaveResult = { ok: boolean; error?: string }

/** Charge toutes les configurations de fournitures de l'ecole (annee en cours). */
export async function getSuppliesState(): Promise<SuppliesLoadResult> {
  try {
    const ctx = await resolveSchool()
    if (!ctx.ok) return ctx
    const admin = adminClient()
    const yearId = await currentYearId(admin, ctx.schoolId)
    let query = admin.from("school_supplies").select("class_name, configurations").eq("school_id", ctx.schoolId).is("deleted_at", null)
    if (yearId) query = query.eq("academic_year_id", yearId)
    const { data, error } = await query
    if (error) return { ok: false, error: "Lecture impossible. Reessayez." }
    const raw: Record<string, unknown> = {}
    for (const row of data ?? []) raw[String((row as { class_name: string }).class_name)] = (row as { configurations: unknown }).configurations
    return { ok: true, supplies: parseSchoolSupplies(raw), yearId }
  } catch {
    return { ok: false, error: "Erreur inattendue. Reessayez." }
  }
}

/** Cree/met a jour la configuration d'une classe (upsert par classe+annee). */
export async function saveClassSupplies(className: string, config: ClassSuppliesConfiguration): Promise<SuppliesSaveResult> {
  try {
    const key = className.trim()
    if (!key) return { ok: false, error: "Nom de classe requis." }
    const ctx = await resolveSchool()
    if (!ctx.ok) return ctx
    const parsed = parseClassSupplies(config, key)
    if (!parsed.manuals.length && !parsed.stationery.length && !parsed.equipment.length) {
      return { ok: false, error: "Ajoutez au moins un article avant d'enregistrer." }
    }
    const admin = adminClient()
    const yearId = await currentYearId(admin, ctx.schoolId)
    if (!yearId) return { ok: false, error: "Aucune annee scolaire en cours. Creez-la d'abord." }
    const payload = {
      school_id: ctx.schoolId,
      class_name: key,
      academic_year_id: yearId,
      configurations: parsed,
      status: parsed.status as SupplyStatus,
      published_at: parsed.status === "published" ? new Date().toISOString() : null,
    }
    const { error } = await admin.from("school_supplies").upsert(payload, { onConflict: "school_id,class_name,academic_year_id" })
    if (error) return { ok: false, error: "Enregistrement impossible. Reessayez." }
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur inattendue. Reessayez." }
  }
}

/** Bascule publie/brouillon d'une classe. */
export async function setClassSupplyStatus(className: string, status: SupplyStatus): Promise<SuppliesSaveResult> {
  try {
    const ctx = await resolveSchool()
    if (!ctx.ok) return ctx
    const admin = adminClient()
    const yearId = await currentYearId(admin, ctx.schoolId)
    if (!yearId) return { ok: false, error: "Aucune annee scolaire en cours." }
    const { data } = await admin.from("school_supplies").select("configurations").eq("school_id", ctx.schoolId).eq("class_name", className.trim()).eq("academic_year_id", yearId).maybeSingle()
    if (!data) return { ok: false, error: "Classe introuvable. Enregistrez-la d'abord." }
    const parsed = parseClassSupplies((data as { configurations: unknown }).configurations, className.trim())
    parsed.status = status
    const { error } = await admin.from("school_supplies").update({ configurations: parsed, status, published_at: status === "published" ? new Date().toISOString() : null }).eq("school_id", ctx.schoolId).eq("class_name", className.trim()).eq("academic_year_id", yearId)
    if (error) return { ok: false, error: "Changement de statut impossible." }
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur inattendue. Reessayez." }
  }
}

/** Suppression logique d'une classe (soft delete). */
export async function deleteClassSupplies(className: string): Promise<SuppliesSaveResult> {
  try {
    const ctx = await resolveSchool()
    if (!ctx.ok) return ctx
    const admin = adminClient()
    const yearId = await currentYearId(admin, ctx.schoolId)
    if (!yearId) return { ok: false, error: "Aucune annee scolaire en cours." }
    const { error } = await admin.from("school_supplies").update({ deleted_at: new Date().toISOString() }).eq("school_id", ctx.schoolId).eq("class_name", className.trim()).eq("academic_year_id", yearId)
    if (error) return { ok: false, error: "Suppression impossible." }
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur inattendue. Reessayez." }
  }
}

/** Duplique une classe vers une autre (M1 : copie repart en draft). */
export async function duplicateSupplies(fromClass: string, toClass: string): Promise<SuppliesSaveResult> {
  try {
    const target = toClass.trim()
    if (!target || target === fromClass) return { ok: false, error: "Classe cible invalide." }
    const ctx = await resolveSchool()
    if (!ctx.ok) return ctx
    const admin = adminClient()
    const yearId = await currentYearId(admin, ctx.schoolId)
    if (!yearId) return { ok: false, error: "Aucune annee scolaire en cours." }
    const { data } = await admin.from("school_supplies").select("class_name, configurations").eq("school_id", ctx.schoolId).eq("academic_year_id", yearId).is("deleted_at", null)
    const raw: Record<string, unknown> = {}
    for (const row of data ?? []) raw[String((row as { class_name: string }).class_name)] = (row as { configurations: unknown }).configurations
    const supplies = parseSchoolSupplies(raw)
    const next = duplicateClassSupplies(supplies, fromClass, target)
    if (!next[target]) return { ok: false, error: "Classe source introuvable." }
    const payload = { school_id: ctx.schoolId, class_name: target, academic_year_id: yearId, configurations: next[target], status: "draft" as SupplyStatus, published_at: null }
    const { error } = await admin.from("school_supplies").upsert(payload, { onConflict: "school_id,class_name,academic_year_id" })
    if (error) return { ok: false, error: "Duplication impossible. Reessayez." }
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur inattendue. Reessayez." }
  }
}

/** Applique un kit preregle a une classe (fusion non-destructive M1). */
export async function applyKitPreset(className: string, presetId: string): Promise<SuppliesSaveResult> {
  try {
    const preset = SUPPLY_KIT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return { ok: false, error: "Kit introuvable." }
    const ctx = await resolveSchool()
    if (!ctx.ok) return ctx
    const admin = adminClient()
    const yearId = await currentYearId(admin, ctx.schoolId)
    if (!yearId) return { ok: false, error: "Aucune annee scolaire en cours." }
    const { data } = await admin.from("school_supplies").select("configurations").eq("school_id", ctx.schoolId).eq("class_name", className.trim()).eq("academic_year_id", yearId).maybeSingle()
    const current = parseClassSupplies(data ? (data as { configurations: unknown }).configurations : {}, className.trim())
    const merged = mergeKitPreset(current, preset)
    const payload = { school_id: ctx.schoolId, class_name: className.trim(), academic_year_id: yearId, configurations: merged, status: merged.status as SupplyStatus, published_at: merged.status === "published" ? new Date().toISOString() : null }
    const { error } = await admin.from("school_supplies").upsert(payload, { onConflict: "school_id,class_name,academic_year_id" })
    if (error) return { ok: false, error: "Application du kit impossible." }
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur inattendue. Reessayez." }
  }
}
