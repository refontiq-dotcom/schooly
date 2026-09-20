// ============================================================================
// Wizard Direction - Etapes 1 (Identite) + 2 (Offre academique).
// Contrats V1 on-disk : lib/fiches/types.ts (CyclesOffered, OfferedCycle...).
// ============================================================================

"use client"

import { useState } from "react"
import { GraduationCap, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { allowedCyclesFor, isCoherent } from "@/lib/fiches/normalize"
import { CYCLE_LABELS, EDUCATION_CYCLES, SCHOOL_NATURES, SERIES_BY_CYCLE } from "@/lib/fiches/types"
import type { CyclesOffered, EducationCycle, OfferedCycle, SchoolNature } from "@/lib/fiches/types"

export function fcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F`
}

const NATURE_LABELS: Record<SchoolNature, string> = {
  primaire: "Primaire",
  college: "College",
  lycee: "Lycee",
  professionnel: "Professionnel / CFP",
  islamique: "Islamique / Franco-arabe",
  superieur: "Superieur",
}

const DIPLOMAS = ["aucun", "cep", "bepc", "bac", "cap", "bt", "bts", "licence", "master"] as const

export function StepIdentite({ nature, onChange }: { nature: SchoolNature; onChange: (next: SchoolNature) => void }) {
  const allowed = allowedCyclesFor(nature)
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Nature de l&apos;etablissement</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Type d&apos;ecole</Label>
          <Select value={nature} onValueChange={(v) => onChange(v as SchoolNature)}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{SCHOOL_NATURES.map((n) => (<SelectItem key={n} value={n}>{NATURE_LABELS[n]}</SelectItem>))}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">La nature pilote les cycles proposes a l&apos;etape suivante.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Cycles autorises pour cette nature</Label>
          <div className="flex flex-wrap gap-1.5">
            {allowed.length === 0 ? (<span className="text-xs text-muted-foreground">Primaire : pas de cycle secondaire.</span>) : (allowed.map((c) => <Badge key={c} variant="secondary">{CYCLE_LABELS[c]}</Badge>))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function emptyCycle(key: EducationCycle): OfferedCycle {
  return { key, label: CYCLE_LABELS[key], series: [...SERIES_BY_CYCLE[key]], levels: [] }
}

export function StepOffre({ cycles, onChange }: { cycles: CyclesOffered; onChange: (next: CyclesOffered) => void }) {
  const allowed = allowedCyclesFor(cycles.nature)
  const coherent = isCoherent(cycles)
  const [newLevelName, setNewLevelName] = useState<Record<string, string>>({})
  function toggleCycle(key: EducationCycle) {
    const exists = cycles.cycles.some((c) => c.key === key)
    onChange({ ...cycles, cycles: exists ? cycles.cycles.filter((c) => c.key !== key) : [...cycles.cycles, emptyCycle(key)] })
  }
  function alignCycles() { onChange({ ...cycles, cycles: cycles.cycles.filter((c) => allowed.includes(c.key)) }) }
  function patchCycle(key: EducationCycle, patch: Partial<OfferedCycle>) {
    onChange({ ...cycles, cycles: cycles.cycles.map((c) => (c.key === key ? { ...c, ...patch } : c)) })
  }
  function addLevel(key: EducationCycle) {
    const name = (newLevelName[key] ?? "").trim()
    if (!name) return
    const target = cycles.cycles.find((c) => c.key === key)
    const rank = (target?.levels.length ?? 0) + 1
    onChange({ ...cycles, cycles: cycles.cycles.map((c) => (c.key === key ? { ...c, levels: [...c.levels, { grade_level_name: name, level: rank, cycle: key, series: [], diploma: "aucun", requires_filiere_choice: false }] } : c)) })
    setNewLevelName((s) => ({ ...s, [key]: "" }))
  }
  function patchLevel(key: EducationCycle, index: number, patch: Record<string, unknown>) {
    onChange({ ...cycles, cycles: cycles.cycles.map((c) => (c.key === key ? { ...c, levels: c.levels.map((l, i) => (i === index ? { ...l, ...patch } : l)) } : c)) })
  }
  function removeLevel(key: EducationCycle, index: number) {
    onChange({ ...cycles, cycles: cycles.cycles.map((c) => (c.key === key ? { ...c, levels: c.levels.filter((_, i) => i !== index) } : c)) })
  }
  function toggleSerie(key: EducationCycle, index: number, serie: string) {
    const target = cycles.cycles.find((c) => c.key === key)?.levels[index]
    if (!target) return
    const has = target.series.includes(serie)
    patchLevel(key, index, { series: has ? target.series.filter((s) => s !== serie) : [...target.series, serie] })
  }
  return (
    <div className="space-y-4">
      {!coherent && (<Card className="border-amber-300 bg-amber-50 dark:bg-amber-950"><CardContent className="flex flex-wrap items-center gap-2 pt-4 text-sm"><span>Cycles incompatibles avec la nature « {NATURE_LABELS[cycles.nature]} ».</span><Button size="sm" variant="outline" onClick={alignCycles}>Aligner sur la nature</Button></CardContent></Card>)}
      <Card>
        <CardHeader><CardTitle className="text-base">Cycles d&apos;enseignement</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EDUCATION_CYCLES.map((key) => {
            const active = cycles.cycles.some((c) => c.key === key)
            const recommended = allowed.includes(key)
            return (<Button key={key} variant={active ? "default" : "outline"} size="sm" onClick={() => toggleCycle(key)}><GraduationCap className="size-4" />{CYCLE_LABELS[key]}{!recommended && " (hors nature)"}</Button>)
          })}
        </CardContent>
      </Card>
      {cycles.cycles.map((cycle) => (
        <Card key={cycle.key}>
          <CardHeader><CardTitle className="text-base">{cycle.label || CYCLE_LABELS[cycle.key]}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Libelle du cycle</Label><Input className="max-w-sm" value={cycle.label} onChange={(e) => patchCycle(cycle.key, { label: e.target.value })} /></div>
            {cycle.levels.map((level, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="max-w-52" value={level.grade_level_name} placeholder="Nom du niveau" onChange={(e) => patchLevel(cycle.key, i, { grade_level_name: e.target.value })} />
                  <Input type="number" className="max-w-24" title="Rang" value={String(level.level ?? 0)} onChange={(e) => patchLevel(cycle.key, i, { level: Number(e.target.value) || 0 })} />
                  <Button variant="ghost" size="icon" aria-label="Supprimer le niveau" onClick={() => removeLevel(cycle.key, i)}><Trash2 className="size-4" /></Button>
                </div>
                <div className="space-y-1"><Label className="text-xs">Series (choix de filiere uniquement)</Label><div className="flex flex-wrap gap-1.5">{SERIES_BY_CYCLE[cycle.key].map((s) => (<Badge key={s} variant={level.series.includes(s) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleSerie(cycle.key, i, s)}>{s}</Badge>))}</div></div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="space-y-1"><Label className="text-xs">Diplome</Label><Select value={level.diploma} onValueChange={(v) => patchLevel(cycle.key, i, { diploma: v })}><SelectTrigger className="w-36"><SelectValue placeholder="Diplome" /></SelectTrigger><SelectContent>{DIPLOMAS.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select></div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(level.requires_filiere_choice)} onChange={(e) => patchLevel(cycle.key, i, { requires_filiere_choice: e.target.checked })} />Choix de filiere a l&apos;inscription (1re, Tle)</label>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-52" placeholder="Ajouter un niveau" value={newLevelName[cycle.key] ?? ""} onChange={(e) => setNewLevelName((s) => ({ ...s, [cycle.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLevel(cycle.key) } }} />
              <Button variant="outline" size="sm" onClick={() => addLevel(cycle.key)}><Plus className="size-4" /> Ajouter</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
