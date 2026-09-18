"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
import { DirectoryEmpty, DirectoryToolbar } from "./directory-toolbar"
import {
  groupByInitial,
  initialOf,
  rankDirectory,
} from "@/lib/directory-search"
import {
  ENROLLMENT_TYPE_LABELS,
  enrollmentsByStudent,
  guardianChildNames,
  enrollmentHaystack,
  guardianHaystack,
  preEnrollmentHaystack,
  studentHaystack,
} from "@/lib/directory-index"

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
  enrollments?: {
    student_id?: string
    students?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]
  }[]
}

type Enrollment = {
  id: string
  student_id?: string
  guardian_id?: string
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

function preStatus(pre: PreEnrollment): "pending" | "validated" | "expired" | string {
  if (pre.status === "pending" && new Date(pre.expires_at) < new Date()) return "expired"
  return pre.status
}

export default function AdmissionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Chargement...</div>}>
      <AdmissionsPageInner />
    </Suspense>
  )
}

function AdmissionsPageInner() {
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get("q") ?? ""
  const urlTab = searchParams.get("tab") ?? ""
  const [schoolId, setSchoolId] = useState<string>("")
  const [preEnrollments, setPreEnrollments] = useState<PreEnrollment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [gradeLevels, setGradeLevels] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [tab, setTab] = useState(urlTab || "pre-enrollments")
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrefill, setModalPrefill] = useState<CounterPrefill | null>(null)

  const [preQuery, setPreQuery] = useState(urlQuery)
  const [preChip, setPreChip] = useState("pending")
  const [studentQuery, setStudentQuery] = useState(urlQuery)
  const [studentChip, setStudentChip] = useState("all")
  const [studentLetter, setStudentLetter] = useState("all")
  const [guardianQuery, setGuardianQuery] = useState(urlQuery)
  const [guardianLetter, setGuardianLetter] = useState("all")
  const [enrollQuery, setEnrollQuery] = useState(urlQuery)
  const [enrollChip, setEnrollChip] = useState("all")

  useEffect(() => {
    if (urlTab) setTab(urlTab)
    setPreQuery(urlQuery)
    setStudentQuery(urlQuery)
    setGuardianQuery(urlQuery)
    setEnrollQuery(urlQuery)
  }, [urlQuery, urlTab])

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

  const enrollmentsByStudentId = useMemo(() => enrollmentsByStudent(enrollments), [enrollments])

  const pendingPreEnrollments = preEnrollments.filter(
    (p) => p.status === "pending" && new Date(p.expires_at) >= new Date()
  )

  const preChips = useMemo(() => {
    const pending = pendingPreEnrollments.length
    const validated = preEnrollments.filter((p) => p.status === "validated").length
    const expired = preEnrollments.filter((p) => preStatus(p) === "expired").length
    const reinscription = preEnrollments.filter((p) => p.enrollment_type === "reinscription").length
    return [
      { value: "all", label: "Tous", count: preEnrollments.length },
      { value: "pending", label: "En attente", count: pending },
      { value: "validated", label: "Validées", count: validated },
      { value: "expired", label: "Expirées", count: expired },
      { value: "reinscription", label: "Réinscription", count: reinscription },
    ].filter((chip) => chip.value === "all" || chip.value === "pending" || (chip.count ?? 0) > 0)
  }, [pendingPreEnrollments.length, preEnrollments])

  const filteredPreEnrollments = useMemo(() => {
    const scoped = preEnrollments.filter((pre) => {
      if (preChip === "all") return true
      if (preChip === "reinscription") return pre.enrollment_type === "reinscription"
      return preStatus(pre) === preChip
    })
    return rankDirectory(scoped, preQuery, preEnrollmentHaystack)
  }, [preChip, preEnrollments, preQuery])

  const studentChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const student of students) {
      const grade = student.enrollments?.[0]?.grade_levels?.name || "Sans niveau"
      counts.set(grade, (counts.get(grade) ?? 0) + 1)
    }
    return [
      { value: "all", label: "Tous", count: students.length },
      ...[...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "fr"))
        .map(([value, count]) => ({ value, label: value, count })),
    ]
  }, [students])

  const rankedStudents = useMemo(() => {
    const scoped = students.filter((student) => {
      if (studentChip === "all") return true
      const grade = student.enrollments?.[0]?.grade_levels?.name || "Sans niveau"
      return grade === studentChip
    })
    return rankDirectory(scoped, studentQuery, (student) => studentHaystack(student, enrollmentsByStudentId))
  }, [enrollmentsByStudentId, studentChip, studentQuery, students])

  const studentLetters = useMemo(
    () => groupByInitial(rankedStudents, (s) => s.last_name).map((g) => g.letter),
    [rankedStudents],
  )

  const visibleStudents = useMemo(() => {
    if (studentQuery.trim() || studentLetter === "all") return rankedStudents
    return rankedStudents.filter((s) => initialOf(s.last_name) === studentLetter)
  }, [rankedStudents, studentLetter, studentQuery])

  const studentGroups = useMemo(() => {
    if (studentQuery.trim()) return [{ letter: "", items: visibleStudents }]
    return groupByInitial(visibleStudents, (s) => s.last_name)
  }, [studentQuery, visibleStudents])

  const rankedGuardians = useMemo(
    () => rankDirectory(guardians, guardianQuery, guardianHaystack),
    [guardianQuery, guardians],
  )

  const guardianLetters = useMemo(
    () => groupByInitial(rankedGuardians, (g) => g.full_name).map((g) => g.letter),
    [rankedGuardians],
  )

  const visibleGuardians = useMemo(() => {
    if (guardianQuery.trim() || guardianLetter === "all") return rankedGuardians
    return rankedGuardians.filter((g) => initialOf(g.full_name) === guardianLetter)
  }, [guardianLetter, guardianQuery, rankedGuardians])

  const guardianGroups = useMemo(() => {
    if (guardianQuery.trim()) return [{ letter: "", items: visibleGuardians }]
    return groupByInitial(visibleGuardians, (g) => g.full_name)
  }, [guardianQuery, visibleGuardians])

  const enrollChips = useMemo(() => {
    const confirmed = enrollments.filter((e) => e.status === "confirmed" || e.status === "active").length
    const reinscription = enrollments.filter((e) => e.enrollment_type === "reinscription").length
    const nouvelle = enrollments.filter((e) => e.enrollment_type === "nouvelle").length
    return [
      { value: "all", label: "Tous", count: enrollments.length },
      { value: "active", label: "Confirmées", count: confirmed },
      { value: "nouvelle", label: "Nouvelles", count: nouvelle },
      { value: "reinscription", label: "Réinscriptions", count: reinscription },
    ].filter((chip) => chip.value === "all" || (chip.count ?? 0) > 0)
  }, [enrollments])

  const filteredEnrollments = useMemo(() => {
    const scoped = enrollments.filter((enrollment) => {
      if (enrollChip === "all") return true
      if (enrollChip === "active") return enrollment.status === "confirmed" || enrollment.status === "active"
      return enrollment.enrollment_type === enrollChip
    })
    return rankDirectory(scoped, enrollQuery, enrollmentHaystack)
  }, [enrollChip, enrollQuery, enrollments])

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admissions</h1>
          <p className="text-sm text-muted-foreground">
            Pré-inscriptions, validation au guichet et encaissement.
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
              <CardTitle>Pré-inscriptions</CardTitle>
              <CardDescription>
                Utilisez la recherche en haut de page, ou les filtres ci-dessous.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DirectoryToolbar
                query={preQuery}
                onQueryChange={setPreQuery}
                placeholder="Nom, code, téléphone, matricule…"
                chips={preChips}
                chipValue={preChip}
                onChipChange={setPreChip}
                resultCount={filteredPreEnrollments.length}
                totalCount={preEnrollments.length}
                showSearch={false}
              />
              {preEnrollments.length === 0 ? (
                <DirectoryEmpty query="" onClear={() => setPreQuery("")} emptyLabel="Aucune pré-inscription." />
              ) : filteredPreEnrollments.length === 0 ? (
                <DirectoryEmpty
                  query={preQuery}
                  onClear={() => { setPreQuery(""); setPreChip("all") }}
                  emptyLabel="Aucune pré-inscription."
                />
              ) : (
                <div className="space-y-3">
                  {filteredPreEnrollments.map((pre) => {
                    const isExpired = preStatus(pre) === "expired"
                    const badgeStatus = isExpired ? "expired" : pre.status
                    return (
                      <div key={pre.id} className="flex items-center justify-between gap-3 p-4 rounded-lg border">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium">{pre.last_name} {pre.first_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Né(e) le {pre.date_of_birth} · {pre.grade_levels?.name || "Niveau non spécifié"}
                          </p>
                          {(pre.guardian_relation ||
                            pre.emergency_contact_name ||
                            pre.previous_school ||
                            pre.enrollment_type === "reinscription" ||
                            pre.guardian_name ||
                            pre.guardian_phone) && (
                            <p className="text-xs text-muted-foreground">
                              {[
                                (pre.guardian_name || pre.guardian_phone) &&
                                  [pre.guardian_relation, pre.guardian_name, pre.guardian_phone].filter(Boolean).join(" · "),
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
                          <div className="flex flex-wrap items-center gap-2">
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
                            className="min-h-11 gap-2 shrink-0"
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Élèves</CardTitle>
              <CardDescription>
                Filtrez par niveau ou par initiale. La recherche globale est dans la barre du haut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DirectoryToolbar
                query={studentQuery}
                onQueryChange={(value) => {
                  setStudentQuery(value)
                  if (value.trim()) setStudentLetter("all")
                }}
                placeholder="Nom, prénom, classe, téléphone, matricule…"
                chips={studentChips}
                chipValue={studentChip}
                onChipChange={(value) => {
                  setStudentChip(value)
                  setStudentLetter("all")
                }}
                letters={studentLetters}
                activeLetter={studentLetter}
                onLetterChange={setStudentLetter}
                resultCount={visibleStudents.length}
                totalCount={students.length}
                showSearch={false}
              />
              {students.length === 0 ? (
                <DirectoryEmpty query="" onClear={() => setStudentQuery("")} emptyLabel="Aucun élève." />
              ) : visibleStudents.length === 0 ? (
                <DirectoryEmpty
                  query={studentQuery}
                  onClear={() => { setStudentQuery(""); setStudentChip("all"); setStudentLetter("all") }}
                  emptyLabel="Aucun élève."
                />
              ) : (
                <div className="space-y-4">
                  {studentGroups.map((group) => (
                    <div key={group.letter || "results"} className="space-y-2">
                      {group.letter ? (
                        <p className="sticky top-0 z-10 bg-card/95 py-1 text-xs font-semibold tracking-wide text-muted-foreground backdrop-blur">
                          {group.letter}
                        </p>
                      ) : null}
                      {group.items.map((s) => {
                        const related = enrollmentsByStudentId.get(s.id)?.[0]
                        return (
                          <div key={s.id} className="p-3 rounded-lg border text-sm">
                            <p className="font-medium">{s.last_name} {s.first_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Né(e) le {s.date_of_birth}
                              {s.enrollments?.[0]?.grade_levels?.name ? ` · ${s.enrollments[0].grade_levels.name}` : ""}
                              {s.enrollments?.[0]?.classes?.name ? ` · ${s.enrollments[0].classes.name}` : ""}
                            </p>
                            {related?.matricule || related?.guardians?.full_name ? (
                              <p className="text-xs text-muted-foreground">
                                {[
                                  related?.matricule && `Matricule ${related.matricule}`,
                                  related?.guardians?.full_name &&
                                    `Tuteur : ${related.guardians.full_name}${related.guardians.phone ? ` · ${related.guardians.phone}` : ""}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                            {(s.previous_school || s.previous_class) && (
                              <p className="text-xs text-muted-foreground">
                                Venant de : {s.previous_school || "—"}
                                {s.previous_class ? ` (${s.previous_class})` : ""}
                              </p>
                            )}
                          </div>
                        )
                      })}
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
              <CardDescription>
                Index alphabétique. La recherche globale (nom, téléphone, enfant) est dans la barre du haut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DirectoryToolbar
                query={guardianQuery}
                onQueryChange={(value) => {
                  setGuardianQuery(value)
                  if (value.trim()) setGuardianLetter("all")
                }}
                placeholder="Nom, téléphone, nom de l’enfant…"
                letters={guardianLetters}
                activeLetter={guardianLetter}
                onLetterChange={setGuardianLetter}
                resultCount={visibleGuardians.length}
                totalCount={guardians.length}
                showSearch={false}
              />
              {guardians.length === 0 ? (
                <DirectoryEmpty query="" onClear={() => setGuardianQuery("")} emptyLabel="Aucun tuteur." />
              ) : visibleGuardians.length === 0 ? (
                <DirectoryEmpty
                  query={guardianQuery}
                  onClear={() => { setGuardianQuery(""); setGuardianLetter("all") }}
                  emptyLabel="Aucun tuteur."
                />
              ) : (
                <div className="space-y-4">
                  {guardianGroups.map((group) => (
                    <div key={group.letter || "results"} className="space-y-2">
                      {group.letter ? (
                        <p className="sticky top-0 z-10 bg-card/95 py-1 text-xs font-semibold tracking-wide text-muted-foreground backdrop-blur">
                          {group.letter}
                        </p>
                      ) : null}
                      {group.items.map((g) => {
                        const children = guardianChildNames(g)
                        return (
                          <div key={g.id} className="p-3 rounded-lg border text-sm">
                            <p className="font-medium">{g.full_name}</p>
                            <p className="text-xs text-muted-foreground">{g.phone}</p>
                            {children.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Enfant{children.length > 1 ? "s" : ""} : {children.join(", ")}
                              </p>
                            )}
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
                        )
                      })}
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
              <CardDescription>
                Filtrez par type. La recherche globale (matricule, élève, tuteur) est dans la barre du haut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DirectoryToolbar
                query={enrollQuery}
                onQueryChange={setEnrollQuery}
                placeholder="Matricule, élève, tuteur, téléphone, classe…"
                chips={enrollChips}
                chipValue={enrollChip}
                onChipChange={setEnrollChip}
                resultCount={filteredEnrollments.length}
                totalCount={enrollments.length}
                showSearch={false}
              />
              {enrollments.length === 0 ? (
                <DirectoryEmpty query="" onClear={() => setEnrollQuery("")} emptyLabel="Aucune inscription." />
              ) : filteredEnrollments.length === 0 ? (
                <DirectoryEmpty
                  query={enrollQuery}
                  onClear={() => { setEnrollQuery(""); setEnrollChip("all") }}
                  emptyLabel="Aucune inscription."
                />
              ) : (
                <div className="space-y-2">
                  {filteredEnrollments.map((e) => (
                    <div key={e.id} className="p-3 rounded-lg border text-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium font-mono">{e.matricule || "Sans matricule"}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.students?.last_name} {e.students?.first_name}
                          {e.grade_levels?.name ? ` · ${e.grade_levels.name}` : ""}
                          {e.classes?.name ? ` · ${e.classes.name}` : ""}
                          {e.academic_years?.label ? ` · ${e.academic_years.label}` : ""}
                        </p>
                        {e.guardians?.full_name || e.guardians?.phone ? (
                          <p className="text-xs text-muted-foreground">
                            Tuteur : {[e.guardians?.full_name, e.guardians?.phone].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
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
                      <div className="flex items-center gap-2 shrink-0">
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
