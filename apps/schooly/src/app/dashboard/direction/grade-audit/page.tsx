import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole } from "@/utils/supabase/require-role"

export default async function GradeAuditPage() {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ["direction"] })
  if (!guard.ok) redirect("/login")

  const { data, error } = await db.from("grade_corrections")
    .select("id,revision,old_value,new_value,old_status,new_status,reason,corrected_by,requested_by,request_id,corrected_at,grade_entries(label,enrollments(students(first_name,last_name)),subjects(name))")
    .eq("school_id", guard.context.schoolId)
    .order("corrected_at", { ascending: false })
    .limit(200)

  if (error) return <div className="p-8"><p className="rounded border p-4">Journal indisponible : {error.message}</p></div>

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Contrôle et traçabilité</p>
        <h1 className="text-3xl font-semibold tracking-tight">Journal des modifications de notes</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Lecture seule pour la direction. Chaque correction conserve l’ancienne valeur, la nouvelle valeur,
          le motif et les acteurs. La direction ne peut pas modifier une note depuis ce journal.
        </p>
      </div>

      <div className="rounded border">
        {(data ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Aucune modification enregistrée.</p>
        ) : (
          <div className="divide-y">
            {(data ?? []).map((row: any) => {
              const student = row.grade_entries?.enrollments?.students
              return (
                <article key={row.id} className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-medium">
                      {student?.last_name} {student?.first_name} · {row.grade_entries?.subjects?.name ?? "Matière"}
                    </h2>
                    <time className="text-xs text-muted-foreground">{new Date(row.corrected_at).toLocaleString("fr-FR")}</time>
                  </div>
                  <p className="mt-1 text-sm">{row.grade_entries?.label ?? "Évaluation"} · {row.old_value ?? "ABS"} → {row.new_value ?? "ABS"} · révision {row.revision}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Motif : {row.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.request_id ? "Correction issue d'une demande informatique confirmée par le professeur." : "Correction directe effectuée par le professeur."}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
