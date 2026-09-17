"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ActionForm } from "@/components/action-form"
import {
  getPreEnrollments,
  validatePreEnrollment,
  getStudents,
  createStudent,
  getGuardians,
  createGuardian,
  getEnrollments,
  createEnrollment,
  getFinancialProfiles,
} from "@/app/dashboard/admissions/actions"
import { toast } from "sonner"
import { CheckCircle2, Clock, XCircle, UserPlus, GraduationCap, Users, FileText } from "lucide-react"

type PreEnrollment = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  code: string
  status: string
  expires_at: string
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

type FinancialProfile = {
  id: string
  name: string
  description: string | null
}

export default function AdmissionsPage() {
  const [schoolId, setSchoolId] = useState<string>("")
  const [preEnrollments, setPreEnrollments] = useState<PreEnrollment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [financialProfiles, setFinancialProfiles] = useState<FinancialProfile[]>([])
  const [gradeLevels, setGradeLevels] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [tab, setTab] = useState("pre-enrollments")
  const [loading, setLoading] = useState(false)

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

      const [preRes, stuRes, guardRes, enrollRes, fpRes, gl, ay, cls] = await Promise.all([
        getPreEnrollments(roleData.school_id),
        getStudents(roleData.school_id),
        getGuardians(roleData.school_id),
        getEnrollments(roleData.school_id),
        getFinancialProfiles(roleData.school_id),
        supabase.from("grade_levels").select("*").eq("school_id", roleData.school_id).order("level"),
        supabase.from("academic_years").select("*").eq("school_id", roleData.school_id).order("start_date", { ascending: false }),
        supabase.from("classes").select("*, grade_levels(name)").eq("school_id", roleData.school_id).order("name"),
      ])

      if (preRes.data) setPreEnrollments(preRes.data)
      if (stuRes.data) setStudents(stuRes.data)
      if (guardRes.data) setGuardians(guardRes.data)
      if (enrollRes.data) setEnrollments(enrollRes.data)
      if (fpRes.data) setFinancialProfiles(fpRes.data)
      if (gl.data) setGradeLevels(gl.data)
      if (ay.data) setAcademicYears(ay.data)
      if (cls.data) setClasses(cls.data)

      setLoading(false)
    }
    fetchData()
  }, [])

  async function handleValidate(formData: FormData) {
    const result = await validatePreEnrollment(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Élève inscrit avec succès ! Matricule : " + result.data?.matricule)
      if (schoolId) {
        const [preRes, enrollRes] = await Promise.all([
          getPreEnrollments(schoolId),
          getEnrollments(schoolId),
        ])
        if (preRes.data) setPreEnrollments(preRes.data)
        if (enrollRes.data) setEnrollments(enrollRes.data)
      }
    }
    return result
  }

  async function handleCreateStudent(formData: FormData) {
    const result = await createStudent(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Élève créé !")
      if (schoolId) {
        const res = await getStudents(schoolId)
        if (res.data) setStudents(res.data)
      }
    }
    return result
  }

  async function handleCreateGuardian(formData: FormData) {
    const result = await createGuardian(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Tuteur créé !")
      if (schoolId) {
        const res = await getGuardians(schoolId)
        if (res.data) setGuardians(res.data)
      }
    }
    return result
  }

  async function handleCreateEnrollment(formData: FormData) {
    const result = await createEnrollment(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Inscription créée ! Matricule : " + result.data?.matricule)
      if (schoolId) {
        const res = await getEnrollments(schoolId)
        if (res.data) setEnrollments(res.data)
      }
    }
    return result
  }

  const pendingPreEnrollments = preEnrollments.filter(
    p => p.status === "pending" && new Date(p.expires_at) >= new Date()
  )

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Chargement...</div>
  }

  return (
    <div className="space-y-6">
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
                      <ActionForm action={handleValidate}>
                        <input type="hidden" name="preEnrollmentId" value={pre.id} />
                        <Button size="sm">
                          <CheckCircle2 className="w-4 h-4" /> Valider
                        </Button>
                      </ActionForm>
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
    </div>
  )
}
