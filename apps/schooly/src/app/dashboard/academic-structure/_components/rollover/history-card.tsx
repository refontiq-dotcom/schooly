import { useState } from "react"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RolloverLog } from "./types"

type RolloverHistoryCardProps = {
  logs: RolloverLog[]
}

/** Historique repliable des bascules effectuées. */
export function RolloverHistoryCard({ logs }: RolloverHistoryCardProps) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between cursor-pointer"
        onClick={() => setShowHistory((f) => !f)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5" /> Historique des bascules
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {showHistory ? "Masquer" : "Afficher"}
        </span>
      </CardHeader>
      {showHistory && (
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">
              Aucune bascule effectuée.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {log.old_year?.label} → {log.new_year?.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Par {log.initiator?.full_name ?? "—"} ·{" "}
                      {new Date(log.initiated_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={log.status === "completed" ? "default" : "destructive"}>
                      {log.status === "completed" ? "Réussie" : "Échouée"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      +{log.students_promoted} · ↺{log.students_repeated} · ✕
                      {log.students_excluded}
                      {(log.students_without_class ?? 0) > 0
                        ? ` · ⚑${log.students_without_class} sans classe`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
