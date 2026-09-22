import { RequestHistory } from "@/app/dashboard/informatique/grade-change-requests/request-history"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getGradesForIT, listPendingGradeChangeRequests, requestGradeChange, getGradeChangeRequestHistory } from "@/app/dashboard/pedagogie/grade-correction-actions"

export default async function GradeChangeRequestsPage() {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ["informatique"] })
  if (!guard.ok) redirect("/login")

  const [gradesResult, requestsResult] = await Promise.all([getGradesForIT(), listPendingGradeChangeRequests()])
  const grades = gradesResult.data ?? []
  const requests = requestsResult.data ?? []

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Contrôle des notes</p>
        <h1 className="text-3xl font-semibold tracking-tight">Demandes de modification de notes</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          L’informatique peut préparer une correction, mais ne peut jamais l’appliquer.
          La note ne change qu’après confirmation du professeur habilité.
        </p>
      </div>

      <section className="rounded border p-5">
        <h2 className="text-xl font-semibold">Nouvelle demande</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choisissez la note, indiquez la nouvelle valeur et le motif. Schooly fige automatiquement la révision actuelle.</p>
        <ActionForm action={requestGradeChange} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm md:col-span-2">
            Note concernée
            <select name="gradeId" required className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choisir une note</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>
                  {g.student} · {g.subject} · {g.label} · {g.value === null ? "ABS" : g.value + "/" + g.max_value} · v{g.revision}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Nouvelle valeur
            <Input name="newValue" type="number" min="0" step="0.01" />
          </label>
          <label className="grid gap-1 text-sm">
            Statut
            <select name="newStatus" defaultValue="graded" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="graded">Notée</option>
              <option value="excused">ABS justifiée</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Nouveau commentaire
            <Input name="newComment" />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Motif obligatoire
            <textarea name="reason" required minLength={1} maxLength={2000} className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Pourquoi cette correction doit-elle être demandée ?" />
          </label>
          <Button type="submit" className="w-fit">Envoyer au professeur</Button>
        </ActionForm>
      </section>

      <section className="rounded border p-5">
        <h2 className="text-xl font-semibold">Demandes actuellement en attente</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune demande en attente.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {requests.map(r => (
              <div key={r.id} className="rounded border p-3 text-sm">
                <p className="font-medium">Révision {r.old_revision} · {r.old_value === null ? "ABS" : r.old_value} → {r.new_value === null ? "ABS" : r.new_value}</p>
                <p>Demandeur : {r.requester_name ?? r.requested_by}</p>
                <p>Professeur : {r.teacher_name ?? "Professeur habilité"}</p>
                <p className="text-muted-foreground">Motif de la demande : {r.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">En attente de confirmation pédagogique · {new Date(r.requested_at).toLocaleString("fr-FR")}</p>
              </div>
                <details className="mt-3 rounded border bg-muted/20 p-3">
                  <summary className="cursor-pointer font-medium">Historique complet de la demande</summary>
                  <RequestHistory requestId={r.id} />
                </details>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
