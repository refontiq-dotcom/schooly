"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PayModal } from "../pay-modal"
import { defaultAmountFor, filterEnrollments } from "../_lib/helpers"
import type { BalanceInfo, CaisseEnrollment } from "../_lib/types"

/** Nombre maximal de lignes affichées (les résultats restent scannables). */
const MAX_ROWS = 10

type StudentDirectorySectionProps = {
  enrollments: CaisseEnrollment[]
  balanceByEnrollment: Record<string, BalanceInfo>
  onPaySuccess: () => void
}

/**
 * Recherche + liste des inscriptions : le formulaire d'encaissement vit
 * dans la modale PayModal, le solde s'affiche avant tout encaissement.
 */
export function StudentDirectorySection({
  enrollments,
  balanceByEnrollment,
  onPaySuccess,
}: StudentDirectorySectionProps) {
  const [search, setSearch] = useState("")

  const needle = search.trim()
  const visible = filterEnrollments(enrollments, needle).slice(0, MAX_ROWS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Encaisser pour un élève</CardTitle>
        <CardDescription>
          Recherchez par nom, matricule ou téléphone du parent — le solde s&apos;affiche avant tout
          encaissement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, matricule ou téléphone du parent…"
            className="pl-9"
            aria-label="Rechercher un élève"
          />
        </div>
        <div className="space-y-2">
          {visible.map((e) => {
            const info = balanceByEnrollment[e.id]
            const balance = info?.balance ?? 0
            const defaultAmount = defaultAmountFor(balance, info)
            return (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {e.students.last_name} {e.students.first_name}
                    {e.matricule && (
                      <span className="text-xs text-muted-foreground ml-2">{e.matricule}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.grade_levels.name}
                    {e.guardians.phone ? ` · ${e.guardians.phone}` : ""}
                  </p>
                  {info?.hasFeeItems && (
                    <p className="text-xs mt-0.5">
                      {balance > 0 ? (
                        <span className="text-orange-700 dark:text-orange-300">
                          Reste à payer : {balance.toLocaleString("fr-FR")} FCFA
                          {info.nextDueDate ? ` (échéance ${info.nextDueDate})` : ""}
                        </span>
                      ) : (
                        <span className="text-green-800 dark:text-green-300">Solde soldé</span>
                      )}
                    </p>
                  )}
                </div>
                <PayModal
                  enrollment={{ id: e.id, matricule: e.matricule, students: e.students }}
                  balance={balance}
                  hasFeeItems={Boolean(info?.hasFeeItems)}
                  defaultAmount={defaultAmount}
                  onSuccess={onPaySuccess}
                />
              </div>
            )
          })}
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {needle
                ? "Aucun élève ne correspond à cette recherche."
                : "Aucune inscription enregistrée."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
