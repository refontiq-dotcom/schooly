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
import { useSupabaseUser } from "@/hooks/use-supabase-user"
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
  const user = useSupabaseUser()
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
    if (!user) return
    const fetchData = async () => {
      setLoading(true)
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const admin = (await import("@supabase/supabase-js")).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: roleData } = await admin
        .from("user_school_roles")
        .select("school_id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (!roleData?.school_id) return
      setSchoolId(roleData.school_id)

      const [preRes, stuRes, guardRes, enrollRes, fpRes] = await Promise.all([
        getPreEnrollments(roleData.school_id),
        getStudents(roleData.school_id),
        getGuardians(roleData.school_id),
        getEnrollments(roleData.school_id),
        getFinancialProfiles(roleData.school_id),
      ])

      if (preRes.data) setPreEnrollments(preRes.data)
      if (stuRes.data) setStudents(stuRes.data)
      if (guardRes.data) setGuardians(guardRes.data)
      if (enrollRes.data) setEnrollments(enrollRes.data)
      if (fpRes.data) setFinancialProfiles(fpRes.data)

      const { data: gl } = await admin.from("grade_levels").select("*").eq("school_id", roleData.school_id).order("level")
      if (gl) setGradeLevels(gl)

      const { data: ay } = await admin.from("academic_years").select("*").eq("school_id", roleData.school_id).order("start_date", { ascending: false })
      if (ay) setAcademicYears(ay)

      const { data: cls } = await admin.from("classes").select("*, grade_levels(name)").eq("school_id", roleData.school_id).order("name")
      if (cls) setClasses(cls)

      setLoading(false)
    }
    fetchData()
  }, [user])

  async function handleValidate(formData: FormData) {
    const result = await validatePreEnrollment(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Élève inscrit avec succès ! Matricule : " + result.data?.matricule)
      if (schoolId) {
        const res = await getPreEnrollments(schoolId)
        if (res.data) setPreEnrollments(res.data)
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

  const pendingPreEnrollments = preEnrollments.filter(p => p.status === "pending")

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
                Validez les pré-inscriptions pour générer le matricule de l'élève.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {preEnrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune pré-inscription.</p>
                )}
                {preEnrollments.map(pre => (
                  <div key={pre.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <p className="font-medium">{pre.last_name} {pre.first_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Né(e) le {pre.date_of_birth} · {pre.grade_levels?.name || "Niveau non spécifié"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant={pre.status === "pending" ? "secondary" : pre.status === "validated" ? "default" : "destructive"}>
                          {pre.status === "pending" ? "En attente" : pre.status === "validated" ? "Validée" : "Expirée"}
                        </Badge>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{pre.code}</span>
                      </div>
                    </div>
                    {pre.status === "pending" && (
                      <ActionForm action={handleValidate} className="flex items-center gap-2">
                        <input type="hidden" name="preEnrollmentId" value={pre.id} />
                        <Button type="submit" size="sm">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                        </Button>
                      </ActionForm>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nouvel élève</CardTitle>
              <CardDescription>Créer un élève directement (inscription manuelle).</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={handleCreateStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input name="firstName" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input name="lastName" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dateOfBirth">Date de naissance *</Label>
                  <Input name="dateOfBirth" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="birthCertificateNumber">N° acte de naissance</Label>
                  <Input name="birthCertificateNumber" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gender">Genre</Label>
                  <select name="gender" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">—</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address">Adresse</Label>
                  <Input name="address" />
                </div>
                <Button type="submit">Créer l'élève</Button>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liste des élèves ({students.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {students.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{student.last_name} {student.first_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Né(e) le {student.date_of_birth} · {student.enrollments?.[0]?.grade_levels?.name || "Non inscrit"}
                      </p>
                    </div>
                    <Badge variant={student.status === "active" ? "default" : "secondary"}>
                      {student.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nouveau tuteur</CardTitle>
              <CardDescription>Ajouter un tuteur manuellement.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={handleCreateGuardian} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="fullName">Nom complet *</Label>
                  <Input name="fullName" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input name="phone" type="tel" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input name="email" type="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address">Adresse</Label>
                  <Input name="address" />
                </div>
                <Button type="submit">Créer le tuteur</Button>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liste des tuteurs ({guardians.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {guardians.map(guardian => (
                  <div key={guardian.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{guardian.full_name}</p>
                      <p className="text-xs text-muted-foreground">{guardian.phone} · {guardian.email || "pas d'email"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle inscription</CardTitle>
              <CardDescription>Inscrire un élève existant.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={handleCreateEnrollment} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="studentId">Élève *</Label>
                  <select name="studentId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sélectionner</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="guardianId">Tuteur *</Label>
                  <select name="guardianId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sélectionner</option>
                    {guardians.map(g => (
                      <option key={g.id} value={g.id}>{g.full_name} — {g.phone}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gradeLevelId">Niveau *</Label>
                  <select name="gradeLevelId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sélectionner</option>
                    {gradeLevels.map(gl => (
                      <option key={gl.id} value={gl.id}>{gl.name} — {gl.cycle}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="classId">Classe</Label>
                  <select name="classId" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Aucune</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name} — {cls.grade_levels?.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="academicYearId">Année académique *</Label>
                  <select name="academicYearId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sélectionner</option>
                    {academicYears.map(ay => (
                      <option key={ay.id} value={ay.id}>{ay.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="financialProfileId">Profil financier</Label>
                  <select name="financialProfileId" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Aucun</option>
                    {financialProfiles.map(fp => (
                      <option key={fp.id} value={fp.id}>{fp.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Inscrire l'élève</Button>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inscriptions récentes ({enrollments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {enrollments.map(enrollment => (
                  <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">
                        {enrollment.students?.last_name} {enrollment.students?.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.grade_levels?.name} · {enrollment.classes?.name || "Sans classe"} · {enrollment.academic_years?.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tuteur: {enrollment.guardians?.full_name} ({enrollment.guardians?.phone})
                      </p>
                    </div>
                    <div className="text-right">
                      {enrollment.matricule && (
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded block mb-1">
                          {enrollment.matricule}
                        </span>
                      )}
                      <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>
                        {enrollment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
