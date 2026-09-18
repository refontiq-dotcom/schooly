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
  sendPaymentReminder,
  getPaymentReminders,
} from "@/app/dashboard/finance/moratoriums/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { toast } from "sonner"
import { Bell, Clock, AlertTriangle } from "lucide-react"

type PaymentReminder = {
  id: string
  reminder_type: string
  channel: string
  sent_at: string
  enrollments: {
    matricule: string
    students: { first_name: string; last_name: string }
    guardians: { full_name: string; phone: string }
  }
}

export default function RemindersPage() {
  const user = useSupabaseUser()
  const [schoolId, setSchoolId] = useState<string>("")
  const [reminders, setReminders] = useState<PaymentReminder[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [channel, setChannel] = useState<string>("email")

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

      const [remindersRes, enrollRes] = await Promise.all([
        getPaymentReminders(roleData.school_id),
        getEnrollments(roleData.school_id),
      ])

      if (remindersRes.data) setReminders(remindersRes.data as PaymentReminder[])
      if (enrollRes.data) setEnrollments(enrollRes.data as any[])

      setLoading(false)
    }
    fetchData()
  }, [user])

  async function handleSendReminder(formData: FormData) {
    const result = await sendPaymentReminder(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Relance envoyée !")
      if (schoolId) {
        const res = await getPaymentReminders(schoolId)
        if (res.data) setReminders(res.data as PaymentReminder[])
      }
    }
  }

  if (loading) return <div className="text-center text-muted-foreground">Chargement...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relances de paiement</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Workflow gradué de relance : J-5 préventif, J+1 formel, J+7 avertissement
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Préventives (J-5)</p>
            <p className="text-2xl font-bold mt-1">{reminders.filter(r => r.reminder_type === "preventive").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Formelles (J+1)</p>
            <p className="text-2xl font-bold mt-1">{reminders.filter(r => r.reminder_type === "formal").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Avertissements (J+7)</p>
            <p className="text-2xl font-bold mt-1">{reminders.filter(r => r.reminder_type === "warning").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire d’envoi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Envoyer une relance
          </CardTitle>
          <CardDescription>
            Envoyer une relance de paiement à un tuteur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={handleSendReminder} className="space-y-4">
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
              <Label htmlFor="reminderType">Type de relance</Label>
              <Select name="reminderType" required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Préventive (J-5)</SelectItem>
                  <SelectItem value="formal">Formelle (J+1)</SelectItem>
                  <SelectItem value="warning">Avertissement (J+7)</SelectItem>
                  <SelectItem value="access_restriction">Restriction d’accès</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="channel">Canal</Label>
              <Select name="channel" value={channel} onValueChange={setChannel} required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">Push PWA</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              <Bell className="h-4 w-4 mr-2" /> Envoyer la relance
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des relances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reminders.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <p className="font-medium">
                    {r.enrollments?.students?.last_name} {r.enrollments?.students?.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.enrollments?.guardians?.full_name} · {r.enrollments?.guardians?.phone}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="capitalize">
                    {r.reminder_type === "preventive" ? "Préventive" :
                     r.reminder_type === "formal" ? "Formelle" :
                     r.reminder_type === "warning" ? "Avertissement" : r.reminder_type}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.sent_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
            {reminders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune relance envoyée.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
