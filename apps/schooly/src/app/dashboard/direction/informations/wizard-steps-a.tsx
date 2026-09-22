"use client"

import { useMemo, useState } from "react"
import { GraduationCap, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { allowedCyclesFor } from "@/lib/fiches/normalize"
import { CYCLE_LABELS, EDUCATION_CYCLES, SCHOOL_NATURES, SERIES_BY_CYCLE } from "@/lib/fiches/types"
import type { CyclesOffered, EducationCycle, OfferedCycle, SchoolNature } from "@/lib/fiches/types"

export function fcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F`
}

const NATURE_LABELS: Record<SchoolNature, string> = {
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
  professionnel: "Professionnel / CFP",
  islamique: "Islamique / Franco-arabe",
  superieur: "Supérieur",
}

const DEFAULT_LEVELS: Record<EducationCycle, string[]> = {
  primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  islamique: [],
  general: ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"],
  technique: ["2nde Technique", "1ère Technique", "Terminale Technique"],
  professionnel: ["CAP", "BT", "BTS"],
  superieur: ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"],
}

const DIPLOMA_BY_LEVEL: Record<string, string> = {
  "cm2": "cep",
  "3e": "bepc",
  "terminale": "bac",
  "terminale technique": "bac",
  "bts": "bts",
  "bt": "bt",
  "cap": "cap",
  "licence 3": "licence",
  "master 2": "master",
}

const makeLevel = (name: string, cycle: EducationCycle, index: number) => ({
  grade_level_name: name,
  level: index + 1,
  cycle,
  series: [] as string[],
  diploma: DIPLOMA_BY_LEVEL[name.toLowerCase()] ?? "aucun",
  requires_filiere_choice: /1ère|terminale|bts|licence|master/i.test(name),
})

function emptyCycle(key: EducationCycle): OfferedCycle {
  return {
    key,
    label: CYCLE_LABELS[key],
    series: [],
    levels: DEFAULT_LEVELS[key].map((name, index) => makeLevel(name, key, index)),
  }
}

export function StepIdentite({ nature, communes, onNatureChange, onCommunesChange }: { nature: SchoolNature; communes: string[]; onNatureChange: (next: SchoolNature) => void; onCommunesChange: (next: string[]) => void }) {
  const [communeInput, setCommuneInput] = useState("")
  function addCommune() {
    const value = communeInput.trim().replace(/\s+/g, " ")
    if (!value || communes.some((c) => c.toLocaleLowerCase("fr") === value.toLocaleLowerCase("fr"))) return
    onCommunesChange([...communes, value])
    setCommuneInput("")
  }
  function removeCommune(value: string) {
    onCommunesChange(communes.filter((c) => c !== value))
  }
  const allowed = allowedCyclesFor(nature)
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Type d'établissement</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Quel type de formation proposez-vous ?</Label>
          <Select value={nature} onValueChange={(v) => onNatureChange(v as SchoolNature)}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{SCHOOL_NATURES.map((n) => <SelectItem key={n} value={n}>{NATURE_LABELS[n]}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Ce choix permet à Schooly de proposer automatiquement les classes et formations adaptées.</p>
        </div>
        <div className="space-y-2">
          <Label>Commune(s) d’implantation</Label>
          <div className="flex flex-wrap gap-1.5">
            {communes.map((commune) => (
              <Badge key={commune} variant="secondary" className="cursor-pointer" onClick={() => removeCommune(commune)} title="Retirer cette commune">
                {commune} ×
              </Badge>
            ))}
            {!communes.length ? <p className="text-xs text-muted-foreground">Ajoutez au moins la commune où se trouve l’établissement.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-sm"
              placeholder="Ex. Cocody ou une autre commune"
              value={communeInput}
              onChange={(e) => setCommuneInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCommune() } }}
              aria-label="Saisir une commune"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCommune} disabled={!communeInput.trim()}>
              <Plus className="size-4" /> Ajouter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Vous pouvez choisir une commune proposée ou saisir directement une commune qui n’est pas encore dans la liste. Chaque commune ajoutée est enregistrée avec l’établissement.</p>
        </div>
        {allowed.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Formations proposées automatiquement</p>
            <div className="flex flex-wrap gap-1.5">{allowed.map((c) => <Badge key={c} variant="secondary">{CYCLE_LABELS[c]}</Badge>)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function withDefaults(cycle: OfferedCycle): OfferedCycle {
  return cycle.levels.length > 0 ? cycle : emptyCycle(cycle.key)
}

export function StepOffre({ cycles, onChange }: { cycles: CyclesOffered; onChange: (next: CyclesOffered) => void }) {
  const allowed = allowedCyclesFor(cycles.nature)
  const activeKeys = useMemo(() => new Set(cycles.cycles.map((c) => c.key)), [cycles.cycles])
  const [customName, setCustomName] = useState<Record<string, string>>({})
  const [customSeries, setCustomSeries] = useState<Record<string, string>>({})

  function toggleCycle(key: EducationCycle) {
    const exists = cycles.cycles.some((c) => c.key === key)
    onChange({
      ...cycles,
      cycles: exists ? cycles.cycles.filter((c) => c.key !== key) : [...cycles.cycles, emptyCycle(key)],
    })
  }

  function toggleLevel(key: EducationCycle, index: number) {
    const cycle = cycles.cycles.find((c) => c.key === key)
    if (!cycle) return
    const level = cycle.levels[index]
    if (!level) return
    const exists = cycle.levels.some((l, i) => i !== index && l.grade_level_name === level.grade_level_name)
    if (exists) return
    // L'absence de sélection est représentée par la suppression de la classe.
    onChange({
      ...cycles,
      cycles: cycles.cycles.map((c) => c.key === key ? {
        ...c,
        levels: c.levels.filter((_, i) => i !== index),
      } : c),
    })
  }

  function restoreLevel(key: EducationCycle, name: string) {
    const cycle = cycles.cycles.find((c) => c.key === key)
    if (!cycle || cycle.levels.some((l) => l.grade_level_name === name)) return
    onChange({
      ...cycles,
      cycles: cycles.cycles.map((c) => c.key === key ? {
        ...c,
        levels: [...c.levels, makeLevel(name, key, c.levels.length)],
      } : c),
    })
  }

  function addCustom(key: EducationCycle) {
    const name = (customName[key] ?? "").trim()
    if (!name) return
    const cycle = cycles.cycles.find((c) => c.key === key)
    if (!cycle || cycle.levels.some((l) => l.grade_level_name.toLowerCase() === name.toLowerCase())) return
    onChange({
      ...cycles,
      cycles: cycles.cycles.map((c) => c.key === key ? {
        ...c,
        levels: [...c.levels, makeLevel(name, key, c.levels.length)],
      } : c),
    })
    setCustomName((s) => ({ ...s, [key]: "" }))
  }

  function removeCustom(key: EducationCycle, index: number) {
    onChange({ ...cycles, cycles: cycles.cycles.map((c) => c.key === key ? { ...c, levels: c.levels.filter((_, i) => i !== index) } : c) })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classes et formations</CardTitle>
          <p className="text-sm text-muted-foreground">Schooly propose les classes adaptées. Vous décochez simplement celles que votre établissement n'enseigne pas.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EDUCATION_CYCLES.map((key) => {
            const active = activeKeys.has(key)
            const recommended = allowed.includes(key)
            return (
              <Button key={key} variant={active ? "default" : "outline"} size="sm" onClick={() => toggleCycle(key)}>
                <GraduationCap className="size-4" /> {CYCLE_LABELS[key]}{!recommended && " (autre)"}
              </Button>
            )
          })}
        </CardContent>
      </Card>

      {cycles.cycles.map((rawCycle) => {
        const cycle = withDefaults(rawCycle)
        const activeNames = new Set(cycle.levels.map((l) => l.grade_level_name))
        return (
          <Card key={cycle.key}>
            <CardHeader><CardTitle className="text-base">{CYCLE_LABELS[cycle.key]}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DEFAULT_LEVELS[cycle.key].map((name) => {
                  const selected = activeNames.has(name)
                  const diploma = DIPLOMA_BY_LEVEL[name.toLowerCase()] ?? "aucun"
                  return (
                    <label key={name} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
                      <input type="checkbox" checked={selected} onChange={() => selected ? toggleLevel(cycle.key, cycle.levels.findIndex((l) => l.grade_level_name === name)) : restoreLevel(cycle.key, name)} />
                      <span>{name}</span>
                      {diploma !== "aucun" && <Badge variant="secondary">{diploma.toUpperCase()}</Badge>}
                    </label>
                  )
                })}
              </div>

              {(cycle.key === "general" || cycle.key === "technique" || cycle.key === "professionnel" || cycle.key === "superieur") && (
                <div className="space-y-2">
                  <Label>{cycle.key === "superieur" ? "Filières / parcours" : cycle.key === "professionnel" ? "Filières professionnelles" : "Filières / séries"}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SERIES_BY_CYCLE[cycle.key].map((serie) => {
                      const enabled = cycle.series.includes(serie)
                      return <Badge key={serie} variant={enabled ? "default" : "outline"} className="cursor-pointer" onClick={() => {
                        const series = enabled ? cycle.series.filter((s) => s !== serie) : [...cycle.series, serie]
                        onChange({ ...cycles, cycles: cycles.map((item) => item.key === cycle.key ? { ...item, series } : item) })
                      }}>{serie}</Badge>
                    })}
                    {cycle.series.filter((serie) => !SERIES_BY_CYCLE[cycle.key].includes(serie)).map((serie) => (
                      <Badge key={serie} variant="default" className="cursor-pointer" onClick={() => onChange({ ...cycles, cycles: cycles.map((item) => item.key === cycle.key ? { ...item, series: item.series.filter((s) => s !== serie) } : item) })}>{serie} ×</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input className="max-w-sm" placeholder={cycle.key === "superieur" ? "Ex. Informatique, Gestion, Génie civil..." : "Ex. spécialité / filière"} value={customSeries[cycle.key] ?? ""} onChange={(e) => setCustomSeries((state) => ({ ...state, [cycle.key]: e.target.value }))} />
                    <Button variant="outline" size="sm" onClick={() => {
                      const value = (customSeries[cycle.key] ?? "").trim()
                      if (!value || cycle.series.some((s) => s.toLowerCase() === value.toLowerCase())) return
                      onChange({ ...cycles, cycles: cycles.map((item) => item.key === cycle.key ? { ...item, series: [...item.series, value] } : item) })
                      setCustomSeries((state) => ({ ...state, [cycle.key]: "" }))
                    }}><Plus className="size-4" /> Ajouter une filière</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Les étudiants/élèves pourront être rattachés à cette filière ou ce parcours lors de l'inscription.</p>
                </div>
              )}

              <div className="rounded-lg border border-dashed p-3">
                <Label>Ma classe ou formation n'est pas dans la liste</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input className="max-w-sm" placeholder="Ex. T1 Électrotechnique, formation locale..." value={customName[cycle.key] ?? ""} onChange={(e) => setCustomName((s) => ({ ...s, [cycle.key]: e.target.value }))} />
                  <Button variant="outline" size="sm" onClick={() => addCustom(cycle.key)}><Plus className="size-4" /> Ajouter</Button>
                </div>
              </div>

            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
