"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export type RequiredDocument = {
  id: string
  label: string
  required: boolean
  applicableToLevelId?: string | null
}

export const DEFAULT_REQUIRED_DOCUMENTS: RequiredDocument[] = [
  { id: "default-acte-naissance", label: "Extrait acte de naissance", required: true },
  { id: "default-photos", label: "Photos d’identité", required: true },
  { id: "default-piece-parent", label: "Pièce d’identité du parent / responsable", required: true },
  { id: "default-bulletin", label: "Bulletin de l'année précédente", required: false },
  { id: "default-certificat-scolarite", label: "Certificat de scolarité", required: false },
  { id: "default-certificat-transfert", label: "Certificat de transfert", required: false },
  { id: "default-certificat-medical", label: "Certificat médical", required: false },
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

function normalizeDocuments(value: RequiredDocument[]): RequiredDocument[] {
  const out: RequiredDocument[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const label = String(item.label ?? "").trim().replace(/\s+/g, " ")
    if (!label) continue
    const id = String(item.id ?? "").trim() || "custom-" + crypto.randomUUID()
    const nameKey = label.toLowerCase()
    if (seen.has(nameKey)) continue
    seen.add(nameKey)
    out.push({
      id,
      label,
      required: item.required !== false,
      applicableToLevelId: item.applicableToLevelId ?? null,
    })
  }
  return out
}

export async function getRequiredDocuments(): Promise<Result> {
  try {
    const schoolId = await schoolIdForCurrentUser()
    if (!schoolId) return { ok: false, error: "Accès refusé." }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await admin.from("required_documents").select("id, nom, obligatoire, applicable_to_level_id").eq("school_id", schoolId).is("deleted_at", null).is("applicable_to_level_id", null).order("created_at", { ascending: true })
    if (error) return { ok: false, error: "Lecture impossible." }

    const seenLabels = new Set<string>()
    const saved = (data ?? []).filter((row) => {
      const key = String(row.nom).trim().toLowerCase()
      if (seenLabels.has(key)) return false
      seenLabels.add(key)
      return true
    }).map((row) => ({
      id: String(row.id),
      label: String(row.nom),
      required: row.obligatoire !== false,
      applicableToLevelId: row.applicable_to_level_id ? String(row.applicable_to_level_id) : null,
    }))
    const labels = new Set(saved.map((item) => item.label.toLowerCase()))
    const documents = [...saved, ...DEFAULT_REQUIRED_DOCUMENTS.filter((item) => !labels.has(item.label.toLowerCase()))]
    return { ok: true, documents }
  } catch {
    return { ok: false, error: "Lecture impossible." }
  }
}

export async function saveRequiredDocuments(documents: RequiredDocument[]): Promise<Result> {
  try {
    const schoolId = await schoolIdForCurrentUser()
    if (!schoolId) return { ok: false, error: "Accès refusé." }
    const normalized = normalizeDocuments(documents)
    if (!normalized.length) return { ok: false, error: "Ajoutez au moins une pièce à fournir." }

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: existing, error: existingError } = await admin.from("required_documents").select("id").eq("school_id", schoolId).is("deleted_at", null).is("applicable_to_level_id", null)
    if (existingError) return { ok: false, error: "Lecture impossible." }

    const existingRows = existing ?? []
    const keptIds = new Set<string>()
    const persisted: RequiredDocument[] = []

    for (const item of normalized) {
      const existingRow = existingRows.find((row) => String(row.id) === item.id)
      if (existingRow) {
        keptIds.add(String(existingRow.id))
        const { error } = await admin.from("required_documents").update({ nom: item.label, obligatoire: item.required, applicable_to_level_id: item.applicableToLevelId ?? null }).eq("id", existingRow.id).eq("school_id", schoolId)
        if (error) return { ok: false, error: "Enregistrement impossible." }
        persisted.push({ ...item, id: String(existingRow.id) })
      } else {
        const { data, error } = await admin.from("required_documents").insert({ school_id: schoolId, nom: item.label, obligatoire: item.required, applicable_to_level_id: item.applicableToLevelId ?? null }).select("id").single()
        if (error || !data) return { ok: false, error: "Enregistrement impossible." }
        const persistedId = String(data.id)
        keptIds.add(persistedId)
        persisted.push({ ...item, id: persistedId })
      }
    }

    const existingIds = new Set(existingRows.map((row) => String(row.id)))
    const toDelete = [...existingIds].filter((id) => !keptIds.has(id))
    if (toDelete.length) {
      const { error } = await admin.from("required_documents").update({ deleted_at: new Date().toISOString() }).eq("school_id", schoolId).in("id", toDelete)
      if (error) return { ok: false, error: "Suppression impossible." }
    }

    revalidatePath("/dashboard/direction/settings")
    revalidatePath("/dashboard/direction")
    return { ok: true, documents: persisted }
  } catch {
    return { ok: false, error: "Enregistrement impossible." }
  }
}
