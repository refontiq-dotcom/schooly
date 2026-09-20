// ============================================================================
// Wizard Direction - Etape 4 (Tarification & echeancier).
// Contrats V1 on-disk : FeesStructure { registration_fee?, academic_fee?,
// installments[] (label/position/amount/due_date/status), currency, notes }.
// ============================================================================

"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { totalInstallments } from "@/lib/fiches/normalize"
import type { FeeItem, FeesStructure } from "@/lib/fiches/types"
import { fcfa } from "./wizard-steps-a"

const CURRENCIES = ["XOF", "XAF", "GNF", "CDF", "EUR"] as const
const FEE_STATUSES = ["affecte", "non_affecte"] as const
const FEE_AUDIENCES = ["all", "nouveaux", "anciens"] as const

function FeeCard({ title, value, onChange }: { title: string; value: FeeItem | undefined; onChange: (next: FeeItem | undefined) => void }) {
  const [enabled, setEnabled] = useState(Boolean(value && value.amount > 0))
  function toggle(v: boolean) {
    setEnabled(v)
    if (!v) { onChange(undefined); return }
    onChange({ label: title, amount: 0, applies_to: "all", status: "non_affecte", is_mandatory: true })
  }
  const fee: FeeItem = value ?? { label: title, amount: 0, applies_to: "all", status: "non_affecte", is_mandatory: true }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={() => toggle(!enabled)}>{enabled ? "Renseigne" : "Non renseigne"}</Button>
        {enabled && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-52" value={fee.label} placeholder="Libelle" onChange={(e) => onChange({ ...fee, label: e.target.value })} />
              <Input type="number" className="max-w-36" value={String(fee.amount ?? 0)} onChange={(e) => onChange({ ...fee, amount: Number(e.target.value) || 0 })} />
              <span className="text-xs text-muted-foreground">{fcfa(fee.amount)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={fee.applies_to} onValueChange={(v) => onChange({ ...fee, applies_to: v as FeeItem["applies_to"] })}><SelectTrigger className="w-32"><SelectValue placeholder="Public" /></SelectTrigger><SelectContent>{FEE_AUDIENCES.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}</SelectContent></Select>
              <Select value={fee.status} onValueChange={(v) => onChange({ ...fee, status: v as FeeItem["status"] })}><SelectTrigger className="w-32"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent>{FEE_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(fee.is_mandatory)} onChange={(e) => onChange({ ...fee, is_mandatory: e.target.checked })} />Obligatoire</label>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function StepFees({ fees, onChange }: { fees: FeesStructure; onChange: (next: FeesStructure) => void }) {
  const [instLabel, setInstLabel] = useState("")
  const [instAmount, setInstAmount] = useState("")
  function addInstallment() {
    const label = instLabel.trim() || `Tranche ${fees.installments.length + 1}`
    onChange({ ...fees, installments: [...fees.installments, { label, position: fees.installments.length + 1, amount: Number(instAmount) || 0, due_date: null, status: "non_affecte" as const }] })
    setInstLabel(""); setInstAmount("")
  }
  return (
    <div className="space-y-4">
      <FeeCard title="Droits d'inscription" value={fees.registration_fee} onChange={(registration_fee) => onChange({ ...fees, registration_fee })} />
      <FeeCard title="Frais academiques" value={fees.academic_fee} onChange={(academic_fee) => onChange({ ...fees, academic_fee })} />
      <Card>
        <CardHeader><CardTitle className="text-base">Echeancier — total {fcfa(totalInstallments(fees.installments))}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fees.installments.map((inst, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input className="max-w-40" value={inst.label} placeholder="Tranche" onChange={(e) => { const next = [...fees.installments]; next[i] = { ...inst, label: e.target.value }; onChange({ ...fees, installments: next }) }} />
              <Input type="number" className="max-w-32" value={String(inst.amount ?? 0)} onChange={(e) => { const next = [...fees.installments]; next[i] = { ...inst, amount: Number(e.target.value) || 0 }; onChange({ ...fees, installments: next }) }} />
              <Input type="date" value={inst.due_date ?? ""} onChange={(e) => { const next = [...fees.installments]; next[i] = { ...inst, due_date: e.target.value || null }; onChange({ ...fees, installments: next }) }} />
              <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => onChange({ ...fees, installments: fees.installments.filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-40" placeholder="Nouvelle tranche" value={instLabel} onChange={(e) => setInstLabel(e.target.value)} />
            <Input className="max-w-32" type="number" placeholder="Montant" value={instAmount} onChange={(e) => setInstAmount(e.target.value)} />
            <Button variant="outline" size="sm" onClick={addInstallment}><Plus className="size-4" /> Tranche</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Devise et notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Devise</Label><Select value={fees.currency} onValueChange={(v) => onChange({ ...fees, currency: v })}><SelectTrigger className="w-32"><SelectValue placeholder="Devise" /></SelectTrigger><SelectContent>{CURRENCIES.map((cc) => (<SelectItem key={cc} value={cc}>{cc}</SelectItem>))}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Notes publiques</Label><Textarea rows={3} value={fees.notes ?? ""} onChange={(e) => onChange({ ...fees, notes: e.target.value })} placeholder="Infos affichees aux parents." /></div>
        </CardContent>
      </Card>
    </div>
  )
}
