// ============================================================================
// M3 — Editeur fournitures par classe (client) : selecteur, kits, duplication,
// listes manuels/papeterie/materiel, statut publie/brouillon.
// ============================================================================

"use client"

import { useMemo, useState, useTransition } from "react"
import { Check, Copy, Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { listSupplyClassNames } from "@/lib/fiches/normalize"
import { SUPPLY_KIT_PRESETS } from "@/lib/fiches/presets"
import type { ClassSuppliesConfiguration, SchoolSuppliesByClass } from "@/lib/fiches/types"
import { applyKitPreset, deleteClassSupplies, duplicateSupplies, getSuppliesState, saveClassSupplies, setClassSupplyStatus } from "./supplies-actions"

function emptyConfig(name: string): ClassSuppliesConfiguration {
  return { status: "draft", class_label: name, level: 0, cycle: "", year: "", manuals: [], stationery: [], equipment: [] }
}

export function SuppliesEditor({ initial }: { initial: SchoolSuppliesByClass }) {
  const [supplies, setSupplies] = useState<SchoolSuppliesByClass>(initial)
  const names = useMemo(() => listSupplyClassNames(supplies), [supplies])
  const [selected, setSelected] = useState(names[0] ?? "")
  const [newClass, setNewClass] = useState("")
  const [dupTarget, setDupTarget] = useState("")
  const [pending, startTransition] = useTransition()
  const current: ClassSuppliesConfiguration = supplies[selected] ?? emptyConfig(selected || "Nouvelle classe")

  function patch(next: ClassSuppliesConfiguration) {
    if (!selected) return
    setSupplies((s) => ({ ...s, [selected]: next }))
  }
  async function reload() {
    const res = await getSuppliesState()
    if (res.ok) setSupplies(res.supplies)
  }
  function run(p: Promise<{ ok: boolean; error?: string }>, okMsg: string, onOk?: () => void | Promise<void>) {
    startTransition(async () => {
      const r = await p
      if (r.ok) {
        toast.success(okMsg)
        await onOk?.()
      } else toast.error(r.error ?? "Operation impossible.")
    })
  }
  function createClass() {
    const key = newClass.trim()
    if (!key) return
    if (supplies[key]) { setSelected(key); setNewClass(""); return }
    setSupplies((s) => ({ ...s, [key]: emptyConfig(key) }))
    setSelected(key); setNewClass("")
  }
  function save() {
    if (!selected) return
    run(saveClassSupplies(selected, current), "Fournitures enregistrees.")
  }

  const [mSubject, setMSubject] = useState("")
  const [mTitle, setMTitle] = useState("")
  const [sCat, setSCat] = useState("Ecriture")
  const [sName, setSName] = useState("")
  const [sQty, setSQty] = useState("")
  const [eName, setEName] = useState("")
  const [eQty, setEQty] = useState("")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Classe a configurer</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
              <SelectContent>{names.map((n) => (<SelectItem key={n} value={n}>{n} {supplies[n].status === "published" ? "(publie)" : "(brouillon)"}</SelectItem>))}</SelectContent>
            </Select>
            <Badge variant={current.status === "published" ? "default" : "secondary"}>{current.status === "published" ? "Publie" : "Brouillon"}</Badge>
            <Button variant="outline" size="sm" disabled={pending || !selected} onClick={() => run(setClassSupplyStatus(selected, current.status === "published" ? "draft" : "published"), "Statut mis a jour.", reload)}><Check className="size-4" /> {current.status === "published" ? "Repasser en brouillon" : "Publier"}</Button>
            <Button variant="ghost" size="sm" disabled={pending || !selected} onClick={() => { if (confirm(`Supprimer la fiche de ${selected} ?`)) run(deleteClassSupplies(selected).then((r) => { if (r.ok) { setSupplies((s) => { const n = { ...s }; delete n[selected]; return n }); setSelected("") } return r }), "Fiche supprimee.") }}><Trash2 className="size-4" /> Supprimer</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-52" placeholder="Nouvelle classe (ex. 5eme)" value={newClass} onChange={(e) => setNewClass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createClass() } }} />
            <Button variant="outline" size="sm" onClick={createClass}><Plus className="size-4" /> Creer</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-52" placeholder="Dupliquer vers (ex. 5eme)" value={dupTarget} onChange={(e) => setDupTarget(e.target.value)} />
            <Button variant="outline" size="sm" disabled={pending || !selected || !dupTarget.trim()} onClick={() => { const target = dupTarget.trim(); run(duplicateSupplies(selected, target), `Duplique vers ${target}.`, async () => { await reload(); setSelected(target); setDupTarget("") }) }}><Copy className="size-4" /> Dupliquer la papeterie</Button>
          </div>
          <div className="space-y-1.5">
            <Label>Kits prereglés (programmes nationaux)</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPLY_KIT_PRESETS.map((k) => (
                <Button key={k.id} variant="outline" size="sm" disabled={pending || !selected} title={k.description} onClick={() => run(applyKitPreset(selected, k.id), `Kit « ${k.label} » applique.`, reload)}><Plus className="size-4" /> {k.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      {selected ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Manuels — {selected}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {current.manuals.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input className="max-w-36" value={m.subject} placeholder="Matiere" onChange={(e) => { const manuals = [...current.manuals]; manuals[i] = { ...m, subject: e.target.value }; patch({ ...current, manuals }) }} />
                  <Input className="max-w-52" value={m.title} placeholder="Titre" onChange={(e) => { const manuals = [...current.manuals]; manuals[i] = { ...m, title: e.target.value }; patch({ ...current, manuals }) }} />
                  <Input className="max-w-36" value={m.editor} placeholder="Editeur" onChange={(e) => { const manuals = [...current.manuals]; manuals[i] = { ...m, editor: e.target.value }; patch({ ...current, manuals }) }} />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={m.required_for_inscription} onChange={(e) => { const manuals = [...current.manuals]; manuals[i] = { ...m, required_for_inscription: e.target.checked }; patch({ ...current, manuals }) }} />Requis</label>
                  <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => patch({ ...current, manuals: current.manuals.filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-36" placeholder="Matiere" value={mSubject} onChange={(e) => setMSubject(e.target.value)} />
                <Input className="max-w-52" placeholder="Titre" value={mTitle} onChange={(e) => setMTitle(e.target.value)} />
                <Button variant="outline" size="sm" disabled={!mSubject.trim() || !mTitle.trim()} onClick={() => { patch({ ...current, manuals: [...current.manuals, { subject: mSubject.trim(), title: mTitle.trim(), editor: "", icon: "book", required_for_inscription: false }] }); setMSubject(""); setMTitle("") }}><Plus className="size-4" /> Manuel</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Papeterie — {selected}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {current.stationery.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input className="max-w-32" value={s.category} placeholder="Categorie" onChange={(e) => { const stationery = [...current.stationery]; stationery[i] = { ...s, category: e.target.value }; patch({ ...current, stationery }) }} />
                  <Input className="max-w-52" value={s.name} placeholder="Article" onChange={(e) => { const stationery = [...current.stationery]; stationery[i] = { ...s, name: e.target.value }; patch({ ...current, stationery }) }} />
                  <Input className="max-w-28" value={s.quantity} placeholder="Qte" onChange={(e) => { const stationery = [...current.stationery]; stationery[i] = { ...s, quantity: e.target.value }; patch({ ...current, stationery }) }} />
                  <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => patch({ ...current, stationery: current.stationery.filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-32" placeholder="Categorie" value={sCat} onChange={(e) => setSCat(e.target.value)} />
                <Input className="max-w-52" placeholder="Article" value={sName} onChange={(e) => setSName(e.target.value)} />
                <Input className="max-w-28" placeholder="Qte" value={sQty} onChange={(e) => setSQty(e.target.value)} />
                <Button variant="outline" size="sm" disabled={!sName.trim()} onClick={() => { patch({ ...current, stationery: [...current.stationery, { category: sCat.trim() || "Divers", name: sName.trim(), quantity: sQty.trim() || "1", icon: "pen" }] }); setSName(""); setSQty("") }}><Plus className="size-4" /> Article</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Materiel exige a l&apos;inscription — {selected}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {current.equipment.map((eq, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input className="max-w-52" value={eq.name} placeholder="Materiel" onChange={(e) => { const equipment = [...current.equipment]; equipment[i] = { ...eq, name: e.target.value }; patch({ ...current, equipment }) }} />
                  <Input className="max-w-28" value={eq.quantity} placeholder="Qte" onChange={(e) => { const equipment = [...current.equipment]; equipment[i] = { ...eq, quantity: e.target.value }; patch({ ...current, equipment }) }} />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={eq.required_for_inscription} onChange={(e) => { const equipment = [...current.equipment]; equipment[i] = { ...eq, required_for_inscription: e.target.checked }; patch({ ...current, equipment }) }} />Requis</label>
                  <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => patch({ ...current, equipment: current.equipment.filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-52" placeholder="Materiel" value={eName} onChange={(e) => setEName(e.target.value)} />
                <Input className="max-w-28" placeholder="Qte" value={eQty} onChange={(e) => setEQty(e.target.value)} />
                <Button variant="outline" size="sm" disabled={!eName.trim()} onClick={() => { patch({ ...current, equipment: [...current.equipment, { name: eName.trim(), quantity: eQty.trim() || "1", required_for_inscription: true, icon: "package" }] }); setEName(""); setEQty("") }}><Plus className="size-4" /> Materiel</Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={save}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Enregistrer {selected}</Button>
          </div>
        </>
      ) : (
        <Card><CardContent className="pt-4 text-sm text-muted-foreground">Creez ou selectionnez une classe pour configurer ses fournitures.</CardContent></Card>
      )}
    </div>
  )
}
