"use client"

import { Calendar } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateSessionModal } from "../session-modal"
import { formatSessionDay, sessionTimeRange, sessionTitle } from "../_lib/helpers"
import type { ClassOption, SessionRow, SubjectOption, TeacherOption, YearOption } from "../_lib/types"

type SessionsSectionProps = {
  sessions: SessionRow[]
  classes: ClassOption[]
  subjects: SubjectOption[]
  teachers: TeacherOption[]
  years: YearOption[]
  currentYearId?: string
  defaultTeacherId?: string
  /** Rôle d'écriture : la modale de planification n'apparaît que si autorisé. */
  canCreate: boolean
  /** Rechargement des données après création (clé de refresh de la page). */
  onSuccess: () => void
}

/** Onglet « Cours & Appels » : planning des séances + planification. */
export function SessionsSection({
  sessions,
  classes,
  subjects,
  teachers,
  years,
  currentYearId,
  defaultTeacherId,
  canCreate,
  onSuccess,
}: SessionsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Sessions de cours
          </CardTitle>
          <CardDescription>Planning des cours programmés pour cette période.</CardDescription>
        </div>
        {canCreate && (
          <CreateSessionModal
            classes={classes}
            subjects={subjects}
            teachers={teachers}
            years={years}
            currentYearId={currentYearId}
            defaultTeacherId={defaultTeacherId}
            onSuccess={onSuccess}
          />
        )}
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Aucun cours programmé</p>
            <p className="text-sm">Créez votre première session de cours pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{sessionTitle(session)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSessionDay(session.starts_at)} ·{" "}
                      {sessionTimeRange(session.starts_at, session.ends_at)}
                      {session.room && ` · ${session.room}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-muted-foreground">
                    {session.users?.full_name || "Professeur à assigner"}
                  </Badge>
                  {/* L'appel vit sur son écran dédié : le bouton y mène au lieu
                      de rester sans action. */}
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/pedagogie/attendance">Appeler</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
