"use client"

import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from "react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Contrôle natif pour les formulaires : options, required et FormData.
function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
}
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { createGradeEntry, getGradeEntries, getAcademicYearsForSchool, getEnrollmentsForSchool, getSubjectsForSchool, getClassesForSchool, type GradeEntryRow, type EnrollmentListRow } from "../actions"
import { getEvaluationConfiguration, getEvaluationAssessments, createEvaluationAssessment, createEvaluationRule, createEvaluationPeriod, closeEvaluationPeriod, getPeriodResults, type PeriodResult } from "../evaluation-actions"
import { GradeCorrectionPanel } from "../grade-correction-panel"
import type { EvaluationAssessment, EvaluationPeriod, EvaluationRule } from "../evaluation-types"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm">{label}{children}</label>
}
export default function EvaluationPanel() {
  const user = useSupabaseUser()
  const direction = user?.role === "direction" || user?.role === "super_admin"
  const [rules, setRules] = useState<EvaluationRule[]>([])
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([])
  const [years, setYears] = useState<{ id: string; label: string }[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentListRow[]>([])
  const [grades, setGrades] = useState<GradeEntryRow[]>([])
  const [assessments, setAssessments] = useState<EvaluationAssessment[]>([])
  const [results, setResults] = useState<PeriodResult[] | null>(null)
  const [message, setMessage] = useState("")
  const [ready, setReady] = useState(false)
  const [absent, setAbsent] = useState(false)
  async function reload() {
    const [configuration, yearRes, classRes, subjectRes, enrollmentRes, gradeRes, assessmentRes] = await Promise.all([
      getEvaluationConfiguration(), getAcademicYearsForSchool(), getClassesForSchool(), getSubjectsForSchool(), getEnrollmentsForSchool(), getGradeEntries(), getEvaluationAssessments(),
    ])
    const error = configuration.error ?? yearRes.error ?? classRes.error ?? subjectRes.error ?? enrollmentRes.error ?? gradeRes.error ?? assessmentRes.error
    if (error) { setMessage(error); setReady(false); return }
    setRules(configuration.data?.rules ?? []); setPeriods(configuration.data?.periods ?? [])
    setYears(yearRes.data ?? []); setClasses(classRes.data ?? []); setSubjects(subjectRes.data ?? [])
    setEnrollments(enrollmentRes.data ?? []); setGrades(gradeRes.data ?? [])
    setAssessments((assessmentRes.data ?? []) as EvaluationAssessment[]); setReady(true)
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
  function mutate(action: (form: FormData) => Promise<{ error?: string }>) {
    return async (form: FormData) => {
      try {
        const result = await action(form)
        if (result.error) return result
        setMessage("Enregistrement confirmé par le serveur."); setResults(null)
        await reload()
        return {}
      } catch { return { error: "Connexion interrompue. Vérifiez l'historique avant de réessayer." } }
    }
  }
  const ruleLabel = (r: EvaluationRule) => `${years.find(y => y.id === r.academic_year_id)?.label ?? "Année"} · ${r.cycle} · ${r.mode}`
  const periodLabel = (p: EvaluationPeriod) => `${p.label} · ${rules.find(r => r.id === p.rule_id) ? ruleLabel(rules.find(r => r.id === p.rule_id)!) : ""}`
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Évaluation intelligente</h1>
    <p>Règles, périodes, notes et moyennes provisoires. Les anciennes notes sans période restent dans l’historique.</p>
    {message && <p role="status" className="rounded border p-3">{message}</p>}
    {!ready && <Button onClick={() => void reload().catch(() => setMessage("Connexion impossible."))}>Recharger les données</Button>}
    {ready && direction && <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">1. Règles de calcul</h2>
      <p className="text-sm">Règles immuables dans ce lot. Une surcharge de cycle remplace les règles de l’établissement. Catégorie obligatoire manquante : résultat incomplet, sans redistribution.</p>
      <ActionForm action={mutate(createEvaluationRule)} className="grid gap-4 sm:grid-cols-3">
        <Field label="Année"><Select name="yearId" required><option value="">Choisir</option>{years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}</Select></Field>
        <Field label="Cycle exact (* = établissement)"><Input name="cycle" defaultValue="*" required /></Field>
        <Field label="Régime"><Select name="mode"><option value="TRIMESTRE">Trimestres</option><option value="SEMESTRE">Semestres</option><option value="COMPOSITION_PRIMAIRE">Compositions primaire</option></Select></Field>
        <Field label="Barème"><Input name="scale" type="number" min="0.01" step="0.01" defaultValue="20" required /></Field>
        <Field label="Seuil de passage"><Input name="threshold" type="number" min="0" step="0.01" defaultValue="10" required /></Field>
        <Field label="Marge de rachat"><Input name="rescueMargin" type="number" min="0" step="0.01" defaultValue="0" required /></Field>
        <label><input name="weighted" type="checkbox" /> Pourcentages fixes par catégorie (total 100 %)</label>
        <Field label="Interrogations (%)"><Input name="interrogation" type="number" min="0" max="100" step="0.01" defaultValue="40" /></Field>
        <Field label="Devoirs (%)"><Input name="devoir" type="number" min="0" max="100" step="0.01" defaultValue="60" /></Field>
        <Field label="Compositions (%)"><Input name="composition" type="number" min="0" max="100" step="0.01" defaultValue="0" /></Field>
        <Button type="submit">Enregistrer les règles</Button>
      </ActionForm>
      <ul>{rules.map(r => <li key={r.id}>{ruleLabel(r)} — seuil {r.threshold}/{r.scale}, marge {r.rescue_margin} ; {r.interrogation_percent === null ? "poids par note" : `catégories ${r.interrogation_percent}/${r.devoir_percent}/${r.composition_percent} %`}</li>)}</ul>
    </section>}
    {ready && direction && <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">2. Calendrier et clôture</h2>
      <p>Fuseau : Africa/Abidjan (UTC). La date de fin est exclusive, à 00:00. Clôture anticipée définitive dans ce lot.</p>
      <ActionForm action={mutate(createEvaluationPeriod)} className="grid gap-4 sm:grid-cols-3">
        <Field label="Règles"><Select name="ruleId" required><option value="">Choisir</option>{rules.map(r => <option key={r.id} value={r.id}>{ruleLabel(r)}</option>)}</Select></Field>
        <Field label="Intitulé"><Input name="label" required /></Field>
        <Field label="Ordre"><Input name="position" type="number" min="1" required /></Field>
        <Field label="Début inclus"><Input name="start" type="date" required /></Field>
        <Field label="Fin exclusive"><Input name="end" type="date" required /></Field>
        <label><input name="passage" type="checkbox" /> Composition de passage (primaire)</label>
        <Button type="submit">Créer la période</Button>
      </ActionForm>
      {periods.map(p => <div key={p.id} className="border-t py-3">
        <p>{periodLabel(p)} — {p.starts_at} → {p.ends_at} — {p.locked_at ? "Clôturée" : "Selon calendrier"}</p>
        {!p.locked_at && <ActionForm action={mutate(closeEvaluationPeriod)} className="flex items-center gap-3">
          <input type="hidden" name="periodId" value={p.id} />
          <label><input type="checkbox" required /> Je confirme la clôture définitive</label><Button type="submit" variant="outline">Clôturer</Button>
        </ActionForm>}
      </div>)}
    </section>}
    {ready && <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">3. Déclarer une évaluation attendue</h2>
      <p>Une note ne peut être saisie que sur une évaluation déclarée pour la période, la classe et la matière — le barème et le poids viennent de cette déclaration.</p>
      <ActionForm action={mutate(createEvaluationAssessment)} className="grid gap-4 sm:grid-cols-3">
        <Field label="Période"><Select name="periodId" required><option value="">Choisir</option>{periods.filter(p => !p.locked_at).map(p => <option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</Select></Field>
        <Field label="Classe"><Select name="classId" required><option value="">Choisir</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Matière"><Select name="subjectId" required><option value="">Choisir</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Catégorie"><Select name="gradeType"><option value="interrogation">Interrogation</option><option value="devoir">Devoir</option><option value="composition">Composition</option></Select></Field>
        <Field label="Intitulé unique"><Input name="label" required /></Field>
        <Field label="Barème"><Input name="maxValue" type="number" min="0.01" step="0.01" defaultValue="20" required /></Field>
        <Field label="Poids (0 = exclu)"><Input name="weight" type="number" min="0" step="0.01" defaultValue="1" required /></Field>
        <Button type="submit">Déclarer l’évaluation</Button>
      </ActionForm>
      {assessments.length > 0 && <ul className="text-sm">{assessments.map(a => <li key={a.id}>
        {a.label} — {subjects.find(s => s.id === a.subject_id)?.name ?? a.subject_id} — {classes.find(c => c.id === a.class_id)?.name ?? a.class_id} — {a.grade_type} /{a.max_value} · poids {a.weight}
      </li>)}</ul>}
    </section>}
    {ready && <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">4. Saisir une note ou une absence justifiée</h2>
      <p>Les droits classe/matière et l’ouverture de la période sont vérifiés par le serveur.</p>
      <ActionForm action={mutate(createGradeEntry)} className="grid gap-4 sm:grid-cols-3">
        <Field label="Évaluation attendue"><Select name="assessmentId" required><option value="">Choisir</option>{assessments.map(a => <option key={a.id} value={a.id}>{a.label} — {subjects.find(s => s.id === a.subject_id)?.name ?? ""} — {classes.find(c => c.id === a.class_id)?.name ?? ""} (/ {a.max_value})</option>)}</Select></Field>
        <Field label="Inscription"><Select name="enrollmentId" required><option value="">Choisir</option>{enrollments.map(e => <option key={e.id} value={e.id}>{e.students?.last_name} {e.students?.first_name} — {e.classes?.name}</option>)}</Select></Field>
        <Field label="Note brute"><Input key={String(absent)} name="value" type="number" min="0" step="0.01" disabled={absent} required={!absent} /></Field>
        <Field label="Statut"><Select name="absenceStatus" value={absent ? "excused" : "graded"} onChange={e => setAbsent(e.target.value === "excused")}><option value="graded">Noté</option><option value="excused">ABS justifiée</option></Select></Field>
        <Field label="Commentaire"><Input name="comment" /></Field>
        <Button type="submit" disabled={assessments.length === 0}>Enregistrer</Button>
      </ActionForm>
    </section>}
    {ready && direction && <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">5. Moyennes provisoires par période</h2>
      <p>Aucune admission automatique : le cumul annuel et la validation restent à raccorder. Complétude = notes ou ABS renseignées sur évaluations attendues ; sans déclaration, la matière reste incomplète.</p>
      <ActionForm action={async form => {
        setResults(null)
        try {
          const result = await getPeriodResults(String(form.get("classId")), String(form.get("periodId")))
          if (result.error) return { error: result.error }
          setResults(result.data ?? [])
          return {}
        } catch { return { error: "Calcul indisponible. Réessayez." } }
      }} className="flex flex-wrap items-end gap-3">
        <Field label="Classe"><Select name="classId" required><option value="">Choisir</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Période"><Select name="periodId" required><option value="">Choisir</option>{periods.map(p => <option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</Select></Field>
        <Button type="submit">Calculer côté serveur</Button>
      </ActionForm>
      {results && <ul>{results.length === 0 && <li>Aucune inscription pour cette classe et cette année.</li>}{results.map(r => <li className="border-t py-2" key={r.enrollmentId}>{r.name} — {r.average === null ? "Non calculable" : `${r.average.toFixed(2)}/${r.scale}`} — matières {r.coverage} — saisies {r.entered}/{r.expected}{r.unlinked > 0 && ` — ${r.unlinked} note(s) hors évaluation`}{r.complete ? "" : " — incomplet, provisoire"}</li>)}</ul>}
    </section>}
    {ready && <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">Historique autorisé</h2>
      {grades.length === 0 && <p>Aucune note.</p>}
      {grades.map(g => <div className="border-t py-2" key={`${g.id}:${g.revision}`}>
        {g.enrollments?.students?.last_name} {g.enrollments?.students?.first_name} — {g.subjects?.name} — {g.label} : <strong>{g.value === null ? "ABS" : `${g.value}/${g.max_value}`}</strong> — poids {g.weight} — {g.period_id ? periods.find(p => p.id === g.period_id)?.label : "Historique sans période"}
        <GradeCorrectionPanel grade={g} locked={!g.assessment_id || !periods.some(p =>
          p.id === g.period_id && !p.locked_at && Date.now() >= Date.parse(p.starts_at) && Date.now() < Date.parse(p.ends_at)
        )} onSaved={async () => { setResults(null); await reload() }} />
      </div>)}
    </section>}
  </div>
}
