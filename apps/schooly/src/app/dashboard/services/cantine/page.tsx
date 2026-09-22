// apps/schooly/src/app/dashboard/services/cantine/page.tsx
//
// Écran de gestion de la cantine. La présentation (stats, menus de la
// semaine, abonnements) vit dans _components/ : cette page ne garde que le
// chargement des données et leur rafraîchissement après chaque mutation.
"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  createCanteenMenu,
  createCanteenSubscription,
  getCanteenMenus,
  getCanteenSubscriptions,
  getEnrollmentsForSelect,
} from "../actions"
import { CantineView } from "./_components/cantine-view"
import type { CanteenMenu, EnrollmentOption, ServiceSub } from "../_lib/types"

type ActionResult = { ok?: boolean; error?: string }

export default function CantinePage() {
  const [menus, setMenus] = useState<CanteenMenu[]>([])
  const [subs, setSubs] = useState<ServiceSub[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([])
  const [, startTransition] = useTransition()

  // Semaine courante (lundi → vendredi), calculée une seule fois au montage.
  const [week] = useState(() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    return {
      weekFrom: monday.toISOString().slice(0, 10),
      weekTo: friday.toISOString().slice(0, 10),
      today: today.toISOString().slice(0, 10),
    }
  })

  const load = useCallback(() => {
    startTransition(async () => {
      const [menusRes, subsRes, enrollRes] = await Promise.all([
        getCanteenMenus(week.weekFrom, week.weekTo),
        getCanteenSubscriptions(),
        getEnrollmentsForSelect(),
      ])
      if ("data" in menusRes) setMenus(((menusRes as { data?: unknown }).data ?? []) as unknown as CanteenMenu[])
      if ("data" in subsRes) setSubs(((subsRes as { data?: unknown }).data ?? []) as unknown as ServiceSub[])
      if ("data" in enrollRes) setEnrollments(((enrollRes as { data?: unknown }).data ?? []) as unknown as EnrollmentOption[])
    })
  }, [week.weekFrom, week.weekTo])

  useEffect(() => { load() }, [load])

  const onCreateMenu = async (formData: FormData): Promise<ActionResult> => createCanteenMenu(formData) as Promise<ActionResult>
  const onCreateSub = async (formData: FormData): Promise<ActionResult> => createCanteenSubscription(formData) as Promise<ActionResult>

  return (
    <CantineView
      menus={menus}
      subs={subs}
      enrollments={enrollments}
      weekFrom={week.weekFrom}
      weekTo={week.weekTo}
      today={week.today}
      onCreateMenu={onCreateMenu}
      onCreateSub={onCreateSub}
    />
  )
}
