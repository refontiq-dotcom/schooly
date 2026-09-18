"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { ActionForm } from "@/components/action-form"
import {
  createPayment,
  getPayments,
  getOpenCashSession,
  getStudentBalances,
} from "@/app/dashboard/finance/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { toast } from "sonner"
import { CreditCard, Search, Wallet } from "lucide-react"

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

export default function CaissePage() {
  const user = useSupabaseUser()
  const [schoolId, setSchoolId] = useState<string>("")
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [session, setSession] = useState<CashSession | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedEnrollment, setSelectedEnrollment] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [amount, setAmount] = useState("")

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

      const [enrollRes, payRes, sessionRes, balancesRes] = await Promise.all([
        getEnrollments(roleData.school_id),
        getPayments(roleData.school_id),
        getOpenCashSession(roleData.school_id),
        getStudentBalances(roleData.school_id),
      ])

      if (enrollRes.data) {
        const mapped = (enrollRes.data as any[]).map((e: any) => ({
          id: e.id,
          matricule: e.matricule,
          students: e.students,
          guardians: e.guardians,
          grade_levels: e.grade_levels,
        }))
        setEnrollments(mapped)
      }
      if (payRes.data) setPayments(payRes.data as Payment[])
      if (sessionRes.data) setSession(sessionRes.data as CashSession)
      if (balancesRes.data) {
        const map: Record<string, number> = {}
        for (const b of balancesRes.data) map[b.enrollment_id] = b.balance
        setBalances(map)
      }

      setLoading(false)
    }
    fetchData()
  }, [user])

  const filteredEnrollments = enrollments.filter(e => {
    const term = search.toLowerCase()
    return (
      (e.matricule?.toLowerCase() || "").includes(term) ||
      `${e.students.last_name} ${e.students.first_name}`.toLowerCase().includes(term) ||
      e.guardians.phone.includes(term)
    )
  })

  const todayPayments = payments.filter(p => {
    const today = new Date().toISOString().split("T")[0]
    return p.received_at.startsWith(today)
  })
  const todayTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0)

  if (loading) return <div className="p-6 text-center text-muted-foreground">Chargement...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caisse</h1>
          <p className="text-muted-foreground text-sm mt-1">Encaissement et gestion des paiements</p>
        </div>
        {session && (
          <Badge variant="outline" className="text-green-600 border-green-600">
            ● Session ouverte
          </Badge>
        )}
      </div>

      {!session && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Aucune session de caisse ouverte. Ouvrez une session avant d’effectuer des encaissements.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire d’encaissement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Nouvel encaissement
            </CardTitle>
            <CardDescription>Enregistrer un paiement pour un élève</CardDescription>
          </CardHeader>
          <CardContent>
            {!session ? (
              <p className="text-sm text-muted-foreground"> Ouvrez une session de caisse pour commencer.</p>
            ) : (
              <ActionForm action={createPayment} className="space-y-4">
                <input type="hidden" name="cashSessionId" value={session.id} />
                <div className="space-y-1">
                  <Label htmlFor="enrollmentId">Élève / Matricule</Label>
                  <Select value={selectedEnrollment} onValueChange={setSelectedEnrollment} name="enrollmentId">
                    <SelectTrigger>
                      <SelectValue placeholder="Rechercher un élève..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEnrollments.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.matricule ? `${e.matricule} — ` : ""}{e.students.last_name} {e.students.first_name} ({e.grade_levels.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedEnrollment && (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 text-sm">
                    <span className="text-muted-foreground">Solde de l’élève</span>
                    <span className="font-mono font-semibold">
                      {(balances[selectedEnrollment] ?? null) === null
                        ? "…"
                        : `${(balances[selectedEnrollment] ?? 0).toLocaleString("fr-FR")} FCFA`}
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="amount">Montant (FCFA)</Label>
                  <Input
                    name="amount"
                    type="number"
                    required
                    min={1}
                    placeholder="Ex: 15000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  {selectedEnrollment && Number(amount) > 0 && (balances[selectedEnrollment] ?? Infinity) < Number(amount) && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" name="allowOverpay" /> Enregistrer comme avance volontaire (au-delà du solde)
                    </label>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paymentMethod">Mode de paiement</Label>
                  <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod} name="paymentMethod">
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Espèces</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="check">Chèque</SelectItem>
                      <SelectItem value="transfer">Virement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedPaymentMethod !== "cash" && selectedPaymentMethod !== "" && (
                  <div className="space-y-1">
                    <Label htmlFor="reference">
                      {selectedPaymentMethod === "check"
                        ? "N° de chèque *"
                        : selectedPaymentMethod === "mobile_money"
                          ? "N° de transaction (optionnel)"
                          : "Référence du virement (optionnel)"}
                    </Label>
                    <Input
                      name="reference"
                      required={selectedPaymentMethod === "check"}
                      placeholder={
                        selectedPaymentMethod === "check"
                          ? "Numéro figurant sur le chèque"
                          : "Optionnel — pour le rapprochement"
                      }
                    />
                  </div>
                )}
                <Button type="submit" className="w-full">
                  <Wallet className="h-4 w-4 mr-2" /> Encaisser
                </Button>
              </ActionForm>
            )}
          </CardContent>
        </Card>

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
                {payments.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                    <div>
                      <p className="font-medium">{p.enrollments?.students?.last_name} {p.enrollments?.students?.first_name}</p>
                      <p className="text-xs text-muted-foreground">{p.payment_method} · {new Date(p.received_at).toLocaleString("fr-FR")}</p>
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
