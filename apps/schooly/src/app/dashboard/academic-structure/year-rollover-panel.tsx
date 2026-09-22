"use client"

import { useState, useEffect, useTransition } from "react"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
// Années : UNE seule implémentation, celle du module Structure académique
// (actions.ts). Le panneau entretenait sa propre paire getAcademicYears /
// createAcademicYear, avec d'autres noms de champs (start_date vs startDate),
// un statut forcé différent et un filtre deleted_at absent : deux vérités pour
// la même table, deux formulaires de création sur la même page.
import { getAcademicYears } from "./actions"
import { canRunRollover, getRolloverLogs } from "./rollover-actions"
import { RolloverHistoryCard } from "./_components/rollover/history-card"
import { RolloverWizard } from "./_components/rollover/rollover-wizard"
import {
  YearsListCard,
} from "./_components/rollover/years-list-card"
import {
  messageFrom,
  normalizeRolloverLogs,
  type AcademicYear,
  type RolloverLog,
} from "./_components/rollover/types"

/**
 * Panneau de bascule d'année : orchestration (accès, chargement, composition).
 * Les étapes de bascule vivent dans `RolloverWizard`, la liste des années dans
 * `YearsListCard`, l'historique dans `RolloverHistoryCard`.
 */
export function YearRolloverPanel() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [logs, setLogs] = useState<RolloverLog[]>([])
  const [, startTransition] = useTransition()

  // La bascule est réservée à la direction (ROLLOVER_ROLES). Le secretariat
  // peut consulter la page : on teste le droit AVANT d'appeler les actions
  // protégées, qui rejettent — sinon la page restait vide sans explication.
  const [isAllowed, setIsAllowed] = useState(false)
  const [accessMsg, setAccessMsg] = useState<string | null>(null)

  const load = () => {
    startTransition(async () => {
      try {
        const yearsRes = await getAcademicYears()
        if ("data" in yearsRes && yearsRes.data) setYears(yearsRes.data as AcademicYear[])

        const access = await canRunRollover()
        setIsAllowed(access.allowed)
        if (!access.allowed) {
          setAccessMsg(access.error ?? null)
          return
        }
        setAccessMsg(null)

        const logsRes = await getRolloverLogs()
        if ("data" in logsRes && logsRes.data) setLogs(normalizeRolloverLogs(logsRes.data))
      } catch (err) {
        setAccessMsg(messageFrom(err))
      }
    })
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      {accessMsg && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">Bascule non disponible</p>
              <p className="mt-0.5">{accessMsg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <YearsListCard years={years} />

      {/* Bascule d'année + historique : réservés aux rôles autorisés */}
      {isAllowed && (
        <>
          <RolloverWizard years={years} onExecuted={load} />
          <RolloverHistoryCard logs={logs} />
        </>
      )}
    </div>
  )
}
