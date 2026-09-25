"use client"

import { useEffect, useState } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getAcademicYears, getGradeLevels } from "../actions"
import { computeAcademicWindow } from "@/components/academic-year-selector"
import { LevelsPanel } from "../_components/levels-panel"
import type { AcademicYear, GradeLevel } from "../_components/types"

async function loadLevelsPageData() {
  return Promise.all([getAcademicYears(), getGradeLevels()])
}

export default function LevelsPage() {
  const user = useSupabaseUser()
  const [years, setYears] = useState<AcademicYear[]>([])
  const [levels, setLevels] = useState<GradeLevel[]>([])

  async function reload() {
    const [yr, lv] = await loadLevelsPageData()
    if (yr.data) setYears(yr.data)
    if (lv.data) setLevels(lv.data)
  }

  useEffect(() => {
    if (!user) return
    let active = true
    void loadLevelsPageData().then(([yr, lv]) => {
      if (!active) return
      if (yr.data) setYears(yr.data)
      if (lv.data) setLevels(lv.data)
    })
    return () => { active = false }
  }, [user])

  return (
    <LevelsPanel
      levels={levels}
      years={years}
      currentYear={years.find((y) => y.status === "en_cours")}
      computedLabel={computeAcademicWindow().label}
      reload={reload}
    />
  )
}
