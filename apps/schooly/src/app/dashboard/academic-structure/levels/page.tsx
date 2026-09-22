"use client"

import { useState, useEffect } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getAcademicYears, getGradeLevels } from "../actions"
import { computeAcademicWindow } from "@/components/academic-year-selector"
import { LevelsPanel } from "../_components/levels-panel"

export default function LevelsPage() {
  const user = useSupabaseUser()
  const [years, setYears] = useState<{ id: string; label: string; status: string }[]>([])
  const [levels, setLevels] = useState<{ id: string; name: string; level: number; cycle: string }[]>([])

  async function reload() {
    const [yr, lv] = await Promise.all([getAcademicYears(), getGradeLevels()])
    if (yr.data) setYears(yr.data)
    if (lv.data) setLevels(lv.data)
  }

  useEffect(() => { if (user) void reload() }, [user])

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
