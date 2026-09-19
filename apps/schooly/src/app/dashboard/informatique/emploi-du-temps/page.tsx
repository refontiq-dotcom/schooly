import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { getCourseSessions, getClassesForSchool, getSubjectsForSchool, getTeachersForSchool, getAcademicYearsForSchool } from "@/app/dashboard/pedagogie/actions"
import { CreateSessionModal } from "@/app/dashboard/pedagogie/session-modal"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Clock3, Users } from "lucide-react"

export default async function InformatiqueTimetablePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const guard = await requireSchoolRole(supabase, { allowedRoles: ["informatique"] })
  if (!guard.ok) redirect("/login")

  const [sessions, classes, subjects, teachers, years] = await Promise.all([
    getCourseSessions(), getClassesForSchool(), getSubjectsForSchool(), getTeachersForSchool(), getAcademicYearsForSchool(),
  ])

  const rows = sessions.data ?? []
  const byDay = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = new Date(row.starts_at).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" })
    byDay.set(key, [...(byDay.get(key) ?? []), row])
  }

  return <div className="space-y-6 p-5 sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Administration Schooly</p>
        <h1 className="text-3xl font-semibold tracking-tight">Emploi du temps</h1>
        <p className="mt-1 text-sm text-muted-foreground">Un planning unique relie classes, matières, professeurs et créneaux. Les mêmes données servent ensuite aux cours, à l’appel et aux vues élèves/parents.</p>
      </div>
      <CreateSessionModal
        classes={classes.data ?? []}
        subjects={subjects.data ?? []}
        teachers={teachers.data ?? []}
        years={years.data ?? []}
        currentYearId={years.data?.find(y => y.status === "en_cours")?.id}
      />
    </div>

    {sessions.error ? <p className="text-sm text-destructive">{sessions.error}</p> : null}

    {rows.length === 0 ? (
      <Card><CardContent className="p-8 text-center">
        <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Aucun cours planifié</p>
        <p className="mt-1 text-sm text-muted-foreground">Commencez par affecter les professeurs aux matières, puis planifiez les créneaux.</p>
        <Link className="mt-4 inline-block text-sm underline" href="/dashboard/academic-structure">Vérifier les affectations</Link>
      </CardContent></Card>
    ) : (
      <div className="space-y-4">
        {[...byDay.entries()].map(([day, dayRows]) => (
          <Card key={day}>
            <CardHeader><CardTitle className="capitalize text-base">{day}</CardTitle><CardDescription>{dayRows.length} cours planifié(s)</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {dayRows.map(row => (
                <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{row.subjects?.name ?? "Matière"} · {row.classes?.name ?? "Classe"}</p>
                      <p className="text-sm text-muted-foreground">{row.users?.full_name ?? "Professeur"}{row.room ? ` · ${row.room}` : ""}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{new Date(row.starts_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} – {new Date(row.ends_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )}

    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-5">
        <div className="flex gap-3"><Users className="mt-0.5 h-5 w-5" /><div>
          <p className="font-medium">Synchronisation automatique</p>
          <p className="mt-1 text-sm text-muted-foreground">Une modification du planning doit alimenter la vue du professeur, l’appel par cours et les vues élève/parent sans recréer les informations ailleurs.</p>
        </div></div>
      </CardContent>
    </Card>
  </div>
}
