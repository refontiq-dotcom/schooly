// ============================================================================
// InformationsWizard — Orchestrateur M2 (client).
// 4 étapes : Identité → Offre → Dossier → Tarification.
// Persistance : saveSchoolConfiguration (actions.ts), toasts sonner.
// ============================================================================

"use client"

import { useState, useTransition } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { FicheLoadResult } from "./actions"
import { saveSchoolConfiguration } from "./actions"
import { StepIdentite, StepOffre } from "./wizard-steps-a"
import { StepDossier } from "./wizard-steps-b"
import { StepFees } from "./wizard-steps-c"
import type { FicheState } from "./actions"

const STEPS = ["Identité", "Offre académique", "Dossier & tenues", "Tarification"] as const

export function InformationsWizard({
  state,
}: {
  state: Extract<FicheLoadResult, { ok: true }>
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<FicheState>(state.state)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await saveSchoolConfiguration(draft)
      if (res.ok) toast.success("Fiche établissement enregistrée.")
      else toast.error(res.error ?? "Enregistrement impossible.")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Fiche de renseignement — {state.schoolName}</h1>
          <p className="text-sm text-muted-foreground">
            Étape {step + 1} / {STEPS.length} — {STEPS[step]}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href="/api/fiches/mode-b"
            title="Grille tarifaire globale + QR code fournitures (PDF Mode B, Vue Secrétariat)"
          >
            <QrCode className="size-4" />
            Grille tarifaire (PDF)
          </a>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => (
          <Button
            key={label}
            variant={i === step ? "default" : i < step ? "secondary" : "outline"}
            size="sm"
            onClick={() => setStep(i)}
          >
            {i + 1}. {label}
          </Button>
        ))}
      </div>

      {step === 0 && (
        <StepIdentite
          nature={draft.cycles.nature}
          onChange={(nature) => setDraft({ ...draft, cycles: { ...draft.cycles, nature } })}
        />
      )}
      {step === 1 && (
        <StepOffre
          cycles={draft.cycles}
          onChange={(cycles) => setDraft({ ...draft, cycles })}
        />
      )}
      {step === 2 && (
        <StepDossier
          services={draft.services}
          onChange={(services) => setDraft({ ...draft, services })}
        />
      )}
      {step === 3 && (
        <StepFees fees={draft.fees} cycles={draft.cycles.cycles.map((cycle) => cycle.key)} onChange={(fees) => setDraft({ ...draft, fees })} />
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-4" /> Précédent
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={pending} onClick={save}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Enregistrer
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Suivant <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={save} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Terminer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
