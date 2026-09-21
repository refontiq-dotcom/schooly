"use client"

import { useState } from "react"
import { useActionState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { School, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  schoolLoginAction,
  schoolActivationVerifyAction,
  completeStaffActivationAction,
  parentOtpSendAction,
  parentOtpVerifyAction,
} from "./login/unified-actions"
import { SchoolLoginForm, ParentLoginForm } from "./login-form-components"
import { FadeIn, GeminiBackdrop } from "@/components/gemini"

type Tab = "school" | "parent"

export default function Home() {
  const [tab, setTab] = useState<Tab>("school")
  const [parentStep, setParentStep] = useState<"send" | "verify">("send")
  const [parentContact, setParentContact] = useState("")

  const [schoolState, schoolFormAction, schoolPending] = useActionState(schoolLoginAction, {
    error: null,
  })
  const [activationVerifyState, activationVerifyFormAction, activationVerifyPending] = useActionState(
    schoolActivationVerifyAction,
    { error: null }
  )
  const [completeActivationState, completeActivationFormAction, completeActivationPending] = useActionState(
    completeStaffActivationAction,
    { error: null }
  )
  const [parentSendState, parentSendFormAction, parentSendPending] = useActionState(
    parentOtpSendAction,
    { error: null }
  )
  const [parentVerifyState, parentVerifyFormAction, parentVerifyPending] = useActionState(
    parentOtpVerifyAction,
    { error: null }
  )

  const schoolMode =
    completeActivationState.mode ??
    activationVerifyState.mode ??
    schoolState.mode ??
    "password"

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      <GeminiBackdrop />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <FadeIn>
            <div className="flex justify-center">
              <img
                src="/schooly_logo_vector.svg"
                alt="Schooly"
                className="h-12 w-auto max-w-[260px] object-contain"
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="text-muted-foreground text-sm">
              La plateforme de gestion scolaire pour les réalités de l&apos;Afrique
            </p>
          </FadeIn>
        </div>

        <FadeIn delay={0.22}>
          <div className="flex rounded-2xl gemini-glass p-1.5">
            {(
              [
                { id: "school", label: "École", Icon: School },
                { id: "parent", label: "Parent", Icon: Users },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tab === id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === id && (
                  <motion.span
                    layoutId="login-tab-pill"
                    className="absolute inset-0 rounded-xl bg-primary shadow-md shadow-primary/25"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 w-4 h-4" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab === "school" ? `school-${schoolMode}` : parentStep}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "school" && (
              <SchoolLoginForm
                state={schoolState}
                action={schoolFormAction}
                pending={schoolPending}
                activationVerifyAction={activationVerifyFormAction}
                activationVerifyState={activationVerifyState}
                activationVerifyPending={activationVerifyPending}
                completeActivationAction={completeActivationFormAction}
                completeActivationState={completeActivationState}
                completeActivationPending={completeActivationPending}
              />
            )}
            {tab === "parent" && (
              <ParentLoginForm
                step={parentStep}
                setStep={setParentStep}
                contact={parentContact}
                setContact={setParentContact}
                sendState={parentSendState}
                sendAction={parentSendFormAction}
                sendPending={parentSendPending}
                verifyState={parentVerifyState}
                verifyAction={parentVerifyFormAction}
                verifyPending={parentVerifyPending}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <FadeIn delay={0.3}>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
            <Link href="/legal">Mentions légales</Link>
            <Link href="/legal/conditions">Conditions</Link>
            <Link href="/legal/confidentialite">Confidentialité</Link>
            <Link href="/legal/tarifs">Tarifs</Link>
            <span>© {new Date().getFullYear()} Refontiq</span>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
