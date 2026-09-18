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
  createMoratorium,
  getMoratoriums,
  reviewMoratorium,
} from "@/app/dashboard/finance/moratoriums/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react"

type Moratorium = {
  id: string
  reason: string
  requested_amount: number
  approved_amount: number | null
  status: string
  requested_at: string
  due_date: string
  enrollments: {
    matricule: string
    students: { first_name: string; last_name: string }
    guardians: { full_name: string; phone: string }
  }
}

export default function MoratoriumsPage() {
  const user = useSupabaseUser()
  const [schoolId, setSchoolId] = useState<string>("")
  const [moratoriums, setMoratoriums] = useState<Moratorium[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
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

      const [moratoriumRes, enrollRes] = await Promise.all([
        getMoratoriums(roleData.school_id),
        getEnrollments(roleData.school_id),
      ])

      if (moratoriumRes.data) setMoratoriums(moratoriumRes.data as Moratorium[])
      if (enrollRes.data) setEnrollments(enrollRes.data as any[])

      setLoading(false)
    }
    fetchData()
  }, [user])

  async function handleCreateMoratorium(formData: FormData) {
    const result = await createMoratorium(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Demande de moratoire créée !")
      if (schoolId) {
        const res = await getMoratoriums(schoolId)
        if (res.data) setMoratoriums(res.data as Moratorium[])
      }
    }
  }

  async function handleReviewMoratorium(formData: FormData) {
    const result = await reviewMoratorium(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Moratoire traité !")
      if (schoolId) {
        const res = await getMoratoriums(schoolId)
        if (res.data) setMoratoriums(res.data as Moratorium[])
      }
    }
  }

  const pendingMoratoriums = moratoriums.filter(m => m.status === "pending")

  if (loading) return <div className="text-center text-muted-foreground">Chargement...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moratoires</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion des demandes de report de paiement
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">En attente</p>
            <p className="text-2xl font-bold mt-1">{pendingMoratoriums.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Approuvés</p>
            <p className="text-2xl font-bold mt-1">{moratoriums.filter(m => m.status === "approved").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Rejetés</p>
            <p className="text-2xl font-bold mt-1">{moratoriums.filter(m => m.status === "rejected").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire de création */}
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle demande de moratoire</CardTitle>
          <CardDescription>
            Créer une demande de report de paiement pour un élève.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={handleCreateMoratorium} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="enrollmentId">Élève</Label>
              <select name="enrollmentId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sélectionner</option>
                {enrollments.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.matricule ? `${e.matricule} — ` : ""}{e.students?.last_name} {e.students?.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Raison</Label>
              <Input name="reason" placeholder="Ex: difficultés financières temporaires" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="requestedAmount">Montant demandé (FCFA)</Label>
                <Input name="requestedAmount" type="number" required min={1} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dueDate">Date limite</Label>
                <Input name="dueDate" type="date" required />
              </div>
            </div>
            <Button type="submit">Soumettre la demande</Button>
          </ActionForm>
        </CardContent>
      </Card>

      {/* Liste des moratoires */}
      <Card>
        <CardHeader>
          <CardTitle>Demandes de moratoire</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {moratoriums.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">
                    {m.enrollments?.students?.last_name} {m.enrollments?.students?.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tuteur: {m.enrollments?.guardians?.full_name} · {m.enrollments?.guardians?.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.reason}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span>Demandé: {m.requested_amount.toLocaleString("fr-FR")} FCFA</span>
                    {m.approved_amount && (
                      <span>Approuvé: {m.approved_amount.toLocaleString("fr-FR")} FCFA</span>
                    )}
                    <span>Échéance: {m.due_date}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={
                    m.status === "pending" ? "secondary" :
                    m.status === "approved" ? "default" :
                    m.status === "rejected" ? "destructive" : "outline"
                  }>
                    {m.status === "pending" ? "En attente" :
                     m.status === "approved" ? "Approuvé" :
                     m.status === "rejected" ? "Rejeté" : m.status}
                  </Badge>
                  {m.status === "pending" && (
                    <div className="flex gap-1">
                      <ActionForm action={handleReviewMoratorium} className="flex items-center gap-1">
                        <input type="hidden" name="moratoriumId" value={m.id} />
                        <input type="hidden" name="action" value="approve" />
                        <Button type="submit" size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      </ActionForm>
                      <ActionForm action={handleReviewMoratorium} className="flex items-center gap-1">
                        <input type="hidden" name="moratoriumId" value={m.id} />
                        <input type="hidden" name="action" value="reject" />
                        <Button type="submit" size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </ActionForm>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {moratoriums.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune demande de moratoire.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
