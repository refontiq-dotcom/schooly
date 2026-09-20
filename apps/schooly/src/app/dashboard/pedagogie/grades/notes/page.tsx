// apps/schooly/src/app/dashboard/pedagogie/grades/notes/page.tsx
//
// Écran de saisie et de suivi des notes. Les actes officiels (décision
// annuelle, génération et publication des bulletins) sont sur l'écran
// `report-cards` : ils ne partagent plus le même flux de travail que la saisie
// quotidienne (divulgation progressive).
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { createGradeEntry } from "../../actions"
import {
  createEvaluationRule,
  createEvaluationPeriod,
  closeEvaluationPeriod,
  createEvaluationAssessment,
  getPeriodResults,
  type PeriodResult,
} from "../../evaluation-actions"
import { GradeCorrectionPanel } from "../../grade-correction-panel"
import type { EvaluationPeriod, EvaluationRule } from "../../evaluation-types"
import { isGradeEditable, loadEvaluationSnapshot, type EvaluationSnapshot } from "../_lib/data"
import { Field, Select, SelectField } from "../_lib/fields"

/** Onglets de l'écran de saisie, dans l'ordre de fréquence d'usage. */
const TAB_SAISIE = "saisie"
const TAB_MOYENNES = "moyennes"
const TAB_CONFIGURATION = "configuration"
const TAB_HISTORIQUE = "historique"

export default function NotesPage() {
  const user = useSupabaseUser()
  const direction = user?.role === "direction" || user?.role === "super_admin"
  const [snapshot, setSnapshot] = useState<EvaluationSnapshot | null>(null)
  const [results, setResults] = useState<PeriodResult[] | null>(null)
  const [message, setMessage] = useState("")
  const [absent, setAbsent] = useState(false)
  const [tab, setTab] = useState(TAB_SAISIE)

  async function reload() {
    const outcome = await loadEvaluationSnapshot()
    if (outcome.error) {
      setMessage(outcome.error)
      setSnapshot(null)
      return
    }
    setSnapshot(outcome.data ?? null)
  }

  useEffect(() => {
    if (!user) return
    let active = true
    // Déféré en micro-tâche : react-hooks/set-state-in-effect interdit un
    // setState synchrone dans le corps de l'effet (cf. attendance/page.tsx).
    void Promise.resolve().then(() => {
      if (active) void reload().catch(() => setMessage("Chargement impossible. Réessayez."))
    })
    return () => { active = false }
  }, [user])

  /** Enveloppe une action serveur : message, purge des moyennes, rechargement. */
  function mutate(action: (form: FormData) => Promise<{ error?: string }>) {
    return async (form: FormData) => {
      try {
        const result = await action(form)
        if (result.error) return result
        setMessage("Enregistrement confirmé par le serveur.")
        setResults(null)
        await reload()
        return {}
      } catch {
        return { error: "Connexion interrompue. Vérifiez l'historique avant de réessayer." }
      }
    }
  }

  const ruleLabel = (r: EvaluationRule) =>
    `${snapshot?.years.find(y => y.id === r.academic_year_id)?.label ?? "Année"} · ${r.cycle} · ${r.mode}`
  const periodLabel = (p: EvaluationPeriod) => {
    const rule = snapshot?.rules.find(r => r.id === p.rule_id)
    return `${p.label}${rule ? ` · ${ruleLabel(rule)}` : ""}`
  }

  if (!snapshot) {
    return <div className="space-y-6">
      <h1 className="text-3xl font-bold">Notes et moyennes</h1>
      {message && <p role="status" className="rounded border p-3">{message}</p>}
      <Button onClick={() => void reload().catch(() => setMessage("Connexion impossible."))}>
        Charger les données
      </Button>
    </div>
  }

  const periods = snapshot.periods
  const grades = snapshot.grades

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">Notes et moyennes</h1>
        <p className="text-muted-foreground">
          Saisie des notes, calcul des moyennes et historique des corrections.
        </p>
      </div>
      {direction && (
        <Button asChild variant="outline">
          <Link href="/dashboard/pedagogie/grades/report-cards">Décision annuelle et bulletins</Link>
        </Button>
      )}
    </div>

    {message && <p role="status" className="rounded border p-3">{message}</p>}

    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value={TAB_SAISIE}>Saisie</TabsTrigger>
        {direction && <TabsTrigger value={TAB_MOYENNES}>Moyennes</TabsTrigger>}
        {direction && <TabsTrigger value={TAB_CONFIGURATION}>Configuration</TabsTrigger>}
        <TabsTrigger value={TAB_HISTORIQUE}>Historique</TabsTrigger>
      </TabsList>

      {/* ---------------- Saisie : seule action du quotidien ---------------- */}
      <TabsContent value={TAB_SAISIE}>
        <section className="space-y-4 rounded border p-4">
          <h2 className="text-xl font-semibold">Saisir une note</h2>
          <p className="text-sm text-muted-foreground">
            Le barème et le poids viennent de l’évaluation déclarée : ils ne se
            saisissent plus note par note (onglet Configuration).
          </p>
          <ActionForm action={mutate(createGradeEntry)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Évaluation déclarée">
              <Select name="assessmentId" required defaultValue="">
                <option value="">Choisir</option>
                {snapshot.assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {snapshot.subjects.find(s => s.id === a.subject_id)?.name ?? "Matière"} (sur {a.max_value})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Élève">
              <Select name="enrollmentId" required defaultValue="">
                <option value="">Choisir</option>
                {snapshot.enrollments.map(e => (
                  <option key={e.id} value={e.id}>
                    {`${e.students?.last_name ?? ""} ${e.students?.first_name ?? ""}`.trim()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note">
              <Input name="value" type="number" min="0" step="0.01" disabled={absent} />
            </Field>
            <Field label="Assiduité">
              <Select
                name="absenceStatus"
                value={absent ? "excused" : "present"}
                onChange={e => setAbsent(e.target.value !== "present")}
              >
                <option value="present">Présent — note chiffrée</option>
                <option value="excused">Absent excusé</option>
                <option value="unexcused">Absent non excusé</option>
              </Select>
            </Field>
            <Button type="submit" className="sm:col-span-2 lg:col-span-4">Enregistrer la note</Button>
          </ActionForm>
        </section>

        <section className="mt-4 space-y-3 rounded border p-4">
          <h2 className="text-xl font-semibold">Notes déjà saisies</h2>
          {grades.length === 0 && <p>Aucune note.</p>}
          <ul className="space-y-1 text-sm">
            {grades.map(g => (
              <li key={`${g.id}:${g.revision}`} className="border-t py-2">
                {g.label} : <strong>{g.value === null ? "ABS" : `${g.value}/${g.max_value}`}</strong> — poids {g.weight}
                {g.period_id && ` — ${periods.find(p => p.id === g.period_id)?.label ?? "période inconnue"}`}
              </li>
            ))}
          </ul>
        </section>
      </TabsContent>

      {/* --------- Moyennes : calcul serveur, à la demande (direction) -------- */}
      {direction && <TabsContent value={TAB_MOYENNES}>
        <section className="space-y-4 rounded border p-4">
          <h2 className="text-xl font-semibold">Moyennes provisoires</h2>
          <p className="text-sm text-muted-foreground">
            Le calcul reste côté serveur : seule source fiable des barèmes, de la
            complétude et des notes hors évaluation.
          </p>
          <ActionForm
            action={async (form: FormData) => {
              const classId = String(form.get("classId") ?? "")
              const periodId = String(form.get("periodId") ?? "")
              if (!classId || !periodId) return { error: "Choisissez une classe et une période." }
              try {
                const outcome = await getPeriodResults(classId, periodId)
                if (outcome.error) return { error: outcome.error }
                setResults(outcome.data ?? [])
                return {}
              } catch {
                return { error: "Calcul impossible. Réessayez." }
              }
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <SelectField label="Classe" name="classId" required options={snapshot.classes.map(c => ({ id: c.id, label: c.name }))} />
            <SelectField label="Période" name="periodId" required options={periods.map(p => ({ id: p.id, label: periodLabel(p) }))} />
            <Button type="submit">Calculer côté serveur</Button>
          </ActionForm>
          {results && (results.length === 0
            ? <p>Aucun élève dans cette classe.</p>
            : <ul className="space-y-2">{results.map(r => (
              <li key={r.enrollmentId} className="border-t py-2 text-sm">
                {r.name} — {r.average === null ? "Non calculable" : `${r.average.toFixed(2)}/${r.scale}`}
                {" — "}matières {r.coverage} — saisies {r.entered}/{r.expected}
                {r.unlinked > 0 && ` — ${r.unlinked} note(s) hors évaluation`}
              </li>
            ))}</ul>)}
        </section>
      </TabsContent>}

      {/* ---- Configuration : ce qui se règle une fois par période (direction) - */}
      {direction && <TabsContent value={TAB_CONFIGURATION}>
        <section className="space-y-4 rounded border p-4">
          <h2 className="text-xl font-semibold">1. Règles de calcul</h2>
          <p className="text-sm text-muted-foreground">
            Règles immuables dans ce lot. Une surcharge de cycle remplace les règles de
            l’établissement. Catégorie obligatoire manquante : résultat incomplet, sans redistribution.
          </p>
          <ActionForm action={mutate(createEvaluationRule)} className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Année" name="yearId" required options={snapshot.years.map(y => ({ id: y.id, label: y.label }))} />
            <Field label="Cycle exact (* = établissement)"><Input name="cycle" defaultValue="*" required /></Field>
            <Field label="Régime"><Select name="mode" defaultValue="TRIMESTRE">
              <option value="TRIMESTRE">Trimestres</option>
              <option value="SEMESTRE">Semestres</option>
              <option value="COMPOSITION_PRIMAIRE">Compositions primaire</option>
            </Select></Field>
            <Field label="Barème"><Input name="scale" type="number" min="0.01" step="0.01" defaultValue="20" required /></Field>
            <Field label="Seuil de passage"><Input name="threshold" type="number" min="0" step="0.01" defaultValue="10" required /></Field>
            <Field label="Marge de rachat"><Input name="rescueMargin" type="number" min="0" step="0.01" defaultValue="0" required /></Field>
            <label><input name="weighted" type="checkbox" /> Pourcentages fixes par catégorie (total 100 %)</label>
            <Field label="Interrogations (%)"><Input name="interrogation" type="number" min="0" max="100" step="0.01" defaultValue="40" /></Field>
            <Field label="Devoirs (%)"><Input name="devoir" type="number" min="0" max="100" step="0.01" defaultValue="60" /></Field>
            <Field label="Compositions (%)"><Input name="composition" type="number" min="0" max="100" step="0.01" defaultValue="0" /></Field>
            <Button type="submit">Enregistrer les règles</Button>
          </ActionForm>
          <ul className="space-y-1 text-sm">{snapshot.rules.map(r => (
            <li key={r.id} className="border-t py-2">
              {ruleLabel(r)} — seuil {r.threshold}/{r.scale}, marge {r.rescue_margin} ;{" "}
              {r.interrogation_percent === null
                ? "poids par note"
                : `catégories ${r.interrogation_percent}/${r.devoir_percent}/${r.composition_percent} %`}
            </li>
          ))}</ul>
        </section>

        <section className="mt-4 space-y-4 rounded border p-4">
          <h2 className="text-xl font-semibold">2. Calendrier et clôture</h2>
          <p className="text-sm text-muted-foreground">
            Fuseau : Africa/Abidjan (UTC). La date de fin est exclusive, à 00:00.
            Clôture anticipée définitive dans ce lot.
          </p>
          <ActionForm action={mutate(createEvaluationPeriod)} className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Règles" name="ruleId" required options={snapshot.rules.map(r => ({ id: r.id, label: ruleLabel(r) }))} />
            <Field label="Intitulé"><Input name="label" required /></Field>
            <Field label="Ordre"><Input name="position" type="number" min="1" required /></Field>
            <Field label="Début inclus"><Input name="start" type="date" required /></Field>
            <Field label="Fin exclusive"><Input name="end" type="date" required /></Field>
            <label><input name="passage" type="checkbox" /> Composition de passage (primaire)</label>
            <Button type="submit">Créer la période</Button>
          </ActionForm>
          {periods.map(p => <div key={p.id} className="border-t py-3">
            <p className="text-sm">{periodLabel(p)} — {p.starts_at} → {p.ends_at} — {p.locked_at ? "Clôturée" : "Selon calendrier"}</p>
            {!p.locked_at && <ActionForm action={mutate(closeEvaluationPeriod)} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="periodId" value={p.id} />
              <label className="text-sm"><input type="checkbox" required /> Je confirme la clôture définitive</label>
              <Button type="submit" variant="outline">Clôturer</Button>
            </ActionForm>}
          </div>)}
        </section>

        <section className="mt-4 space-y-4 rounded border p-4">
          <h2 className="text-xl font-semibold">3. Déclarer une évaluation attendue</h2>
          <p className="text-sm text-muted-foreground">
            Une note ne peut être saisie que sur une évaluation déclarée pour la période,
            la classe et la matière — le barème et le poids viennent de cette déclaration.
          </p>
          <ActionForm action={mutate(createEvaluationAssessment)} className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Période" name="periodId" required options={periods.map(p => ({ id: p.id, label: periodLabel(p) }))} />
            <SelectField label="Classe" name="classId" required options={snapshot.classes.map(c => ({ id: c.id, label: c.name }))} />
            <SelectField label="Matière" name="subjectId" required options={snapshot.subjects.map(s => ({ id: s.id, label: s.name }))} />
            <Field label="Catégorie"><Select name="gradeType" defaultValue="devoir">
              <option value="interrogation">Interrogation</option>
              <option value="devoir">Devoir</option>
              <option value="composition">Composition</option>
            </Select></Field>
            <Field label="Intitulé"><Input name="label" required /></Field>
            <Field label="Noté sur"><Input name="maxValue" type="number" min="0.01" step="0.01" defaultValue="20" required /></Field>
            <Field label="Poids"><Input name="weight" type="number" min="0.01" step="0.01" defaultValue="1" required /></Field>
            <Button type="submit">Déclarer l’évaluation</Button>
          </ActionForm>
        </section>
      </TabsContent>}

      {/* ---------- Historique : consultation et correction ponctuelle --------- */}
      <TabsContent value={TAB_HISTORIQUE}>
        <section className="space-y-3 rounded border p-4">
          <h2 className="text-xl font-semibold">Historique autorisé</h2>
          <p className="text-sm text-muted-foreground">
            Une correction n’est possible que sur une note rattachée à une évaluation
            d’une période ouverte.
          </p>
          {grades.length === 0 && <p>Aucune note.</p>}
          {grades.map(g => <div className="border-t py-2" key={`${g.id}:${g.revision}`}>
            {g.enrollments?.students?.last_name} {g.enrollments?.students?.first_name} — {g.subjects?.name} — {g.label} :{" "}
            <strong>{g.value === null ? "ABS" : `${g.value}/${g.max_value}`}</strong> — poids {g.weight} —{" "}
            {g.period_id ? periods.find(p => p.id === g.period_id)?.label : "Historique sans période"}
            <GradeCorrectionPanel
              grade={g}
              locked={!isGradeEditable(g, periods)}
              onSaved={async () => { setResults(null); await reload() }}
            />
          </div>)}
        </section>
      </TabsContent>
    </Tabs>
  </div>
}
