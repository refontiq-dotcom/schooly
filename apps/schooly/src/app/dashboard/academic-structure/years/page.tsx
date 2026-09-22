"use client"

/**
 * Page « Années » — autonome.
 * Wrapper du panneau YearsPanel : charge ses données et expose un `reload`.
 * Le test du hub moque cette page — celle-ci-même n'est donc pas couverte
 * par tabs/page.test.tsx, mais par son propre test d'extrémité.
 */
import { useState, useEffect } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getAcademicYears } from "../actions"
import { computeAcademicWindow } from "@/components/academic-year-selector"
import { YearsPanel } from "../_components/years-panel"

export default function YearsPage() {
  const user = useSupabaseUser()
  const [years, setYears] = useState<{ id: string; label: string; status: string }[]>([])

  async function reload() {
    const res = await getAcademicYears()
    if (res.data) setYears(res.data)
  }

  useEffect(() => { if (user) void reload() }, [user])

  const currentYear = years.find((y) => y.status === "en_cours")
  return (
    <YearsPanel
      years={years}
      currentYear={currentYear}
      computedLabel={computeAcademicWindow().label}
      reload={reload}
    />
  )
}
