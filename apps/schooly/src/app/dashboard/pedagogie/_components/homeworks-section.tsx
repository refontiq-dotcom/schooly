"use client"

import { BookOpen, Calendar, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateHomeworkModal } from "../homework-modal"
import { formatDeadline } from "../_lib/helpers"
import type { ClassOption, HomeworkListRow, SubjectOption } from "../_lib/types"

type HomeworksSectionProps = {
  homeworks: HomeworkListRow[]
  classes: ClassOption[]
  subjects: SubjectOption[]
  canCreate: boolean
  onSuccess: () => void
}

/** Sommaire d'un devoir : « Mathématiques · 6e B » (parties connues seulement). */
function homeworkContext(homework: HomeworkListRow): string {
  return [homework.subjects?.name, homework.classes?.name].filter(Boolean).join(" · ")
}

/** Onglet « Cahier de texte » : devoirs assignés + création. */
export function HomeworksSection({
  homeworks,
  classes,
  subjects,
  canCreate,
  onSuccess,
}: HomeworksSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Cahier de texte
          </CardTitle>
          <CardDescription>Devoirs et travaux assignés aux élèves.</CardDescription>
        </div>
        {canCreate && (
          <CreateHomeworkModal classes={classes} subjects={subjects} onSuccess={onSuccess} />
        )}
      </CardHeader>
      <CardContent>
        {homeworks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Aucun devoir assigné</p>
            <p className="text-sm">Ajoutez votre premier devoir pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {homeworks.map((homework) => (
              <div
                key={homework.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{homework.title}</p>
                      {!homework.is_published && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          Brouillon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{homeworkContext(homework)}</p>
                    {homework.description && (
                      <p className="text-sm mt-1 text-muted-foreground">{homework.description}</p>
                    )}
                    <p className="text-sm mt-2 flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Calendar className="h-3 w-3" />
                      Échéance : {formatDeadline(homework.due_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">
                    Modifier
                  </Button>
                  <Button size="sm">Publier</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
