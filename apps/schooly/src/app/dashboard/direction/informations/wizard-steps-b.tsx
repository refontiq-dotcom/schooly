// ============================================================================
// Wizard Direction - Etape 3 (Dossier & tenues / services optionnels).
// Contrats V1 on-disk : TransportService { enabled, vehicle_icon, zones[],
// frequency }, CantineService { enabled, meal_icon, regimes[] },
// TenuesService { enabled, type, items: UniformItem[], badge_color }.
// ============================================================================

"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fcfa } from "./wizard-steps-a"
import type { CantineService, OptionalServices, TenuesService, TransportService, UniformItem } from "@/lib/fiches/types"

const FREQS = ["unique", "mensuel", "trimestriel", "annuel"] as const
const VEHICLE_ICONS = ["bus", "car", "minibus", "van"] as const
const MEAL_ICONS = ["utensils", "bowl", "sandwich", "cup"] as const
const TENUE_TYPES = ["uniform", "dress_code", "none"] as const
const BADGE_COLORS = ["blue", "green", "red", "yellow", "gray", "purple"] as const

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (<Button variant={checked ? "default" : "outline"} size="sm" onClick={() => onChange(!checked)}>{checked ? "Active" : "Desactive"} - {label}</Button>)
}

export function StepDossier({ services, onChange }: { services: OptionalServices; onChange: (next: OptionalServices) => void }) {
  const [zoneName, setZoneName] = useState("")
  const [zonePrice, setZonePrice] = useState("")
  const [regimeName, setRegimeName] = useState("")
  const [regimePrice, setRegimePrice] = useState("")
  const [tenueName, setTenueName] = useState("")
  const [tenueColor, setTenueColor] = useState("")
  const [tenuePrice, setTenuePrice] = useState("")
  const t = services.transport
  const c = services.cantine
  const u = services.tenues

  function addZone() {
    const name = zoneName.trim()
    if (!name) return
    const next: TransportService = { ...t, zones: [...t.zones, { name, price: Number(zonePrice) || 0, frequency: t.frequency }] }
    onChange({ ...services, transport: next })
    setZoneName(""); setZonePrice("")
  }
  function addRegime() {
    const name = regimeName.trim()
    if (!name) return
    const next: CantineService = { ...c, regimes: [...c.regimes, { name, price: Number(regimePrice) || 0, frequency: c.frequency }] }
    onChange({ ...services, cantine: next })
    setRegimeName(""); setRegimePrice("")
  }
  function addTenue() {
    const name = tenueName.trim()
    if (!name) return
    const item: UniformItem = { name, description: "", color: tenueColor.trim(), price: Number(tenuePrice) || 0, one_time: true, icon: "shirt" }
    onChange({ ...services, tenues: { ...u, items: [...u.items, item] } })
    setTenueName(""); setTenueColor(""); setTenuePrice("")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Transport scolaire</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle checked={t.enabled} onChange={(v) => onChange({ ...services, transport: { ...t, enabled: v } })} label="transport" />
            <div className="space-y-1"><Label className="text-xs">Icone vehicule</Label><Select value={t.vehicle_icon} onValueChange={(v) => onChange({ ...services, transport: { ...t, vehicle_icon: v } })}><SelectTrigger className="w-32"><SelectValue placeholder="Icone" /></SelectTrigger><SelectContent>{VEHICLE_ICONS.map((ic) => (<SelectItem key={ic} value={ic}>{ic}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Frequence</Label><Select value={t.frequency} onValueChange={(v) => onChange({ ...services, transport: { ...t, frequency: v as TransportService["frequency"] } })}><SelectTrigger className="w-32"><SelectValue placeholder="Freq." /></SelectTrigger><SelectContent>{FREQS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent></Select></div>
          </div>
          {t.zones.map((z, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <Input className="max-w-44" value={z.name} onChange={(e) => { const zones = [...t.zones]; zones[i] = { ...z, name: e.target.value }; onChange({ ...services, transport: { ...t, zones } }) }} />
              <Input type="number" className="max-w-32" title="Prix (F)" value={String(z.price ?? 0)} onChange={(e) => { const zones = [...t.zones]; zones[i] = { ...z, price: Number(e.target.value) || 0 }; onChange({ ...services, transport: { ...t, zones } }) }} />
              <span className="text-xs text-muted-foreground">{fcfa(z.price)}/{t.frequency}</span>
              <Button variant="ghost" size="icon" aria-label="Supprimer la zone" onClick={() => onChange({ ...services, transport: { ...t, zones: t.zones.filter((_, x) => x !== i) } })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-44" placeholder="Nouvelle zone" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
            <Input className="max-w-32" type="number" placeholder="Prix" value={zonePrice} onChange={(e) => setZonePrice(e.target.value)} />
            <Button variant="outline" size="sm" onClick={addZone}><Plus className="size-4" /> Zone</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Cantine</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle checked={c.enabled} onChange={(v) => onChange({ ...services, cantine: { ...c, enabled: v } })} label="cantine" />
            <div className="space-y-1"><Label className="text-xs">Icone repas</Label><Select value={c.meal_icon} onValueChange={(v) => onChange({ ...services, cantine: { ...c, meal_icon: v } })}><SelectTrigger className="w-32"><SelectValue placeholder="Icone" /></SelectTrigger><SelectContent>{MEAL_ICONS.map((ic) => (<SelectItem key={ic} value={ic}>{ic}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Frequence</Label><Select value={c.frequency} onValueChange={(v) => onChange({ ...services, cantine: { ...c, frequency: v as CantineService["frequency"] } })}><SelectTrigger className="w-32"><SelectValue placeholder="Freq." /></SelectTrigger><SelectContent>{FREQS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent></Select></div>
          </div>
          {c.regimes.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <Input className="max-w-44" value={r.name} onChange={(e) => { const regimes = [...c.regimes]; regimes[i] = { ...r, name: e.target.value }; onChange({ ...services, cantine: { ...c, regimes } }) }} />
              <Input type="number" className="max-w-32" title="Prix (F)" value={String(r.price ?? 0)} onChange={(e) => { const regimes = [...c.regimes]; regimes[i] = { ...r, price: Number(e.target.value) || 0 }; onChange({ ...services, cantine: { ...c, regimes } }) }} />
              <span className="text-xs text-muted-foreground">{fcfa(r.price)}/{c.frequency}</span>
              <Button variant="ghost" size="icon" aria-label="Supprimer le regime" onClick={() => onChange({ ...services, cantine: { ...c, regimes: c.regimes.filter((_, x) => x !== i) } })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-44" placeholder="Nouveau regime" value={regimeName} onChange={(e) => setRegimeName(e.target.value)} />
            <Input className="max-w-32" type="number" placeholder="Prix" value={regimePrice} onChange={(e) => setRegimePrice(e.target.value)} />
            <Button variant="outline" size="sm" onClick={addRegime}><Plus className="size-4" /> Regime</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Tenues reglementaires</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle checked={u.enabled} onChange={(v) => onChange({ ...services, tenues: { ...u, enabled: v } })} label="tenues" />
            <div className="space-y-1"><Label className="text-xs">Type</Label><Select value={u.type} onValueChange={(v) => onChange({ ...services, tenues: { ...u, type: v as TenuesService["type"] } })}><SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{TENUE_TYPES.map((x) => (<SelectItem key={x} value={x}>{x}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Couleur badge</Label><Select value={u.badge_color} onValueChange={(v) => onChange({ ...services, tenues: { ...u, badge_color: v } })}><SelectTrigger className="w-32"><SelectValue placeholder="Couleur" /></SelectTrigger><SelectContent>{BADGE_COLORS.map((x) => (<SelectItem key={x} value={x}>{x}</SelectItem>))}</SelectContent></Select></div>
          </div>
          {u.items.map((item, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-52" value={item.name} placeholder="Nom de la tenue" onChange={(e) => { const items = [...u.items]; items[i] = { ...item, name: e.target.value }; onChange({ ...services, tenues: { ...u, items } }) }} />
                <Input type="number" className="max-w-32" title="Prix (F)" value={String(item.price ?? 0)} onChange={(e) => { const items = [...u.items]; items[i] = { ...item, price: Number(e.target.value) || 0 }; onChange({ ...services, tenues: { ...u, items } }) }} />
                <span className="text-xs text-muted-foreground">{fcfa(item.price)}</span>
                <Button variant="ghost" size="icon" aria-label="Supprimer la tenue" onClick={() => onChange({ ...services, tenues: { ...u, items: u.items.filter((_, x) => x !== i) } })}><Trash2 className="size-4" /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-52" placeholder="Description" value={item.description ?? ""} onChange={(e) => { const items = [...u.items]; items[i] = { ...item, description: e.target.value }; onChange({ ...services, tenues: { ...u, items } }) }} />
                <Input className="max-w-32" placeholder="Couleur" value={item.color ?? ""} onChange={(e) => { const items = [...u.items]; items[i] = { ...item, color: e.target.value }; onChange({ ...services, tenues: { ...u, items } }) }} />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(item.one_time)} onChange={(e) => { const items = [...u.items]; items[i] = { ...item, one_time: e.target.checked }; onChange({ ...services, tenues: { ...u, items } }) }} />Paiement unique</label>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-44" placeholder="Nouvelle tenue" value={tenueName} onChange={(e) => setTenueName(e.target.value)} />
            <Input className="max-w-32" placeholder="Couleur" value={tenueColor} onChange={(e) => setTenueColor(e.target.value)} />
            <Input className="max-w-32" type="number" placeholder="Prix" value={tenuePrice} onChange={(e) => setTenuePrice(e.target.value)} />
            <Button variant="outline" size="sm" onClick={addTenue}><Plus className="size-4" /> Tenue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
