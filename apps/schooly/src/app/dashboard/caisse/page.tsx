"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import {
  getPayments,
  getOpenCashSession,
  getStudentBalances,
} from "@/app/dashboard/finance/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { PayModal } from "./pay-modal"
import { OpenSessionModal } from "./open-session-modal"
import { Search, ShieldCheck } from "lucide-react"

type Enrollment = {
  id: string
  matricule: string | null
  students: { first_name: string; last_name: string }
  guardians: { full_name: string; phone: string }
  grade_levels: { name: string }
}

type Payment = {
  id: string
  amount: number
  payment_method: string
  reference: string | null
  received_at: string
  enrollments: {
    matricule: string
    students: { first_name: string; last_name: string }
    guardians: { full_name: string }
  }
}

type CashSession = {
  id: string
  opening_amount: number
  status: string
  opened_at: string
}

type BalanceInfo = {
  balance: number
  hasFeeItems: boolean
  nextDueAmount: number | null
  nextDueDate: string | null
}

export default function CaissePage() {
  const user = useSupabaseUser()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [session, setSession] = useState<CashSession | null>(null)
  const [balanceByEnrollment, setBalanceByEnrollment] = useState<Record<string, BalanceInfo>>({})
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const supabase = await createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || cancelled) return

        // Lecture du rattachement via le client navigateur (session utilisateur,
        // politique RLS usr_read) — jamais de clé service role côté client.
        const { data: roleData } = await supabase
          .from("user_school_roles")
          .select("school_id")
          .eq("user_id", authUser.id)
          .eq("is_active", true)
          .limit(1)
          .single()

        if (!roleData?.school_id || cancelled) return

        const [enrollRes, payRes, sessionRes, balancesRes] = await Promise.all([
          getEnrollments(roleData.school_id),
          getPayments(roleData.school_id),
          getOpenCashSession(roleData.school_id),
          getStudentBalances(roleData.school_id),
        ])

        if (cancelled) return
        if (enrollRes.data) {
          setEnrollments((enrollRes.data as any[]).map((e: any) => ({
            id: e.id,
            matricule: e.matricule ?? null,
            students: e.students,
            guardians: e.guardians,
            grade_levels: e.grade_levels,
          })))
        }
        if (payRes.data) setPayments(payRes.data as Payment[])
        if (sessionRes.data) setSession(sessionRes.data as CashSession)
        if (balancesRes.data) {
          const map: Record<string, BalanceInfo> = {}
          for (const row of balancesRes.data as any[]) {
            map[row.enrollment_id] = {
              balance: Number(row.balance ?? 0),
              hasFeeItems: Boolean(row.has_fee_items),
              nextDueAmount: row.next_due_amount != null ? Number(row.next_due_amount) : null,
              nextDueDate: row.next_due_date ?? null,
            }
          }
          setBalanceByEnrollment(map)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [user, refreshKey])

  const needle = search.trim().toLowerCase()
  const filtered = needle
    ? enrollments.filter((e) => {
        const hay = [
          e.students?.first_name ?? "",
          e.students?.last_name ?? "",
          e.matricule ?? "",
          e.guardians?.phone ?? "",
          e.grade_levels?.name ?? "",
        ].join(" ").toLowerCase()
        return hay.includes(needle)
      })
    : enrollments
  const visible = filtered.slice(0, 10)

  const today = new Date().toISOString().slice(0, 10)
  const todayPayments = payments.filter((p) => (p.received_at ?? "").slice(0, 10) === today)
  const todayTotal = todayPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0)

  if (loading) return <div className="p-6 text-center text-muted-foreground">Chargement...</div>

  return (
    <div className="p-6 space-y-6">
      {/* En-tête : statut de la session + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caisse</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {session
              ? `Session ouverte depuis ${new Date(session.opened_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — fond ${(session.opening_amount ?? 0).toLocaleString("fr-FR")} FCFA`
              : "Aucune session ouverte — obligatoire pour encaisser en espèces."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Badge variant="default" className="bg-green-800">
                <ShieldCheck className="h-3 w-3 mr-1" /> Session ouverte
              </Badge>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href="/dashboard/caisse/close">Clôturer</a>
              </Button>
            </>
          ) : (
            <OpenSessionModal onOpened={() => setRefreshKey((k) => k + 1)} />
          )}
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href="/dashboard/caisse/history">Historique</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recherche + liste : le formulaire d encaissement vit dans la modale */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Encaisser pour un élève</CardTitle>
              <CardDescription>
                Recherchez par nom, matricule ou téléphone du parent — le solde s&apos;affiche avant tout encaissement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
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
                  const defaultAmount =
                    info?.nextDueAmount != null && info.nextDueAmount > 0
                      ? String(info.nextDueAmount)
                      : balance > 0
                        ? String(balance)
                        : ""
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {e.students?.last_name} {e.students?.first_name}
                          {e.matricule && (
                            <span className="text-xs text-muted-foreground ml-2">{e.matricule}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {e.grade_levels?.name}
                          {e.guardians?.phone ? ` · ${e.guardians.phone}` : ""}
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
                        onSuccess={() => setRefreshKey((k) => k + 1)}
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
        </div>

        {/* Résumé */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aujourd’hui</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{todayTotal.toLocaleString("fr-FR")} FCFA</p>
              <p className="text-xs text-muted-foreground mt-1">{todayPayments.length} transaction(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Derniers encaissements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {p.enrollments?.students?.last_name} {p.enrollments?.students?.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.payment_method} · {new Date(p.received_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <span className="font-mono font-semibold">{p.amount.toLocaleString("fr-FR")}</span>
                  </div>
                ))}
                {payments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun encaissement.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
