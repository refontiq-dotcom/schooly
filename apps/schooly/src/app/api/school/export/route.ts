import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EXCLUDED_TABLES = new Set([
  "billing_configs",
  "roles",
  "notification_outbox",
])

async function getSchoolContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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
    .in("role_code", ["direction", "informatique"])
    .limit(1)
    .maybeSingle()

  if (!role?.school_id) return null
  return { userId: user.id, schoolId: role.school_id, roleCode: role.role_code, admin }
}

export async function GET(request: Request) {
  const context = await getSchoolContext()
  if (!context) return NextResponse.json({ error: "Accès refusé." }, { status: 401 })

  const url = new URL(request.url)
  const format = url.searchParams.get("format") === "html" ? "html" : "json"
  const { admin, schoolId, userId } = context

  const { data: school } = await admin
    .from("schools")
    .select("id, name, city, school_type, academic_year_id, mena_code, drena_code, created_at")
    .eq("id", schoolId)
    .single()

  // Tables de données de l'établissement. La liste est volontairement explicite
  // pour éviter qu'une future table technique ou secrète soit exportée par erreur.
  const tableNames = [
    "academic_decisions", "academic_years", "accounting_exports",
    "admission_assignment_batches", "admission_import_batches", "attendance_records",
    "boarding_subscriptions", "bus_routes", "bus_stops", "canteen_attendance",
    "canteen_menus", "canteen_subscriptions", "cash_sessions", "class_subject_assignments",
    "classes", "course_sessions", "detentions", "door_entries", "dorm_rooms", "dormitories",
    "dropout_alerts", "enrollment_checklist_items", "enrollments", "evaluation_assessments",
    "evaluation_periods", "evaluation_rules", "family_reliability_scores", "fee_discounts",
    "fee_schedules", "financial_profiles", "grade_corrections", "grade_entries", "grade_levels",
    "homeworks", "legal_document_acceptances", "moratoriums", "payment_reminders", "payments",
    "pre_enrollments", "receipts", "report_cards", "required_documents", "school_features",
    "school_payment_methods", "school_supplies", "student_fee_items",
    "student_movement_activation_audit", "student_movement_activations", "student_movement_requests",
    "student_qr_codes", "students", "subjects", "syscohada_export_log", "syscohada_settings",
    "transport_subscriptions", "preinscription_documents", "trouvetou_ads", "trouvetou_reservations", "year_rollover_logs",
  ].sort()

  const data: Record<string, unknown[]> = {}
  const errors: string[] = []

  for (const table of tableNames) {
    const { data: rows, error } = await admin.from(table).select("*").eq("school_id", schoolId)
    if (error) {
      errors.push(`${table}: ${error.message}`)
      continue
    }
    data[table] = rows ?? []
  }

  const { data: schoolRoles } = await admin
    .from("user_school_roles")
    .select("user_id, school_id, role_code, is_active, created_at")
    .eq("school_id", schoolId)

  const userIds = [...new Set((schoolRoles ?? []).map((row) => row.user_id).filter(Boolean))]
  let users: unknown[] = []
  if (userIds.length) {
    const { data: profiles } = await admin
      .from("users")
      .select("id, full_name, email, created_at")
      .in("id", userIds)
    users = profiles ?? []
  }

  const exportedAt = new Date().toISOString()
  const payload = {
    export_version: "2.0",
    exported_at: exportedAt,
    exported_by: userId,
    purpose: "Restitution des données de l'établissement",
    school,
    school_users: users,
    school_roles: schoolRoles ?? [],
    tables: data,
    errors,
    note: "Les secrets d'authentification, mots de passe et clés techniques ne sont pas exportés.",
  }

  if (format === "html") {
    const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[char] ?? char))

    const sections = Object.entries(data)
      .map(([name, rows]) => `
        <section>
          <h2>${escape(name)}</h2>
          <p>${rows.length} enregistrement(s)</p>
          ${rows.length ? `<table><thead><tr><th>Enregistrement</th><th>Résumé</th></tr></thead><tbody>${rows.slice(0, 500).map((row, index) => `<tr><td>${index + 1}</td><td><pre>${escape(JSON.stringify(row, null, 2))}</pre></td></tr>`).join("")}</tbody></table>` : "<p>Aucune donnée.</p>"}
        </section>
      `).join("")

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Export Schooly — ${escape(school?.name ?? "Établissement")}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#172033;margin:32px;line-height:1.45} h1{font-size:26px} h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:6px}
        .meta{background:#f5f7fa;padding:16px;border-radius:10px;margin:16px 0 24px} table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #ddd;padding:7px;vertical-align:top;text-align:left} th{background:#f2f4f7} pre{white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0}
        .print{position:fixed;right:20px;top:20px;padding:10px 14px;border:0;border-radius:8px;background:#172033;color:white;cursor:pointer}
        @media print{.print{display:none} body{margin:12mm} section{break-inside:avoid}}
      </style></head><body>
      <button class="print" onclick="window.print()">Imprimer / enregistrer en PDF</button>
      <h1>Dossier de restitution Schooly</h1>
      <div class="meta"><strong>${escape(school?.name ?? "Établissement")}</strong><br>
      Export généré le ${escape(new Date(exportedAt).toLocaleString("fr-FR"))}<br>
      Version d'export : 2.0<br>
      Ce document est destiné à la restitution des données de l'établissement. Les secrets techniques ne sont pas exportés.</div>
      ${sections}
      <h2>Utilisateurs et rôles</h2><pre>${escape(JSON.stringify({ users, roles: schoolRoles ?? [] }, null, 2))}</pre>
      </body></html>`

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="schooly-restitution-${schoolId}.html"`,
      },
    })
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="schooly-export-${schoolId}.json"`,
    },
  })
}
