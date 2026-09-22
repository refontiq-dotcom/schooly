"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type Level = { grade_level_name: string; series: string[]; diploma: string }
type Formation = { key: string; label: string; levels: Level[] }

export function PreinscriptionForm({ formations, formation, onFormationChange, schoolId, onCreated }: {
  formations: Formation[]
  formation: string
  onFormationChange: (key: string) => void
  schoolId: string
  onCreated?: (result: { reservation_id: string; formation: { key: string; label: string }; level: { id: string; label: string } }) => void
}) {
  const [level, setLevel] = useState("")
  const [series, setSeries] = useState("")
  const [student, setStudent] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [parent, setParent] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const selected = formations.find((item) => item.key === formation)
  // Les données de chaque pôle sont déjà isolées par l’API publique. On ne garde
  // donc jamais un niveau/série d’un autre pôle dans l’état du formulaire.
  const filteredLevels = useMemo(() => selected?.levels ?? [], [selected])
  const selectedLevel = selected?.levels.find((item) => item.grade_level_name === level)
  const isGeneral = formation === "general"
  const isTechnique = formation === "technique"
  const isProfessional = formation === "professionnel"
  const isHigher = formation === "superieur"
  const seriesOptions = useMemo(() => {
    if (!selectedLevel) return []
    return Array.from(new Set(selectedLevel.series.filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"))
  }, [selectedLevel])

  function changeFormation(key: string) {
    onFormationChange(key)
    setLevel("")
    setSeries("")
  }

  function changeLevel(nextLevel: string) {
    setLevel(nextLevel)
    setSeries("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Préinscription — parcours {selected?.label ?? ""}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">1. Pôle de formation</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {formations.map((item) => (
              <button key={item.key} type="button" onClick={() => changeFormation(item.key)}
                className={`rounded-md border p-2 text-left text-sm ${formation === item.key ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">2. Parcours scolaire</p>
              <Select value={level} onChange={(e) => changeLevel(e.target.value)}>
                <option value="">Choisir {isHigher ? "le niveau" : isProfessional ? "le diplôme / niveau" : "la classe"}…</option>
                {filteredLevels.map((item) => <option key={item.grade_level_name} value={item.grade_level_name}>{item.grade_level_name}{item.diploma !== "aucun" ? ` — ${item.diploma}` : ""}</option>)}
              </Select>
              {seriesOptions.length > 0 ? (
                <Select value={series} onChange={(e) => setSeries(e.target.value)}>
                  <option value="">Choisir {isProfessional || isHigher ? "la filière / le parcours" : "la série"}…</option>
                  {seriesOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              ) : null}
              {isProfessional ? <p className="text-xs text-muted-foreground">Le formulaire professionnel privilégie le diplôme, la filière et le parcours de formation.</p> : null}
              {isHigher ? <p className="text-xs text-muted-foreground">Le supérieur est organisé par niveau, filière et parcours.</p> : null}
              {isTechnique ? <p className="text-xs text-muted-foreground">La voie technique utilise les niveaux et séries/filières configurés par l’établissement.</p> : null}
              {isGeneral ? <p className="text-xs text-muted-foreground">La voie générale utilise les classes et séries disponibles pour ce pôle.</p> : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">3. Élève</p>
              <input className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="Nom complet de l'élève" value={student} onChange={(e) => setStudent(e.target.value)} />
              <input className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">4. Parent / responsable</p>
              <input className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="Nom complet du parent" value={parent} onChange={(e) => setParent(e.target.value)} />
              <input className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" type="email" placeholder="Email (facultatif)" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {required.length > 0 ? (\n              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">\n                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">5. Pièces à préparer</p>\n                <div className="space-y-1.5 text-sm">\n                  {required.map((item) => <div key={item.id} className="flex items-center justify-between gap-3"><span>{item.label}</span><span className="text-xs text-muted-foreground">{item.required ? "Obligatoire" : "Facultative"}</span></div>)}\n                </div>\n                <p className="text-xs text-muted-foreground">La liste est définie par l’établissement. Le dépôt des fichiers pourra être effectué dans le dossier d’inscription.</p>\n              </div>\n            ) : null}\n\n            <Button type="button" className="w-full" disabled={submitting || !level || !student || !birthdate || !parent || !phone}
              onClick={async () => {
                setSubmitting(true)
                setError("")
                setSuccess("")
                try {
                  const response = await fetch(`/api/v1/public/ecoles/${schoolId}/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ formation, level_id: selectedLevel?.grade_level_name, student_full_name: student, student_birthdate: birthdate, parent_full_name: parent, parent_phone: phone, parent_email: email, series }),
                  })
                  const result = await response.json()
                  if (!response.ok) throw new Error(result.error || "Création de la préinscription impossible.")
                  setSuccess(`Préinscription créée. Référence : ${result.reservation_id}`)
                  onCreated?.(result)
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Une erreur est survenue.")
                } finally {
                  setSubmitting(false)
                }
              }}>
              {submitting ? "Création de la préinscription…" : "Continuer avec ce parcours"}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? <p className="text-sm text-green-700">{success}</p> : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
