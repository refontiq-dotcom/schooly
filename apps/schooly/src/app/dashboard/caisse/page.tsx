"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/browser"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import {
  getPayments,
  getOpenCashSession,
  getStudentBalances,
} from "@/app/dashboard/finance/actions"
import { getEnrollments } from "@/app/dashboard/admissions/actions"
import { CaisseView } from "./_components/caisse-view"
import {
  normalizeBalances,
  normalizeCashSession,
  normalizeEnrollments,
  normalizePayments,
  type BalanceInfo,
  type CaisseEnrollment,
  type CaissePayment,
  type CashSession,
} from "./_lib/types"

/**
 * Page Caisse — chargement des données uniquement.
 * Le rendu (statut session, recherche élève, résumé du jour) vit dans
 * `CaisseView` ; toute donnée entrante passe par les guards `normalize*`
 * (aucun cast `as any[]` sur les montants).
 */
export default function CaissePage() {
  const user = useSupabaseUser()
  const [enrollments, setEnrollments] = useState<CaisseEnrollment[]>([])
  const [payments, setPayments] = useState<CaissePayment[]>([])
  const [session, setSession] = useState<CashSession | null>(null)
  const [balanceByEnrollment, setBalanceByEnrollment] = useState<Record<string, BalanceInfo>>({})
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const supabase = await createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || cancelled) return

        // Lecture du rattachement via le client navigateur (session utilisateur,
        // politique RLS usr_read) — jamais de clé service role côté client.
        const { data: roleData } = await supabase
          .from("user_school_roles")
          .select("school_id")
          .eq("user_id", authUser.id)
          .eq("is_active", true)
          .limit(1)
          .single()

        if (!roleData?.school_id || cancelled) return

        const [enrollRes, payRes, sessionRes, balancesRes] = await Promise.all([
          getEnrollments(roleData.school_id),
          getPayments(roleData.school_id),
          getOpenCashSession(roleData.school_id),
          getStudentBalances(roleData.school_id),
        ])

        if (cancelled) return
        if (enrollRes.data) setEnrollments(normalizeEnrollments(enrollRes.data))
        if (payRes.data) setPayments(normalizePayments(payRes.data))
        setSession(normalizeCashSession(sessionRes.data))
        if (balancesRes.data) setBalanceByEnrollment(normalizeBalances(balancesRes.data))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [user, refreshKey])

  if (loading) return <div className="p-6 text-center text-muted-foreground">Chargement...</div>

  return (
    <CaisseView
      enrollments={enrollments}
      payments={payments}
      session={session}
      balanceByEnrollment={balanceByEnrollment}
      today={new Date().toISOString().slice(0, 10)}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    />
  )
}
