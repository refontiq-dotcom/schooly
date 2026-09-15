"use client"

import { useActionState } from "react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  School,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { completeOnboardingAction } from "@/app/dashboard/direction/onboarding-actions"

type Props = {
  schoolName: string
  schoolCity: string | null
  schoolType: string | null
}

const SCHOOL_TYPES = [
  { value: "primaire", label: "Primaire" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "professionnel", label: "Professionnel" },
  { value: "islamique", label: "Islamique" },
  { value: "superieur", label: "Supérieur" },
]

export function OnboardingWizard({ schoolName, schoolCity, schoolType }: Props) {
  const [step, setStep] = useState(1)
  const [city, setCity] = useState(schoolCity ?? "")
  const [type, setType] = useState(schoolType ?? "")
  const [yearLabel, setYearLabel] = useState("Année scolaire en cours")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [createYear, setCreateYear] = useState(false)

  const [state, action, isPending] = useActionState(completeOnboardingAction, {
    error: null as string | null,
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("city", city)
    fd.set("school_type", type)
    fd.set("yearLabel", yearLabel)
    fd.set("startDate", startDate)
    fd.set("endDate", endDate)
    action(fd)
  }

  const canNextStep1 = !!type

  return (
    // Modale obligatoire : open toujours vrai, onOpenChange est un no-op
    // (pas de bouton de fermeture, pas de fermeture par le backdrop) tant que
    // l'onboarding n'est pas validé serveur-side.
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col p-0">
              {/* En-tête */}
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <School className="h-5 w-5 text-primary" />
                            Configuration initiale de l&apos;établissement
            </DialogTitle>
            <DialogDescription>
              Bienvenue sur Schooly, <strong className="font-medium">{schoolName}</strong>
              . Quelques informations pour activer votre tableau de bord.
            </DialogDescription>
          </DialogHeader>

          {/* Indicateur d'étapes */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                  (step === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground")
                }
              >
                {n}
              </div>
            ))}
          </div>
        </div>

        {/* Corps */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Étape 1 — Infos de l'école */}
          {step === 1 && (
            <div className="space-y-4">
                            <p className="text-xs font-medium text-muted-foreground">Étape 1 — Informations de l&apos;école</p>
              <div className="space-y-2">
                <Label htmlFor="onb-city">Ville</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="onb-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Abidjan"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                                <Label htmlFor="onb-type">Type d&apos;établissement *</Label>
                <select
                  id="onb-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sélectionnez un type</option>
                  {SCHOOL_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Étape 2 — Année académique (optionnelle) */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Étape 2 — Année académique (optionnelle)</p>
              <div className="space-y-2">
                <Label htmlFor="onb-year-label">Intitulé</Label>
                <Input
                  id="onb-year-label"
                  value={yearLabel}
                  onChange={(e) => setYearLabel(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="onb-start">Début</Label>
                  <Input
                    id="onb-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onb-end">Fin</Label>
                  <Input
                    id="onb-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              {!createYear && startDate && endDate && (
                <button
                  type="button"
                  onClick={() => setCreateYear(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Créer cette année maintenant
                </button>
              )}
              {createYear && (
                <button
                  type="button"
                  onClick={() => setCreateYear(false)}
                  className="text-xs text-primary hover:underline"
                >
                                    Annuler la création de l&apos;année
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Vous pourrez créer ou modifier les années académiques plus tard
                dans <strong>Structure académique</strong>.
              </p>
            </div>
          )}
                    {/* Étape 3 — Récapitulatif */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Étape 3 — Récapitulatif</p>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between py-1"><span className="text-muted-foreground">Ville :</span><span>{city || "—"}</span></li>
                <li className="flex justify-between py-1"><span className="text-muted-foreground">Type :</span><span>{SCHOOL_TYPES.find((t) => t.value === type)?.label || type || "—"}</span></li>
                <li className="flex justify-between py-1"><span className="text-muted-foreground">Année :</span><span>
                  {createYear ? `${yearLabel} (${startDate} → ${endDate})` : "Créée plus tard dans Structure académique"}
                </span></li>
              </ul>

              {state.error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  {state.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied de page / navigation */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex gap-2">
          {step < 3 ? (
            <>
              {step === 2 && (
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Retour
                </Button>
              )}
              {step === 1 && (
                <Button type="button" variant="ghost" disabled className="invisible">
                  Retour
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canNextStep1}
              >
                Suivant
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={isPending}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? "Finalisation…" : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Terminer la configuration
                  </>
                )}
              </Button>
            </form>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
