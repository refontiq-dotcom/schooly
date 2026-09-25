"use client"

import { useEffect, useState } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getAcademicYears, getClasses, getGradeLevels, getTeachersForSchool } from "../actions"
import { computeAcademicWindow } from "@/components/academic-year-selector"
import { ClassesPanel } from "../_components/classes-panel"
import type { AcademicYear, ClassItem, GradeLevel, Teacher } from "../_components/types"

async function loadClassesPageData() {
  return Promise.all([getAcademicYears(), getClasses(), getGradeLevels(), getTeachersForSchool()])
}

export default function ClassesPage() {
  const user = useSupabaseUser()
  const [years, setYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [levels, setLevels] = useState<GradeLevel[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])

  async function reload() {
    const [yr, cl, lv, te] = await loadClassesPageData()
    if (yr.data) setYears(yr.data)
    if (cl.data) setClasses(cl.data)
    if (lv.data) setLevels(lv.data)
    if (te.data) setTeachers(te.data)
  }

  useEffect(() => {
    if (!user) return
    let active = true
    void loadClassesPageData().then(([yr, cl, lv, te]) => {
      if (!active) return
      if (yr.data) setYears(yr.data)
      if (cl.data) setClasses(cl.data)
      if (lv.data) setLevels(lv.data)
      if (te.data) setTeachers(te.data)
    })
    return () => { active = false }
  }, [user])

  return (
    <ClassesPanel
      classes={classes}
      levels={levels}
      teachers={teachers}
      years={years}
      currentYear={years.find((y) => y.status === "en_cours")}
      computedLabel={computeAcademicWindow().label}
      reload={reload}
    />
  )
}
