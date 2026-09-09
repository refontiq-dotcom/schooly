"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"

type AcademicYear = {
  id: string
  label: string
  status: string
}

async function getAcademicYears(schoolId: string) {
  const { data: { user } } = await (await createClient()).auth.getUser()

  if (!user) return []

  const admin = (await import("@supabase/supabase-js")).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from("academic_years")
    .select("id, label, status")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })

  return data || []
}

export function AcademicYearSelector({ schoolId }: { schoolId?: string }) {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!schoolId) return
    getAcademicYears(schoolId).then(data => {
      setYears(data)
      const current = data.find(y => y.status === "en_cours")
      if (current) {
        setSelectedId(current.id)
        document.cookie = `active_academic_year_id=${current.id}; Path=/; Max-Age=31536000`
      }
    })
  }, [schoolId])

  async function handleChange(value: string) {
    setLoading(true)
    setSelectedId(value)
    document.cookie = `active_academic_year_id=${value}; Path=/; Max-Age=31536000`
    
    // Optionnel : mettre à jour le statut dans la base
    const admin = (await import("@supabase/supabase-js")).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await admin.from("academic_years").update({ status: "en_cours" }).eq("id", value)
    await admin.from("academic_years").update({ status: "planifiee" }).neq("id", value).eq("school_id", schoolId)
    
    toast.success("Année académique activée")
    setLoading(false)
  }

  if (!schoolId) return null

  return (
    <div className="flex items-center gap-3">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedId} onValueChange={handleChange} disabled={loading || years.length === 0}>
        <SelectTrigger className="w-[220px] h-8 text-sm">
          <SelectValue placeholder="Année académique" />
        </SelectTrigger>
        <SelectContent>
          {years.map(year => (
            <SelectItem key={year.id} value={year.id}>
              <div className="flex items-center gap-2">
                <span>{year.label}</span>
                {year.status === "en_cours" && (
                  <Badge variant="default" className="h-4 text-[10px] px-1">Active</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
