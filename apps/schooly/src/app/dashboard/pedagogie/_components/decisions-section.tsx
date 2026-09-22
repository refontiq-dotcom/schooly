"use client"

import { ClipboardList } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateDecisionModal } from "../decision-modal"
import { buildEnrollmentOptions, decisionBadge, formatShortDate, studentDisplayName } from "../_lib/helpers"
import type { DecisionRow, EnrollmentListRow, YearOption } from "../_lib/types"

type DecisionsSectionProps = {
  decisions: DecisionRow[]
  /** Lignes d'inscription brutes : les options du sélecteur sont dérivées. */
  enrollments: EnrollmentListRow[]
  years: YearOption[]
  currentYearId?: string
  /** Décisions du conseil : acte de direction uniquement. */
  canRecord: boolean
  onSuccess: () => void
}

/** Moyenne au format français : « 12,5 » (1 à 2 décimales). */
function formatAverage(average: number): string {
  return average.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

/** Contexte de la décision : « 6e B · 2025-2026 » (parties connues seulement). */
function decisionContext(decision: DecisionRow): string {
  return [decision.enrollments?.classes?.name, decision.academic_years?.label]
    .filter(Boolean)
    .join(" · ")
}

/** Onglet « Conseil de classe » : décisions validées + saisie. */
export function DecisionsSection({
  decisions,
  enrollments,
  years,
  currentYearId,
  canRecord,
  onSuccess,
}: DecisionsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Décisions du conseil de classe
          </CardTitle>
          <CardDescription>Admissions, redoublements et exclusions validées.</CardDescription>
        </div>
        {canRecord && (
          <CreateDecisionModal
            students={buildEnrollmentOptions(enrollments)}
            years={years}
            currentYearId={currentYearId}
            onSuccess={onSuccess}
          />
        )}
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Aucune décision enregistrée</p>
            <p className="text-sm">Les décisions du conseil de classe apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {decisions.map((decision) => {
              const badge = decisionBadge(decision.decision)
              const context = decisionContext(decision)
              return (
                <div
                  key={decision.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={badge.variant} className={badge.className}>
                      {badge.label}
                    </Badge>
                    <div>
                      <p className="font-medium">{studentDisplayName(decision.enrollments?.students)}</p>
                      <p className="text-sm text-muted-foreground">
                        {context && `${context} · `}
                        {decision.average !== null && decision.average !== undefined && (
                          <>Moyenne : {formatAverage(decision.average)}/20</>
                        )}
                      </p>
                      {decision.observations && (
                        <p className="text-sm mt-1 text-muted-foreground">{decision.observations}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(decision.decided_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
