"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Check, Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FicheLoadResult, FicheState } from "./actions"
import { saveSchoolConfiguration } from "./actions"
import { StepIdentite, StepOffre } from "./wizard-steps-a"
import { StepDossier } from "./wizard-steps-b"
import { StepFees } from "./wizard-steps-c"

const TABS = [
  { value: "identite", label: "Identité" },
  { value: "offre", label: "Offre" },
  { value: "services", label: "Services" },
  { value: "tarifs", label: "Tarifs" },
  { value: "fournitures", label: "Fournitures" },
] as const

export function InformationsWizard({
  state,
  supplies,
}: {
  state: Extract<FicheLoadResult, { ok: true }>
  supplies: ReactNode
}) {
  const [tab, setTab] = useState("identite")
  const [draft, setDraft] = useState<FicheState>(state.state)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const ficheTab = tab !== "fournitures"

  function save() {
    setFeedback(null)
    startTransition(async () => {
      const res = await saveSchoolConfiguration(draft)
      if (res.ok) {
        const text = "Fiche établissement enregistrée."
        toast.success(text)
        setFeedback({ ok: true, text })
      } else {
        const text = res.error ?? "Enregistrement impossible."
        toast.error(text)
        setFeedback({ ok: false, text })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Fiche de renseignement — {state.schoolName}</h1>
          <p className="text-sm text-muted-foreground">
            Identité, offre, services, tarifs et fournitures de l’établissement.
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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="identite">
          <StepIdentite
            nature={draft.cycles.nature}
            onChange={(nature) => setDraft({ ...draft, cycles: { ...draft.cycles, nature } })}
          />
        </TabsContent>
        <TabsContent value="offre">
          <StepOffre
            cycles={draft.cycles}
            onChange={(cycles) => setDraft({ ...draft, cycles })}
          />
        </TabsContent>
        <TabsContent value="services">
          <StepDossier
            services={draft.services}
            onChange={(services) => setDraft({ ...draft, services })}
          />
        </TabsContent>
        <TabsContent value="tarifs">
          <StepFees fees={draft.fees} onChange={(fees) => setDraft({ ...draft, fees })} />
        </TabsContent>
        <TabsContent value="fournitures">{supplies}</TabsContent>
      </Tabs>

      {ficheTab && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-end gap-3 pt-4">
            {feedback && (
              <p className={feedback.ok ? "mr-auto text-sm text-muted-foreground" : "mr-auto text-sm text-destructive"}>
                {feedback.text}
              </p>
            )}
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
