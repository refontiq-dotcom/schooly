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
import { IntelligentGuidance } from "@/components/intelligent-guidance"
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
  enrollment_type?: string | null
  state_orientation?: string | null
  orientation_number?: string | null
  previous_matricule?: string | null
  guardian_relation?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  previous_school?: string | null
  previous_class?: string | null
}

type Student = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  status: string
  previous_school?: string | null
  previous_class?: string | null
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
  relation?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}

type Enrollment = {
  id: string
  matricule: string | null
  status: string
  enrollment_date: string
  enrollment_type?: string | null
  state_orientation?: string | null
  orientation_number?: string | null
  students: { first_name: string; last_name: string }
  guardians: { full_name: string; phone: string }
  grade_levels: { name: string }
  classes: { name: string } | null
  academic_years: { label: string }
}

const ENROLLMENT_TYPE_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle inscription",
  reinscription: "Réinscription",
}

const STATE_ORIENTATION_LABELS: Record<string, string> = {
  oriente_etat: "Orienté(e) État",
  non_oriente: "Non orienté(e)",
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
      <IntelligentGuidance items={[
        ...(pendingPreEnrollments.length > 0 ? [{ id: "validate-pre", title: `${pendingPreEnrollments.length} pré-inscription(s) attendent une décision`, description: "Validez ou traitez les dossiers en attente avant qu’ils n’expirent.", severity: "action" as const, actionLabel: "Voir les pré-inscriptions", onAction: () => setTab("pre-enrollments") }] : []),
        ...(gradeLevels.length === 0 ? [{ id: "levels", title: "La structure académique doit être préparée avant les nouvelles inscriptions", description: "Créez au moins un niveau et une classe pour pouvoir orienter correctement les élèves.", severity: "critical" as const, actionLabel: "Ouvrir la structure", onAction: () => { window.location.href = "/dashboard/academic-structure" } }] : []),
        ...(classes.length === 0 && gradeLevels.length > 0 ? [{ id: "classes", title: "Aucune classe disponible pour l’affectation", description: "Les niveaux existent, mais aucune classe n’est encore prête à accueillir un élève.", severity: "critical" as const, actionLabel: "Créer une classe", onAction: () => { window.location.href = "/dashboard/academic-structure" } }] : []),
        { id: "counter", title: "Besoin d’inscrire immédiatement un élève ?", description: "Schooly peut ouvrir directement le parcours d’inscription au guichet.", severity: "info" as const, actionLabel: "Inscrire au guichet", onAction: () => openCounter() },
      ]} />

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
                      {(pre.guardian_relation ||
                        pre.emergency_contact_name ||
                        pre.previous_school ||
                        pre.enrollment_type === "reinscription") && (
                        <p className="text-xs text-muted-foreground">
                          {[
                            pre.guardian_relation &&
                              [pre.guardian_relation, pre.guardian_name].filter(Boolean).join(" : "),
                            pre.emergency_contact_name &&
                              `Urgence : ${pre.emergency_contact_name}${pre.emergency_contact_phone ? ` (${pre.emergency_contact_phone})` : ""}`,
                            pre.previous_school &&
                              `Venant de : ${pre.previous_school}${pre.previous_class ? ` (${pre.previous_class})` : ""}`,
                            pre.enrollment_type === "reinscription" &&
                              pre.previous_matricule &&
                              `Ancien matricule : ${pre.previous_matricule}`,
                            pre.orientation_number && `N° orientation : ${pre.orientation_number}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeStatus === "pending" ? "secondary" : badgeStatus === "validated" ? "default" : "destructive"}>
                          {badgeStatus === "pending" ? "En attente" : badgeStatus === "validated" ? "Validée" : "Expirée"}
                        </Badge>
                        {pre.enrollment_type === "reinscription" && (
                          <Badge variant="outline">Réinscription</Badge>
                        )}
                        {pre.state_orientation === "oriente_etat" && (
                          <Badge variant="secondary">Orienté(e) État</Badge>
                        )}
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
                      {(s.previous_school || s.previous_class) && (
                        <p className="text-xs text-muted-foreground">
                          Venant de : {s.previous_school || "—"}
                          {s.previous_class ? ` (${s.previous_class})` : ""}
                        </p>
                      )}
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
                      {(g.relation || g.emergency_contact_name) && (
                        <p className="text-xs text-muted-foreground">
                          {[
                            g.relation && `Lien : ${g.relation}`,
                            g.emergency_contact_name &&
                              `Urgence : ${g.emergency_contact_name}${g.emergency_contact_phone ? ` (${g.emergency_contact_phone})` : ""}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
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
                        {(e.enrollment_type || e.state_orientation === "oriente_etat") && (
                          <p className="text-xs text-muted-foreground">
                            {[
                              e.enrollment_type && (ENROLLMENT_TYPE_LABELS[e.enrollment_type] ?? e.enrollment_type),
                              e.state_orientation === "oriente_etat" &&
                                `Orienté(e) État${e.orientation_number ? ` (${e.orientation_number})` : ""}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {e.enrollment_type === "reinscription" && (
                          <Badge variant="outline">Réinscription</Badge>
                        )}
                        <Badge variant={e.status === "confirmed" || e.status === "active" ? "default" : "secondary"}>
                          {e.status === "confirmed" || e.status === "active" ? "Confirmée" : e.status}
                        </Badge>
                      </div>
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
