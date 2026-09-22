"use client"

import { useState, useTransition } from "react"
import { FileCheck2, Plus, Trash2, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { saveRequiredDocuments, DEFAULT_REQUIRED_DOCUMENTS, type RequiredDocument } from "./required-documents-actions"

export function RequiredDocuments({ initialDocuments }: { initialDocuments: RequiredDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [customLabel, setCustomLabel] = useState("")
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    setDocuments((current) => current.map((item) => item.id === id ? { ...item, required: !item.required } : item))
  }
  function addCustom() {
    const label = customLabel.trim().replace(/\s+/g, " ")
    if (!label) return
    if (documents.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Cette pièce est déjà présente.")
      return
    }
    setDocuments((current) => [...current, { id: "custom-" + crypto.randomUUID(), label, required: true }])
    setCustomLabel("")
  }
  function resetDefaults() { setDocuments(DEFAULT_REQUIRED_DOCUMENTS.map((item) => ({ ...item }))) }
  function save() {
    startTransition(async () => {
      const result = await saveRequiredDocuments(documents)
      if (result.ok) { setDocuments(result.documents); toast.success("Pièces à fournir enregistrées.") }
      else toast.error(result.error)
    })
  }
  const requiredCount = documents.filter((item) => item.required).length

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileCheck2 className="size-5" />Pièces à fournir</CardTitle>
      <CardDescription>
        Schooly propose une base de pièces courantes. Vous décidez ensuite ce qui est obligatoire ou facultatif.
        <span className="mt-1 block text-xs">Ces propositions sont des réglages Schooly, pas une liste de pièces imposée par la réglementation.</span>
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm"><span className="font-medium">{requiredCount}</span> obligatoire{requiredCount > 1 ? "s" : ""} · <span className="font-medium">{documents.length - requiredCount}</span> facultative{documents.length - requiredCount > 1 ? "s" : ""}</div>
      <div className="space-y-2">
        {documents.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="font-medium">{item.label}</p>{item.id.startsWith("custom-") ? <Badge variant="outline" className="mt-1">Personnalisée</Badge> : <span className="text-xs text-muted-foreground">Proposée automatiquement</span>}</div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant={item.required ? "default" : "outline"} onClick={() => toggle(item.id)}>{item.required ? "Obligatoire" : "Facultative"}</Button>
            <Button type="button" size="icon" variant="ghost" aria-label={"Supprimer " + item.label} onClick={() => setDocuments((current) => current.filter((doc) => doc.id !== item.id))}><Trash2 className="size-4" /></Button>
          </div>
        </div>)}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row"><Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom() } }} placeholder="Ajouter une pièce personnalisée…" /><Button type="button" variant="outline" onClick={addCustom}><Plus className="size-4" />Ajouter</Button></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={resetDefaults}><RotateCcw className="size-4" />Réinitialiser les propositions</Button><Button type="button" disabled={pending} onClick={save}>{pending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}Enregistrer</Button></div>
    </CardContent>
  </Card>
}
