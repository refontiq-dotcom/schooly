// apps/schooly/src/app/dashboard/services/internat/page.tsx
//
// Écran de gestion de l'internat. La présentation (stats, dortoirs, chambre,
// affectations) vit dans _components/ : cette page ne garde que le chargement
// des données et leur rafraîchissement après chaque mutation.
"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  createBoardingSubscription,
  createDormRoom,
  createDormitory,
  getBoardingSubscriptions,
  getDormitories,
  getEnrollmentsForSelect,
} from "../actions"
import { InternatView } from "./_components/internat-view"
import type { Dormitory, EnrollmentOption, ServiceSub } from "../_lib/types"

type ActionResult = { ok?: boolean; error?: string }

export default function InternatPage() {
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [subs, setSubs] = useState<ServiceSub[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([])
  const [, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      const [dormsRes, subsRes, enrollRes] = await Promise.all([
        getDormitories(),
        getBoardingSubscriptions(),
        getEnrollmentsForSelect(),
      ])
      if ("data" in dormsRes) setDormitories(((dormsRes as { data?: unknown }).data ?? []) as unknown as Dormitory[])
      if ("data" in subsRes) setSubs(((subsRes as { data?: unknown }).data ?? []) as unknown as ServiceSub[])
      if ("data" in enrollRes) setEnrollments(((enrollRes as { data?: unknown }).data ?? []) as unknown as EnrollmentOption[])
    })
  }, [])

  useEffect(() => { load() }, [load])

  const onCreateDormitory = async (formData: FormData): Promise<ActionResult> => createDormitory(formData) as Promise<ActionResult>
  const onCreateRoom = async (formData: FormData): Promise<ActionResult> => createDormRoom(formData) as Promise<ActionResult>
  const onCreateSub = async (formData: FormData): Promise<ActionResult> => createBoardingSubscription(formData) as Promise<ActionResult>

  return (
    <InternatView
      dormitories={dormitories}
      subs={subs}
      enrollments={enrollments}
      onCreateDormitory={onCreateDormitory}
      onCreateRoom={onCreateRoom}
      onCreateSub={onCreateSub}
    />
  )
}
