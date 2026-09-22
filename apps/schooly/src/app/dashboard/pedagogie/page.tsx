// apps/schooly/src/app/dashboard/pedagogie/page.tsx
//
// Hub pédagogique : cette page ne garde que le chargement des données et leur
// rafraîchissement après création. L'affichage (guidance, onglets, listes) vit
// dans _components/, la logique pure (formatage, règles, gardes) dans _lib/.
"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import {
  getAcademicDecisions,
  getAcademicYearsForSchool,
  getClassesForSchool,
  getCourseSessions,
  getEnrollmentsForSchool,
  getHomeworks,
  getSubjectsForSchool,
  getTeachersForSchool,
} from "./actions"
import { PedagogieView } from "./_components/pedagogie-view"
import { canRecordDecision, canWriteTeachingContent } from "./_lib/helpers"
import type {
  ClassOption,
  DecisionRow,
  EnrollmentListRow,
  HomeworkListRow,
  SessionRow,
  SubjectOption,
  TeacherOption,
  YearOption,
} from "./_lib/types"

export default function PedagogieDashboard() {
  const user = useSupabaseUser()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [homeworks, setHomeworks] = useState<HomeworkListRow[]>([])
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [academicYears, setAcademicYears] = useState<YearOption[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentListRow[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadAllData = async () => {
      setLoadingData(true)
      // Les huit lectures sont indépendantes : chargées en parallèle plutôt
      // qu'en cascade (l'ancienne version enchaînait huit allers-retours).
      const [
        sessionsRes,
        homeworksRes,
        decisionsRes,
        classesRes,
        subjectsRes,
        teachersRes,
        yearsRes,
        enrollRes,
      ] = await Promise.all([
        getCourseSessions(),
        getHomeworks(),
        getAcademicDecisions(),
        getClassesForSchool(),
        getSubjectsForSchool(),
        getTeachersForSchool(),
        getAcademicYearsForSchool(),
        getEnrollmentsForSchool(),
      ])

      if (cancelled) return
      if (sessionsRes.data) setSessions(sessionsRes.data)
      if (homeworksRes.data) setHomeworks(homeworksRes.data)
      if (decisionsRes.data) setDecisions(decisionsRes.data)
      if (classesRes.data) setClasses(classesRes.data)
      if (subjectsRes.data) setSubjects(subjectsRes.data)
      if (teachersRes.data) setTeachers(teachersRes.data)
      if (yearsRes.data) setAcademicYears(yearsRes.data)
      // Lignes brutes conservées telles quelles : les libellés du sélecteur
      // sont dérivés par `buildEnrollmentOptions` (testé unitairement).
      if (enrollRes.data) setEnrollments(enrollRes.data)
      setLoadingData(false)
    }

    loadAllData()
    return () => {
      cancelled = true
    }
  }, [user, refreshKey])

  const currentYear = academicYears.find((year) => year.status === "en_cours")
  const plannedYear = academicYears.find((year) => year.status === "planifiee")

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])
  const navigateToStructure = useCallback(() => {
    router.push("/dashboard/academic-structure")
  }, [router])

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        <p className="ml-3 text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <PedagogieView
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      years={academicYears}
      currentYearId={currentYear?.id}
      currentYearLabel={currentYear?.label}
      plannedYearLabel={plannedYear?.label}
      defaultTeacherId={user?.id}
      sessions={sessions}
      homeworks={homeworks}
      decisions={decisions}
      enrollments={enrollments}
      canWriteContent={canWriteTeachingContent(user?.role)}
      canDecide={canRecordDecision(user?.role)}
      onRefresh={refresh}
      onNavigateToStructure={navigateToStructure}
    />
  )
}
