"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { ActionForm } from "@/components/action-form"
import {
  getOpenCashSession,
  getCashSessions,
  closeCashSession,
} from "@/app/dashboard/finance/actions"
import { toast } from "sonner"
import { ShieldCheck, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react"

type CashSession = {
  id: string
  opening_amount: number
  expected_amount: number | null
  closing_amount: number | null
  difference: number | null
  status: string
  opened_at: string
  closed_at: string | null
}

export default function CloseCashSessionPage() {
  const user = useSupabaseUser()
  const [schoolId, setSchoolId] = useState<string>("")
  const [session, setSession] = useState<CashSession | null>(null)
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [closingAmount, setClosingAmount] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setLoading(true)
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Lecture du rattachement via le client navigateur (session utilisateur,
      // politique RLS usr_read) — jamais de clé service role côté client.
      const { data: roleData } = await supabase
        .from("user_school_roles")
        .select("school_id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (!roleData?.school_id) return
      setSchoolId(roleData.school_id)

      const [sessionRes, sessionsRes] = await Promise.all([
        getOpenCashSession(roleData.school_id),
        getCashSessions(roleData.school_id),
      ])

      if (sessionRes.data) setSession(sessionRes.data as CashSession)
      if (sessionsRes.data) setSessions(sessionsRes.data as CashSession[])
      setLoading(false)
    }
    fetchData()
  }, [user])

  if (loading) return <div className="text-center text-muted-foreground">Chargement...</div>

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clôture de caisse</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Comptage à l’aveugle et réconciliation de la session
          </p>
        </div>
      </div>

      {!session ? (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Aucune session ouverte. Ouvrez une session de caisse pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Session en cours</CardTitle>
              <CardDescription>
                Ouverte le {new Date(session.opened_at).toLocaleString("fr-FR")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fonds d’ouverture</span>
                <span className="font-mono font-semibold">{session.opening_amount.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total encaissé</span>
                <span className="font-mono font-semibold">
                  {((session.expected_amount || 0) - session.opening_amount).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-muted-foreground">Montant attendu</span>
                <span className="font-mono font-bold text-lg">
                  {(session.expected_amount || 0).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comptage à l’aveugle</CardTitle>
              <CardDescription>
                Entrez le montant réel compté dans la caisse (sans regarder l’écran).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={closeCashSession} className="space-y-4">
                <input type="hidden" name="closingAmount" value={closingAmount} />
                <div className="space-y-1">
                  <Label htmlFor="closingInput">Montant compté (FCFA)</Label>
                  <Input
                    id="closingInput"
                    type="number"
                    required
                    min={0}
                    placeholder="0"
                    onChange={(e) => setClosingAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  <ShieldCheck className="h-4 w-4 mr-2" /> Clôturer la session
                </Button>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historique des sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions.map(s => {
              const diff = s.difference || 0
              return (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">
                      {new Date(s.opened_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ouverture : {s.opening_amount.toLocaleString("fr-FR")} FCFA
                      {s.closing_amount && ` · Clôture : ${s.closing_amount.toLocaleString("fr-FR")} FCFA`}
                    </p>
                  </div>
                  <div className="text-right">
                    {diff === 0 ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Équilibré
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Écart : {diff.toLocaleString("fr-FR")} FCFA
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune session enregistrée.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
