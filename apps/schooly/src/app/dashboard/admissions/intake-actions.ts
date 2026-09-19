"use server"

import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"

const IMPORT_ROLES = ["direction", "secretariat", "super_admin"] as const
const ASSIGNMENT_ROLES = ["direction", "super_admin"] as const

type Row = Record<string, unknown>

function clean(value: unknown) {
  return String(value ?? "").trim()
}

function key(value: unknown) {
  return clean(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const s = clean(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m) {
    const candidate = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    if (candidate.getFullYear() === Number(m[3]) && candidate.getMonth() === Number(m[2]) - 1 && candidate.getDate() === Number(m[1])) {
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
    }
  }
  return null
}

function splitOptions(value: unknown): string[] {
  return clean(value).split(/[;,|]/).map((x) => x.trim()).filter(Boolean)
}

function valueBy(row: Row, aliases: string[]) {
  const map = new Map(Object.entries(row).map(([k, v]) => [key(k), v]))
  for (const alias of aliases) {
    const v = map.get(key(alias))
    if (v !== undefined && clean(v) !== "") return v
  }
  return null
}

function parseScore(value: unknown): number | null {
  const raw = clean(value).replace(",", ".")
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

async function guardSchool(schoolId?: string, roles: readonly string[] = IMPORT_ROLES) {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...roles],
    ...(schoolId ? { requestedSchoolId: schoolId } : {}),
  })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  return {
    guard,
    admin: createAdminClient(),
  }
}

export async function importAdmissionsList(formData: FormData) {
  const schoolId = clean(formData.get("schoolId"))
  const academicYearId = clean(formData.get("academicYearId"))
  const file = formData.get("file")

  if (!(file instanceof File) || !file.size) return { error: "Fichier CSV ou Excel requis." }
  if (file.size > 10 * 1024 * 1024) return { error: "Le fichier dépasse 10 Mo." }
  if (!schoolId || !academicYearId) return { error: "Établissement ou année scolaire manquant." }

  const auth = await guardSchool(schoolId)
  if ("error" in auth) return auth
  const { guard, admin } = auth

  const { data: academicYear, error: academicYearError } = await admin
    .from("academic_years")
    .select("id,school_id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .maybeSingle()
  if (academicYearError) return { error: academicYearError.message }
  if (!academicYear) return { error: "Année scolaire invalide pour cet établissement." }

  let workbook: XLSX.WorkBook
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  } catch {
    return { error: "Le fichier est illisible ou corrompu." }
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) return { error: "Aucune feuille exploitable." }

  const rows = XLSX.utils.sheet_to_json<Row>(firstSheet, { defval: "" })
  if (!rows.length) return { error: "Le fichier ne contient aucune ligne." }

  const { data: levels, error: levelError } = await admin
    .from("grade_levels")
    .select("id,name")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
  if (levelError) return { error: levelError.message }

  const levelMap = new Map((levels ?? []).map((l) => [key(l.name), l]))
  const normalized = rows.map((row, index) => {
    const firstName = clean(valueBy(row, ["prenom", "prénom", "first_name", "first name"]))
    const lastName = clean(valueBy(row, ["nom", "last_name", "last name"]))
    const gradeName = clean(valueBy(row, ["niveau", "classe", "grade", "grade_level", "niveau_souhaite"]))
    const grade = levelMap.get(key(gradeName))
    const raw = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, clean(v)]))
    const dateRaw = valueBy(row, ["date_naissance", "date de naissance", "dob"])
    const parsedDate = parseDate(dateRaw)
    const scoreRaw = valueBy(row, ["moyenne", "score", "note", "academic_score"])
    const academicScore = parseScore(scoreRaw)
    const errors: string[] = []
    if (!firstName || !lastName) errors.push("Nom et prénom obligatoires.")
    if (!grade) errors.push(`Niveau introuvable : ${gradeName || "vide"}`)
    if (dateRaw && !parsedDate) errors.push("Date de naissance invalide.")
    if (scoreRaw && academicScore === null) errors.push("Moyenne/score invalide.")

    return {
      row_number: index + 2,
      external_id: clean(valueBy(row, ["id", "id_externe", "external_id", "numero_affectation"])),
      matricule: clean(valueBy(row, ["matricule", "numero_matricule"])),
      first_name: firstName,
      last_name: lastName,
      date_of_birth: parsedDate,
      gender: clean(valueBy(row, ["sexe", "genre", "gender"])).toUpperCase() || null,
      grade_level_id: grade?.id ?? null,
      grade_name: gradeName || null,
      orientation_number: clean(valueBy(row, ["numero_orientation", "n° orientation", "orientation", "notification"])),
      academic_score: academicScore,
      required_options: splitOptions(valueBy(row, ["options", "option", "options_obligatoires"])),
      raw_data: raw,
      status: errors.length ? "error" : "ready",
      error_message: errors.length ? errors.join(" ") : null,
    }
  })

  const { data: batch, error: batchError } = await admin
    .from("admission_import_batches")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      filename: file.name,
      source: "ministere",
      status: "draft",
      total_rows: normalized.length,
      valid_rows: normalized.filter((r) => r.status === "ready").length,
      error_rows: normalized.filter((r) => r.status === "error").length,
      created_by: guard.context.userId,
    })
    .select("id")
    .single()

  if (batchError || !batch) return { error: batchError?.message ?? "Import impossible." }

  const { error: rowError } = await admin.from("admission_import_rows").insert(
    normalized.map((r) => ({ ...r, batch_id: batch.id })),
  )
  if (rowError) {
    await admin.from("admission_import_batches").delete().eq("id", batch.id)
    return { error: rowError.message }
  }

  return {
    data: {
      batchId: batch.id,
      filename: file.name,
      total: normalized.length,
      valid: normalized.filter((r) => r.status === "ready").length,
      errors: normalized.filter((r) => r.status === "error").length,
    },
  }
}

export async function getAdmissionImportBatches(schoolId: string) {
  const auth = await guardSchool(schoolId)
  if ("error" in auth) return auth
  const { data, error } = await auth.admin
    .from("admission_import_batches")
    .select("id,filename,status,total_rows,valid_rows,error_rows,created_at,academic_years(label)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(10)
  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function previewAdmissionAssignment(
  schoolId: string,
  academicYearId: string,
  importBatchId: string,
  gradeLevelId: string,
) {
  const auth = await guardSchool(schoolId, ASSIGNMENT_ROLES)
  if ("error" in auth) return auth
  const { admin, guard } = auth

  const { data: batch, error: batchError } = await admin
    .from("admission_import_batches")
    .select("id,school_id,academic_year_id")
    .eq("id", importBatchId)
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .maybeSingle()
  if (batchError) return { error: batchError.message }
  if (!batch) return { error: "Import introuvable pour cet établissement et cette année." }

  const { data: rows, error: rowError } = await admin
    .from("admission_import_rows")
    .select("id,first_name,last_name,date_of_birth,gender,grade_level_id,grade_name,required_options,matricule,academic_score")
    .eq("batch_id", importBatchId)
    .eq("grade_level_id", gradeLevelId)
    .eq("status", "ready")
  if (rowError) return { error: rowError.message }

  const { data: classes, error: classError } = await admin
    .from("classes")
    .select("id,name,capacity,grade_level_id,required_options")
    .eq("school_id", schoolId)
    .eq("grade_level_id", gradeLevelId)
    .is("deleted_at", null)
    .order("name")
  if (classError) return { error: classError.message }
  if (!classes?.length) return { error: "Aucune classe disponible pour ce niveau." }
  if (!rows?.length) return { error: "Aucun élève importé pour ce niveau." }

  const classIds = classes.map((c) => c.id)
  const { data: occupied, error: occupiedError } = await admin
    .from("enrollments")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .in("class_id", classIds)
    .in("status", ["active", "confirmed"])
    .is("deleted_at", null)
  if (occupiedError) return { error: occupiedError.message }

  const counts = new Map<string, number>()
  for (const e of occupied ?? []) counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1)

  const ordered = [...rows].sort((a, b) => {
    const score = (x: any) => Number(x.academic_score ?? 0)
    return score(b) - score(a) || String(a.last_name).localeCompare(String(b.last_name), "fr") || String(a.first_name).localeCompare(String(b.first_name), "fr")
  })

  const classState = classes.map((c) => ({
    ...c,
    occupied: counts.get(c.id) ?? 0,
    remaining: Math.max(0, Number(c.capacity ?? 0) - (counts.get(c.id) ?? 0)),
    boys: 0,
    girls: 0,
  }))

  let direction = 1
  let cursor = 0
  const assignment: Array<{
    import_row_id: string
    class_id: string | null
    position: number
    hard_valid: boolean
    soft_score: number
    constraint_reason: string | null
  }> = []

  for (const [index, student] of ordered.entries()) {
    const eligible = classState.filter((c) =>
      c.remaining > 0 &&
      (Array.isArray(c.required_options) ? c.required_options : []).every((required: string) =>
        (Array.isArray(student.required_options) ? student.required_options : [])
          .map((x: string) => x.toLowerCase())
          .includes(required.toLowerCase()),
      ),
    )

    if (!eligible.length) {
      assignment.push({
        import_row_id: student.id,
        class_id: null,
        position: index + 1,
        hard_valid: false,
        soft_score: 0,
        constraint_reason: "Aucune classe ne respecte capacité/options.",
      })
      continue
    }

    let chosen: (typeof classState)[number] | null = null
    for (let step = 0; step < classState.length; step++) {
      const idx = (cursor + step * direction + classState.length) % classState.length
      const candidate = classState[idx]
      if (eligible.some((x) => x.id === candidate.id)) {
        chosen = candidate
        cursor = idx + direction
        if (cursor >= classState.length || cursor < 0) {
          direction *= -1
          cursor = Math.max(0, Math.min(classState.length - 1, idx))
        }
        break
      }
    }

    if (!chosen) {
      assignment.push({
        import_row_id: student.id,
        class_id: null,
        position: index + 1,
        hard_valid: false,
        soft_score: 0,
        constraint_reason: "Aucune classe disponible.",
      })
      continue
    }

    chosen.remaining -= 1
    if (student.gender === "F") chosen.girls += 1
    else if (student.gender === "M") chosen.boys += 1

    const total = chosen.girls + chosen.boys
    const balance = total ? 1 - Math.abs(chosen.girls - chosen.boys) / total : 1
    assignment.push({
      import_row_id: student.id,
      class_id: chosen.id,
      position: index + 1,
      hard_valid: true,
      soft_score: balance,
      constraint_reason: null,
    })
  }

  const { data: assignmentBatch, error: assignmentBatchError } = await admin
    .from("admission_assignment_batches")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      grade_level_id: gradeLevelId,
      source_batch_id: importBatchId,
      algorithm: "serpentin",
      status: "preview",
      created_by: guard.context.userId,
    })
    .select("id")
    .single()
  if (assignmentBatchError || !assignmentBatch) return { error: assignmentBatchError?.message ?? "Prévisualisation impossible." }

  const { error: assignmentRowError } = await admin.from("admission_assignment_rows").insert(
    assignment.map((row) => ({
      ...row,
      assignment_batch_id: assignmentBatch.id,
      score: row.soft_score,
    })),
  )
  if (assignmentRowError) {
    await admin.from("admission_assignment_batches").delete().eq("id", assignmentBatch.id)
    return { error: assignmentRowError.message }
  }

  return {
    data: {
      assignmentBatchId: assignmentBatch.id,
      assigned: assignment.filter((r) => r.hard_valid).length,
      unassigned: assignment.filter((r) => !r.hard_valid).length,
      rows: assignment.map((r) => ({
        id: r.import_row_id,
        import_row_id: r.import_row_id,
        position: r.position,
        class_id: r.class_id,
        hard_valid: r.hard_valid,
        constraint_reason: r.constraint_reason,
        student: rows.find((s) => s.id === r.import_row_id)
          ? {
              id: r.import_row_id,
              first_name: rows.find((s) => s.id === r.import_row_id)?.first_name ?? "",
              last_name: rows.find((s) => s.id === r.import_row_id)?.last_name ?? "",
              gender: rows.find((s) => s.id === r.import_row_id)?.gender ?? null,
              grade_name: rows.find((s) => s.id === r.import_row_id)?.grade_name ?? null,
            }
          : undefined,
        class: classes.find((c) => c.id === r.class_id)
          ? {
              id: r.class_id!,
              name: classes.find((c) => c.id === r.class_id)!.name,
              capacity: classes.find((c) => c.id === r.class_id)!.capacity,
            }
          : null,
      })),
    },
  }
}

export async function saveAdmissionAssignmentPreview(
  schoolId: string,
  assignmentBatchId: string,
  rows: Array<{ id: string; classId: string | null; position: number }>,
) {
  const auth = await guardSchool(schoolId, ASSIGNMENT_ROLES)
  if ("error" in auth) return auth
  const { admin } = auth

  const { data: batch, error: batchError } = await admin
    .from("admission_assignment_batches")
    .select("id,school_id,status")
    .eq("id", assignmentBatchId)
    .eq("school_id", schoolId)
    .maybeSingle()
  if (batchError) return { error: batchError.message }
  if (!batch) return { error: "Affectation introuvable." }
  if (batch.status !== "preview") return { error: "Cette affectation n'est plus modifiable." }

  const positions = rows.map((r) => r.position)
  if (new Set(positions).size !== positions.length) return { error: "Positions dupliquées." }

  for (const row of rows) {
    const { error } = await admin
      .from("admission_assignment_rows")
      .update({ class_id: row.classId, position: row.position })
      .eq("id", row.id)
      .eq("assignment_batch_id", assignmentBatchId)
    if (error) return { error: error.message }
  }

  return { data: { updated: rows.length } }
}

export async function commitAdmissionAssignment(schoolId: string, assignmentBatchId: string) {
  const auth = await guardSchool(schoolId, ASSIGNMENT_ROLES)
  if ("error" in auth) return auth

  const { data: result, error } = await auth.admin.rpc("commit_admission_assignment", {
    p_assignment_batch_id: assignmentBatchId,
  })
  if (error) return { error: error.message }

  return { data: result as { created: number; updated: number; assigned_rows: number; status: string } }
}
