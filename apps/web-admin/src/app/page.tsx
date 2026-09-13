"use client"

import { useState } from "react"
import { useActionState } from "react"
import { School, Users, ArrowRight, Mail, Lock, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  schoolLoginAction,
  parentOtpSendAction,
  parentOtpVerifyAction,
} from "./login/unified-actions"
import { SchoolLoginForm, ParentLoginForm } from "./login-form-components"

type Tab = "school" | "parent"

export default function Home() {
  const [tab, setTab] = useState<Tab>("school")
  const [parentStep, setParentStep] = useState<"send" | "verify">("send")
  const [parentContact, setParentContact] = useState("")

  const [schoolState, schoolFormAction, schoolPending] = useActionState(schoolLoginAction, {
    error: null,
  })
  const [parentSendState, parentSendFormAction, parentSendPending] = useActionState(
    parentOtpSendAction,
    { error: null }
  )
  const [parentVerifyState, parentVerifyFormAction, parentVerifyPending] = useActionState(
    parentOtpVerifyAction,
    { error: null }
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#1E3A8A] rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Schooly
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            La plateforme de gestion scolaire pour l&apos;Afrique de l&apos;Ouest
          </p>
        </div>

        <div className="flex rounded-xl bg-white dark:bg-slate-800 p-1 shadow-sm border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab("school")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === "school" ? "bg-[#1E3A8A] text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}
          >
            <School className="w-4 h-4" />
            École
          </button>
          <button
            onClick={() => setTab("parent")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === "parent" ? "bg-[#1E3A8A] text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Users className="w-4 h-4" />
            Parent
          </button>
        </div>

        {tab === "school" && <SchoolLoginForm state={schoolState} action={schoolFormAction} pending={schoolPending} />}
        {tab === "parent" && <ParentLoginForm step={parentStep} setStep={setParentStep} contact={parentContact} setContact={setParentContact} sendState={parentSendState} sendAction={parentSendFormAction} sendPending={parentSendPending} verifyState={parentVerifyState} verifyAction={parentVerifyFormAction} verifyPending={parentVerifyPending} />}

        <div className="text-center pt-4">
          <Badge variant="outline" className="text-xs">
            © {new Date().getFullYear()} Refontiq
          </Badge>
        </div>
      </div>
    </div>
  )
}
