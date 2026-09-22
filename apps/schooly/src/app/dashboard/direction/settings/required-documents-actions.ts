"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export type RequiredDocument = { id: string; label: string; required: boolean }

export const DEFAULT_REQUIRED_DOCUMENTS: RequiredDocument[] = [
  { id: "acte-naissance", label: "Extrait / acte de naissance", required: true },
  { id: "photos", label: "Photos d’identité", required: true },
  { id: "piece-parent", label: "Pièce d’identité du parent / responsable", required: true },
  { id: "bulletin", label: "Bulletin de notes / dernier relevé", required: false },
  { id: "certificat-scolarite", label: "Certificat de scolarité", required: false },
  { id: "certificat-transfert", label: "Certificat de transfert", required: false },
  { id: "certificat-medical", label: "Certificat médical", required: false },
]

type Result = { ok: true; documents: RequiredDocument[] } | { ok: false; error: string }

async function schoolIdForCurrentUser(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data } = await admin.from("user_school_roles").select("school_id").eq("user_id", user.id).eq("is_active", true).in("role_code", ["direction", "super_admin"]).limit(1).maybeSingle()
  return data?.school_id ? String(data.school_id) : null
}

function normalizeDocuments(value: unknown): RequiredDocument[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_REQUIRED_DOCUMENTS.map((item) => ({ ...item }))
  const out: RequiredDocument[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const raw = item as Record<string, unknown>
    const label = typeof raw.label === "string" ? raw.label.trim().replace(/\s+/g, " ") : ""
    if (!label) continue
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "custom-" + crypto.randomUUID()
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, label, required: raw.required !== false })
  }
  return out
}

export async function getRequiredDocuments(): Promise<Result> {
  try {
    const schoolId = await schoolIdForCurrentUser()
    if (!schoolId) return { ok: false, error: "Accès refusé." }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await admin.from("schools").select("required_documents").eq("id", schoolId).maybeSingle()
    if (error) return { ok: false, error: "Lecture impossible." }
    return { ok: true, documents: normalizeDocuments(data?.required_documents) }
  } catch { return { ok: false, error: "Lecture impossible." }
}

export async function saveRequiredDocuments(documents: RequiredDocument[]): Promise<Result> {
  try {
    const schoolId = await schoolIdForCurrentUser()
    if (!schoolId) return { ok: false, error: "Accès refusé." }
    const normalized = normalizeDocuments(documents)
    if (!normalized.length) return { ok: false, error: "Ajoutez au moins une pièce à fournir." }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await admin.from("schools").update({ required_documents: normalized }).eq("id", schoolId)
    if (error) return { ok: false, error: "Enregistrement impossible." }
    revalidatePath("/dashboard/direction/settings")
    return { ok: true, documents: normalized }
  } catch { return { ok: false, error: "Enregistrement impossible." }
}
