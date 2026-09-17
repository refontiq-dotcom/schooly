"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  getPreEnrollments,
  getStudents,
  getGuardians,
  getEnrollments,
} from "@/app/dashboard/admissions/actions"
import { Clock, GraduationCap, Users, FileText, Wallet, ArrowLeftRight } from "lucide-react"
import {
  CounterEnrollmentModal,
  type CounterPrefill,
} from "./counter-enrollment-modal"

type PreEnrollment = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  code: string
  status: string
  expires_at: string
  grade_level_id?: string | null
  guardian_phone?: string
  guardian_name?: string | null
  birth_certificate_number?: string | null
  payment_method?: string | null
  payment_reference?: string | null
  grade_levels?: { name: string }
}

type Student = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  status: string
  enrollments?: {
    grade_levels?: { name: string }
    classes?: { name: string }
  }[]
}

type Guardian = {
  id: string
  full_name: string
  phone: string
  email: string | null
}

type Enrollment = {
  id: string
  matricule: string | null
  status: string
  enrollment_date: string
  students: { first_name: string; last_name: string }
  guardians: { full_name: string; phone: string }
  grade_levels: { name: string }
  classes: { name: string } | null
  academic_years: { label: string }
}

export default function AdmissionsPage() {
  const [schoolId, setSchoolId] = useState<string>("")
  const [preEnrollments, setPreEnrollments] = useState<PreEnrollment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [gradeLevels, setGradeLevels] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [tab, setTab] = useState("pre-enrollments")
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrefill, setModalPrefill] = useState<CounterPrefill | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setLoading(false)
        return
      }

      const { data: roleData } = await supabase
        .from("user_school_roles")
        .select("school_id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (!roleData?.school_id) {
        setLoading(false)
        return
      }
      setSchoolId(roleData.school_id)

      const [preRes, stuRes, guardRes, enrollRes, gl, cls] = await Promise.all([
        getPreEnrollments(roleData.school_id),
        getStudents(roleData.school_id),
        getGuardians(roleData.school_id),
        getEnrollments(roleData.school_id),
        supabase.from("grade_levels").select("*").eq("school_id", roleData.school_id).order("level"),
        supabase.from("classes").select("*, grade_levels(name)").eq("school_id", roleData.school_id).order("name"),
      ])

      if (preRes.data) setPreEnrollments(preRes.data)
      if (stuRes.data) setStudents(stuRes.data)
      if (guardRes.data) setGuardians(guardRes.data)
      if (enrollRes.data) setEnrollments(enrollRes.data)
      if (gl.data) setGradeLevels(gl.data)
      if (cls.data) setClasses(cls.data)

      setLoading(false)
    }
    fetchData()
  }, [])

  async function refreshLists() {
    if (!schoolId) return
    const [preRes, stuRes, guardRes, enrollRes] = await Promise.all([
      getPreEnrollments(schoolId),
      getStudents(schoolId),
      getGuardians(schoolId),
      getEnrollments(schoolId),
    ])
    if (preRes.data) setPreEnrollments(preRes.data)
    if (stuRes.data) setStudents(stuRes.data)
    if (guardRes.data) setGuardians(guardRes.data)
    if (enrollRes.data) setEnrollments(enrollRes.data)
  }

  function openCounter(prefill?: CounterPrefill) {
    setModalPrefill(prefill ?? null)
    setModalOpen(true)
  }

  const pendingPreEnrollments = preEnrollments.filter(
    p => p.status === "pending" && new Date(p.expires_at) >= new Date()
  )

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admissions</h1>
          <p className="text-sm text-muted-foreground">
            Pre-inscriptions, validation au guichet et encaissement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11 gap-2">
            <Link href="/dashboard/admissions/movements">
              <ArrowLeftRight className="h-4 w-4" />
              Transferts / orientations
            </Link>
          </Button>
          <Button type="button" className="min-h-11 gap-2" onClick={() => openCounter()}>
            <Wallet className="h-4 w-4" />
            Inscrire au guichet
          </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pre-enrollments" className="gap-2">
            <Clock className="h-4 w-4" /> Pré-inscriptions {pendingPreEnrollments.length > 0 && `(${pendingPreEnrollments.length})`}
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-2">
            <GraduationCap className="h-4 w-4" /> Élèves
          </TabsTrigger>
          <TabsTrigger value="guardians" className="gap-2">
            <Users className="h-4 w-4" /> Tuteurs
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-2">
            <FileText className="h-4 w-4" /> Inscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre-enrollments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pré-inscriptions en attente</CardTitle>
              <CardDescription>
                Validez les pré-inscriptions pour générer le matricule de l’élève.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {preEnrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune pré-inscription.</p>
                )}
                {preEnrollments.map(pre => {
                  const isExpired = pre.status === "pending" && new Date(pre.expires_at) < new Date()
                  const badgeStatus = isExpired ? "expired" : pre.status
                  return (
                  <div key={pre.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">{pre.last_name} {pre.first_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Né(e) le {pre.date_of_birth} · {pre.grade_levels?.name || "Niveau non spécifié"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeStatus === "pending" ? "secondary" : badgeStatus === "validated" ? "default" : "destructive"}>
                          {badgeStatus === "pending" ? "En attente" : badgeStatus === "validated" ? "Validée" : "Expirée"}
                        </Badge>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{pre.code}</span>
                      </div>
                    </div>
                    {pre.status === "pending" && !isExpired && (
                      <Button
                        type="button"
                        size="lg"
                        className="min-h-11 gap-2"
                        onClick={() =>
                          openCounter({
                            preEnrollmentId: pre.id,
                            firstName: pre.first_name,
                            lastName: pre.last_name,
                            dateOfBirth: pre.date_of_birth,
                            gradeLevelId: pre.grade_level_id ?? undefined,
                            guardianPhone: pre.guardian_phone,
                            guardianName: pre.guardian_name ?? undefined,
                            birthCertificateNumber: pre.birth_certificate_number ?? undefined,
                            paymentMethod: pre.payment_method,
                            paymentReference: pre.payment_reference,
                          })
                        }
                      >
                        <Wallet className="w-4 h-4" /> Inscrire et encaisser
                      </Button>
                    )}
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Élèves</CardTitle>
              <CardDescription>Liste des élèves de l’établissement.</CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucun élève.</div>
              ) : (
                <div className="space-y-2">
                  {students.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-lg border text-sm">
                      <p className="font-medium">{s.last_name} {s.first_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Né(e) le {s.date_of_birth}
                        {s.enrollments?.[0]?.grade_levels?.name ? ` · ${s.enrollments[0].grade_levels.name}` : ""}
                        {s.enrollments?.[0]?.classes?.name ? ` · ${s.enrollments[0].classes.name}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <Card>
            <CardHeader>
              <CardTitle>Tuteurs</CardTitle>
              <CardDescription>Liste des tuteurs rattachés aux élèves.</CardDescription>
            </CardHeader>
            <CardContent>
              {guardians.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucun tuteur.</div>
              ) : (
                <div className="space-y-2">
                  {guardians.map((g: any) => (
                    <div key={g.id} className="p-3 rounded-lg border text-sm">
                      <p className="font-medium">{g.full_name}</p>
                      <p className="text-xs text-muted-foreground">{g.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments">
          <Card>
            <CardHeader>
              <CardTitle>Inscriptions</CardTitle>
              <CardDescription>Historique des inscriptions.</CardDescription>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucune inscription.</div>
              ) : (
                <div className="space-y-2">
                  {enrollments.map((e: any) => (
                    <div key={e.id} className="p-3 rounded-lg border text-sm flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium font-mono">{e.matricule || "Sans matricule"}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.students?.last_name} {e.students?.first_name}
                          {e.grade_levels?.name ? ` · ${e.grade_levels.name}` : ""}
                          {e.academic_years?.label ? ` · ${e.academic_years.label}` : ""}
                        </p>
                      </div>
                      <Badge variant={e.status === "confirmed" || e.status === "active" ? "default" : "secondary"}>
                        {e.status === "confirmed" || e.status === "active" ? "Confirmée" : e.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CounterEnrollmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        gradeLevels={gradeLevels}
        classes={classes}
        prefill={modalPrefill}
        onCompleted={refreshLists}
      />
    </div>
  )
}
