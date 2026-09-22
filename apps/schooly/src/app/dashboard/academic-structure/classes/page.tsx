"use client"

import { useState, useEffect } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getAcademicYears, getClasses, getGradeLevels, getTeachersForSchool } from "../actions"
import { computeAcademicWindow } from "@/components/academic-year-selector"
import { ClassesPanel } from "../_components/classes-panel"

export default function ClassesPage() {
  const user = useSupabaseUser()
  const [years, setYears] = useState<{ id: string; label: string; status: string }[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  async function reload() {
    const [yr, cl, lv, te] = await Promise.all([
      getAcademicYears(), getClasses(), getGradeLevels(), getTeachersForSchool(),
    ])
    if (yr.data) setYears(yr.data)
    if (cl.data) setClasses(cl.data)
    if (lv.data) setLevels(lv.data)
    if (te.data) setTeachers(te.data)
  }

  useEffect(() => { if (user) void reload() }, [user])

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
