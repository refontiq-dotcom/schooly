"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { totalInstallments } from "@/lib/fiches/normalize"
import type { CustomFeeItem, ExamFeeItem, FeeItem, FeesStructure } from "@/lib/fiches/types"
import { fcfa } from "./wizard-steps-a"

function emptyFee(label: string, status: "affecte" | "non_affecte"): FeeItem {
  return { label, amount: 0, applies_to: "all", status, is_mandatory: true }
}

function FeePair({ title, fees, onChange }: { title: string; fees: FeeItem[]; onChange: (next: FeeItem[]) => void }) {
  const affecte = fees.find((f) => f.status === "affecte") ?? emptyFee(title, "affecte")
  const nonAffecte = fees.find((f) => f.status === "non_affecte") ?? emptyFee(title, "non_affecte")

  function patch(status: FeeItem["status"], patch: Partial<FeeItem>) {
    const current = status === "affecte" ? affecte : nonAffecte
    const other = status === "affecte" ? nonAffecte : affecte
    const next = [status === "affecte" ? { ...current, ...patch } : { ...other }, status === "non_affecte" ? { ...current, ...patch } : { ...other }]
    onChange(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">Les montants peuvent être différents selon que l'élève est affecté ou non affecté.</p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <Badge>Affecté</Badge>
          <Label className="mt-3 block text-xs">Montant</Label>
          <Input type="number" value={String(affecte.amount)} onChange={(e) => patch("affecte", { amount: Number(e.target.value) || 0 })} />
        </div>
        <div className="rounded-lg border p-3">
          <Badge variant="outline">Non affecté</Badge>
          <Label className="mt-3 block text-xs">Montant</Label>
          <Input type="number" value={String(nonAffecte.amount)} onChange={(e) => patch("non_affecte", { amount: Number(e.target.value) || 0 })} />
        </div>
      </CardContent>
    </Card>
  )
}

export function StepFees({ fees, onChange }: { fees: FeesStructure; onChange: (next: FeesStructure) => void }) {
  const [instLabel, setInstLabel] = useState("")
  const [instAmount, setInstAmount] = useState("")
  const [examClass, setExamClass] = useState("")
  const [examName, setExamName] = useState("")
  const [examAmount, setExamAmount] = useState("")
  const [customLabel, setCustomLabel] = useState("")
  const [customAmount, setCustomAmount] = useState("")
  const [customStatus, setCustomStatus] = useState<"affecte" | "non_affecte">("non_affecte")

  const registrationFees = fees.registration_fees?.length ? fees.registration_fees : fees.registration_fee ? [fees.registration_fee] : []
  const schoolFees = fees.school_fees?.length ? fees.school_fees : fees.academic_fee ? [fees.academic_fee] : []

  function addInstallment() {
    const label = instLabel.trim() || "Tranche " + (fees.installments.length + 1)
    onChange({ ...fees, installments: [...fees.installments, { label, position: fees.installments.length + 1, amount: Number(instAmount) || 0, due_date: null, status: "non_affecte" }] })
    setInstLabel(""); setInstAmount("")
  }

  function addCustomFee() {
    const label = customLabel.trim()
    if (!label) return
    const item: CustomFeeItem = {
      id: crypto.randomUUID(),
      label,
      amount: Number(customAmount) || 0,
      is_mandatory: true,
      status: customStatus,
      applies_to: "all",
    }
    onChange({ ...fees, custom_fees: [...(fees.custom_fees ?? []), item] })
    setCustomLabel(""); setCustomAmount("")
  }

  function addExamFee() {
    const className = examClass.trim()
    const name = examName.trim()
    if (!className || !name) return
    const item: ExamFeeItem = {
      class_name: className,
      exam_name: name,
      diploma: name.toLowerCase().includes("bepc") ? "bepc" : name.toLowerCase().includes("bac") ? "bac" : "aucun",
      amount: Number(examAmount) || 0,
      is_mandatory: true,
    }
    onChange({ ...fees, exam_fees: [...(fees.exam_fees ?? []), item] })
    setExamClass(""); setExamName(""); setExamAmount("")
  }

  return (
    <div className="space-y-4">
      <FeePair title="Frais d'inscription" fees={registrationFees} onChange={(registration_fees) => onChange({ ...fees, registration_fees })} />
      <FeePair title="Frais de scolarité" fees={schoolFees} onChange={(school_fees) => onChange({ ...fees, school_fees })} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autres frais</CardTitle>
          <p className="text-sm text-muted-foreground">Un frais particulier de votre établissement n'est pas dans la liste ? Ajoutez simplement son nom et son montant.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(fees.custom_fees ?? []).map((item, i) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <span className="min-w-48 text-sm font-medium">{item.label}</span>
              <span className="text-sm text-muted-foreground">{item.status === "affecte" ? "Élève affecté" : "Élève non affecté"}</span>
              <span className="text-sm font-medium">{fcfa(item.amount)}</span>
              <Button variant="ghost" size="icon" onClick={() => onChange({ ...fees, custom_fees: (fees.custom_fees ?? []).filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Nom du frais (ex. frais de dossier)" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            <Input type="number" placeholder="Montant" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
            <Select value={customStatus} onValueChange={(v) => setCustomStatus(v as "affecte" | "non_affecte")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="affecte">Élève affecté</SelectItem>
                <SelectItem value="non_affecte">Élève non affecté</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={addCustomFee}><Plus className="size-4" /> Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Droits d'examen</CardTitle>
          <p className="text-sm text-muted-foreground">Schooly peut identifier automatiquement les classes d'examen. Vous indiquez simplement le montant applicable à votre établissement.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(fees.exam_fees ?? []).map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <span className="text-sm font-medium">{item.class_name}</span>
              <span className="text-sm text-muted-foreground">{item.exam_name}</span>
              <Input type="number" className="max-w-32" value={String(item.amount)} onChange={(e) => { const next = [...(fees.exam_fees ?? [])]; next[i] = { ...item, amount: Number(e.target.value) || 0 }; onChange({ ...fees, exam_fees: next }) }} />
              <span className="text-xs text-muted-foreground">{fcfa(item.amount)}</span>
              <Button variant="ghost" size="icon" onClick={() => onChange({ ...fees, exam_fees: (fees.exam_fees ?? []).filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-3">
            <Input placeholder="Classe (ex. 3e)" value={examClass} onChange={(e) => setExamClass(e.target.value)} />
            <Input placeholder="Examen (ex. BEPC)" value={examName} onChange={(e) => setExamName(e.target.value)} />
            <Input type="number" placeholder="Montant" value={examAmount} onChange={(e) => setExamAmount(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={addExamFee}><Plus className="size-4" /> Ajouter un droit d'examen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Échéancier — total {fcfa(totalInstallments(fees.installments))}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fees.installments.map((inst, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input className="max-w-40" value={inst.label} placeholder="Tranche" onChange={(e) => { const next = [...fees.installments]; next[i] = { ...inst, label: e.target.value }; onChange({ ...fees, installments: next }) }} />
              <Input type="number" className="max-w-32" value={String(inst.amount ?? 0)} onChange={(e) => { const next = [...fees.installments]; next[i] = { ...inst, amount: Number(e.target.value) || 0 }; onChange({ ...fees, installments: next }) }} />
              <Input type="date" value={inst.due_date ?? ""} onChange={(e) => { const next = [...fees.installments]; next[i] = { ...inst, due_date: e.target.value || null }; onChange({ ...fees, installments: next }) }} />
              <Button variant="ghost" size="icon" onClick={() => onChange({ ...fees, installments: fees.installments.filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-40" placeholder="Ex. 1re tranche" value={instLabel} onChange={(e) => setInstLabel(e.target.value)} />
            <Input className="max-w-32" type="number" placeholder="Montant" value={instAmount} onChange={(e) => setInstAmount(e.target.value)} />
            <Button variant="outline" size="sm" onClick={addInstallment}><Plus className="size-4" /> Ajouter une échéance</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Informations complémentaires</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={fees.notes ?? ""} onChange={(e) => onChange({ ...fees, notes: e.target.value })} placeholder="Conditions particulières de paiement visibles aux parents." />
        </CardContent>
      </Card>
    </div>
  )
}
