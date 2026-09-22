"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type Level = { grade_level_name: string; series: string[]; diploma: string }
type Formation = { key: string; label: string; levels: Level[] }

export function PreinscriptionForm({ formations, formation, onFormationChange, schoolId }: {
  formations: Formation[]
  formation: string
  onFormationChange: (key: string) => void
  schoolId: string
}) {
  const [level, setLevel] = useState("")
  const [series, setSeries] = useState("")
  const [student, setStudent] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [parent, setParent] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
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

            <Button type="button" className="w-full" disabled={!level || !student || !birthdate || !parent || !phone}
              onClick={() => {
                const payload = { school_id: schoolId, formation, level, series, student_full_name: student, student_birthdate: birthdate, parent_full_name: parent, parent_phone: phone, parent_email: email }
                window.dispatchEvent(new CustomEvent("schooly:preinscription-ready", { detail: payload }))
              }}>
              Continuer avec ce parcours
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
