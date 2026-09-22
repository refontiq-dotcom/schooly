// apps/schooly/src/app/dashboard/services/transport/page.tsx
//
// Écran de gestion du transport. La présentation (guidance, stats, lignes,
// abonnements) vit dans _components/ : cette page ne garde que le chargement
// des données et leur rafraîchissement après chaque mutation.
"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createBusRoute,
  createTransportSubscription,
  getBusRoutes,
  getEnrollmentsForSelect,
  getTransportSubscriptions,
} from "../actions"
import { TransportView } from "./_components/transport-view"
import type { BusRoute, EnrollmentOption, TransportSub } from "../_lib/types"

type ActionResult = { ok?: boolean; error?: string }

export default function TransportPage() {
  const router = useRouter()
  const [routes, setRoutes] = useState<BusRoute[]>([])
  const [subs, setSubs] = useState<TransportSub[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([])
  const [, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      const [routesRes, subsRes, enrollRes] = await Promise.all([
        getBusRoutes(),
        getTransportSubscriptions(),
        getEnrollmentsForSelect(),
      ])
      if ("data" in routesRes) setRoutes(((routesRes as { data?: unknown }).data ?? []) as unknown as BusRoute[])
      if ("data" in subsRes) setSubs(((subsRes as { data?: unknown }).data ?? []) as unknown as TransportSub[])
      if ("data" in enrollRes) setEnrollments(((enrollRes as { data?: unknown }).data ?? []) as unknown as EnrollmentOption[])
    })
  }, [])

  useEffect(() => { load() }, [load])

  const onCreateRoute = async (formData: FormData): Promise<ActionResult> => createBusRoute(formData) as Promise<ActionResult>
  const onCreateSub = async (formData: FormData): Promise<ActionResult> => createTransportSubscription(formData) as Promise<ActionResult>
  // La guidance « Aucune inscription » renvoie vers les admissions ; on
  // passe par le router Next plutôt que par window.location (SPA).
  const onOpenAdmissions = useCallback(() => {
    router.push("/dashboard/direction/admissions")
  }, [router])

  return (
    <TransportView
      routes={routes}
      subs={subs}
      enrollments={enrollments}
      onCreateRoute={onCreateRoute}
      onCreateSub={onCreateSub}
      onOpenAdmissions={onOpenAdmissions}
    />
  )
}
