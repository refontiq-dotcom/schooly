// apps/schooly/src/app/dashboard/pedagogie/grades/report-cards/page.tsx
//
// Écran des actes officiels de fin de période : aperçu annuel, décision figée,
// génération puis publication des bulletins. Il est séparé de la saisie
// quotidienne (divulgation progressive) : ces actions sont irréversibles et
// n'ont de sens qu'une fois les périodes closes.
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getAcademicYearsForSchool, getClassesForSchool } from "../../actions"
import {
  generateReportCards,
  getAnnualPreview,
  publishReportCards,
  validateAnnualDecision,
  type AnnualPreviewResult,
} from "../../evaluation-actions"
import { Field, Select, SelectField } from "../_lib/fields"

// Libellés des décisions proposées : l'aperçu n'engage aucune décision officielle.
const DECISION_LABELS: Record<AnnualPreviewResult["proposal"], string> = {
  admitted: "admis",
  rescuable: "rachetable",
  deferred: "ajourné",
  incomplete: "indéterminée (incomplet)",
}

export default function ReportCardsPage() {
  const user = useSupabaseUser()
  const direction = user?.role === "direction" || user?.role === "super_admin"
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [years, setYears] = useState<{ id: string; label: string }[]>([])
  const [annual, setAnnual] = useState<AnnualPreviewResult[] | null>(null)
  // Classe/année du dernier aperçu : après une validation, l'aperçu est rejoué
  // pour que les mentions « prêt à valider » reflètent l'état enregistré.
  const [preview, setPreview] = useState<{ classId: string; yearId: string } | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!user) return
    let cancelled = false
    // Échec explicite : sans ce catch, une coupure réseau laissait les deux
    // sélecteurs vides sans rien dire — l'écran semblait juste « sans classe ».
    void Promise.all([getClassesForSchool(), getAcademicYearsForSchool()])
      .then(([c, y]) => {
        if (cancelled) return
        if (c.error || y.error) {
          setMessage(c.error ?? y.error ?? "Chargement impossible.")
          return
        }
        setClasses(c.data ?? [])
        setYears(y.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setMessage("Connexion interrompue. Rechargez la page.")
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function loadPreview(classId: string, yearId: string) {
    setPreview({ classId, yearId })
    const result = await getAnnualPreview(classId, yearId)
    if (result.error) return { error: result.error }
    setAnnual(result.data ?? [])
    return {}
  }

  async function validate(form: FormData) {
    try {
      const result = await validateAnnualDecision(form)
      if (result.error) return result
      setMessage("Décision figée par le serveur.")
      if (preview) await loadPreview(preview.classId, preview.yearId)
      return {}
    } catch {
      return { error: "Connexion interrompue. Vérifiez la décision avant de réessayer." }
    }
  }

  const classOptions = classes.map((c) => ({ id: c.id, label: c.name }))
  const yearOptions = years.map((y) => ({ id: y.id, label: y.label }))

  if (!user) return null

  // Les actes officiels sont une responsabilité de la direction seulement :
  // l'écran le dit explicitement plutôt que d'afficher une page vide.
  if (!direction) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Bulletins officiels</h1>
        <p role="status" className="rounded border p-3 text-muted-foreground">
          Cette page est réservée à la direction.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="notes">
            <ArrowLeft className="h-4 w-4" />
            Retour aux notes
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Bulletins officiels</h1>
      </div>

      <p className="text-muted-foreground">
        Les périodes doivent être closes avant de figer une décision. Un bulletin publié devient
        immuable : il n’est plus modifiable, ni par la direction, ni par l’établissement.
      </p>

      {message && <p role="status" className="rounded border p-3">{message}</p>}

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-xl font-semibold">1. Aperçu annuel et décision proposée</h2>
        <p className="text-sm">
          Aucune décision n’est enregistrée ici : le cumul exige le nombre de périodes du régime,
          des périodes complètes et toutes les périodes verrouillées.
        </p>
        <ActionForm
          action={async (form) =>
            loadPreview(String(form.get("classId")), String(form.get("academicYearId")))
          }
          className="flex flex-wrap items-end gap-3"
        >
          <SelectField label="Classe" name="classId" required options={classOptions} />
          <SelectField label="Année" name="academicYearId" required options={yearOptions} />
          <Button type="submit">Calculer l’année</Button>
        </ActionForm>
        {annual && (
          <ul>
            {annual.length === 0 && <li>Aucune inscription pour cette classe et cette année.</li>}
            {annual.map((r) => (
              <li className="border-t py-2" key={r.enrollmentId}>
                {r.name} — {r.average === null ? "Non calculable" : r.average.toFixed(2)} — décision
                proposée : {DECISION_LABELS[r.proposal]}
                {r.readyForValidation ? " — prêt à valider" : " — non validable"}
                {r.blockers.length > 0 && (
                  <span className="block text-sm">Motifs : {r.blockers.join(" ")}</span>
                )}
                {r.readyForValidation && (
                  <ActionForm action={validate} className="mt-2 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="enrollmentId" value={r.enrollmentId} />
                    <input type="hidden" name="fingerprint" value={r.fingerprint} />
                    <input type="hidden" name="average" value={r.average ?? ""} />
                    <Field label="Décision officielle">
                      <Select
                        name="decision"
                        defaultValue={r.proposal === "admitted" ? "admitted" : "repeated"}
                        disabled={r.proposal !== "rescuable"}
                      >
                        {r.proposal === "rescuable" && (
                          <>
                            <option value="admitted">Admis</option>
                            <option value="repeated">Rédoublant</option>
                            <option value="pending">En attente</option>
                          </>
                        )}
                        {r.proposal === "admitted" && <option value="admitted">Admis</option>}
                      </Select>
                    </Field>
                    <Field label="Observations (facultatif)">
                      <Input name="observations" />
                    </Field>
                    <Button type="submit">Valider et figer le résultat</Button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-xl font-semibold">2. Générer les bulletins</h2>
        <p className="text-sm">
          La génération fige le contenu calculé en base, uniquement pour les élèves à décision validée.
        </p>
        <ActionForm action={generateReportCards} className="flex flex-wrap items-end gap-3">
          <SelectField label="Classe" name="classId" required options={classOptions} />
          <SelectField label="Année" name="yearId" required options={yearOptions} />
          <Button type="submit">Générer les bulletins</Button>
        </ActionForm>
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-xl font-semibold">3. Publier aux familles</h2>
        <p className="text-sm">
          La publication rend les bulletins générés visibles par les parents et les élèves. Un
          bulletin publié devient immuable.
        </p>
        <ActionForm action={publishReportCards} className="flex flex-wrap items-end gap-3">
          <SelectField label="Classe" name="classId" required options={classOptions} />
          <SelectField label="Année" name="yearId" required options={yearOptions} />
          <Button type="submit">Publier aux familles</Button>
        </ActionForm>
      </section>
    </div>
  )
}
