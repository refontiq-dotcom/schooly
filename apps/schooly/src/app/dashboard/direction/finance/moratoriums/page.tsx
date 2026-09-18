"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import {
  getMoratoriums,
} from "@/app/dashboard/finance/moratoriums/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { AddMoratoriumModal } from "./add-moratorium-modal"\nimport { ReviewMoratoriumModal } from "./review-moratorium-modal"

type Moratorium = {
  id: string
  reason: string
  requested_amount: number
  approved_amount: number | null
  status: string
  requested_at: string
  due_date: string
  enrollments: {
    matricule: string
    students: { first_name: string; last_name: string }
    guardians: { full_name: string; phone: string }
  }
}

export default function MoratoriumsPage() {
  const user = useSupabaseUser()
  const [schoolId, setSchoolId] = useState<string>("")
  const [moratoriums, setMoratoriums] = useState<Moratorium[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setLoading(true)
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Lecture du rattachement via le client navigateur (session utilisateur,
      // politique RLS usr_read) — jamais de clé service role côté client.
      const { data: roleData } = await supabase
        .from("user_school_roles")
        .select("school_id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (!roleData?.school_id) return
      setSchoolId(roleData.school_id)

      const [moratoriumRes, enrollRes] = await Promise.all([
        getMoratoriums(roleData.school_id),
        getEnrollments(roleData.school_id),
      ])

      if (moratoriumRes.data) setMoratoriums(moratoriumRes.data as Moratorium[])
      if (enrollRes.data) setEnrollments(enrollRes.data as any[])

      setLoading(false)
    }
    fetchData()
  }, [user])

  async function refreshMoratoriums() {
    if (!schoolId) return
    const res = await getMoratoriums(schoolId)
    if (res.data) setMoratoriums(res.data as Moratorium[])
  }


