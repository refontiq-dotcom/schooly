"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import {
  getMoratoriums,
} from "@/app/dashboard/finance/moratoriums/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { AddMoratoriumModal } from "./add-moratorium-modal"
import { ReviewMoratoriumModal } from "./review-moratorium-modal"

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

  async function refreshMoratoriums() {
    if (!schoolId) return
    const res = await getMoratoriums(schoolId)
    if (res.data) setMoratoriums(res.data as Moratorium[])
  }

  const pendingMoratoriums = moratoriums.filter(m => m.status === "pending")

  if (loading) return <div className="p-6 text-center text-muted-foreground">Chargement...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moratoires</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Demandes de report de paiement ({moratoriums.length})
          </p>
        </div>
        <AddMoratoriumModal
          enrollments={enrollments.map((e) => ({
            id: e.id,
            matricule: e.matricule ?? null,
            label: `${e.matricule ? `${e.matricule} — ` : ""}${e.students?.last_name ?? ""} ${e.students?.first_name ?? ""}`.trim(),
          }))}
          onSuccess={() => { void refreshMoratoriums() }}
        />
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
                    <ReviewMoratoriumModal
                      moratorium={{
                        id: m.id,
                        requested_amount: m.requested_amount,
                        reason: m.reason,
                        due_date: m.due_date,
                        student: `${m.enrollments?.students?.last_name ?? ""} ${m.enrollments?.students?.first_name ?? ""}`.trim(),
                      }}
                      onSuccess={() => { void refreshMoratoriums() }}
                    />
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
