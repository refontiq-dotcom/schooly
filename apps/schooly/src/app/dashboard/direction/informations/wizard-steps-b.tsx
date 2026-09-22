"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CantineService, OptionalServices, TenuesService, TransportService } from "@/lib/fiches/types"
import { fcfa } from "./wizard-steps-a"

const FREQS = ["mensuel", "trimestriel", "annuel"] as const

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Button variant={checked ? "default" : "outline"} size="sm" onClick={() => onChange(!checked)}>{checked ? "Oui" : "Non"} — {label}</Button>
}

export function StepDossier({ services, onChange }: { services: OptionalServices; onChange: (next: OptionalServices) => void }) {
  const [zoneName, setZoneName] = useState("")
  const [zonePrice, setZonePrice] = useState("")
  const [regimeName, setRegimeName] = useState("")
  const [regimePrice, setRegimePrice] = useState("")
  const [kitName, setKitName] = useState("")
  const [kitPrice, setKitPrice] = useState("")
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

  function addKit() {
    const name = kitName.trim()
    if (!name) return
    onChange({
      ...services,
      tenues: {
        ...u,
        enabled: true,
        type: "uniform",
        items: [...u.items, {
          name,
          description: "",
          color: "",
          price: Number(kitPrice) || 0,
          one_time: true,
          icon: "shirt",
        }],
      },
    })
    setKitName(""); setKitPrice("")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Transport scolaire</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Toggle checked={t.enabled} onChange={(v) => onChange({ ...services, transport: { ...t, enabled: v, type: v ? (t.type === "none" ? "zone" : t.type) : "none" } })} label="Le transport est proposé" />
          {t.enabled && (
            <>
              <div className="flex flex-wrap gap-2">
                <Select value={t.frequency} onValueChange={(v) => onChange({ ...services, transport: { ...t, frequency: v as TransportService["frequency"] } })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Fréquence" /></SelectTrigger>
                  <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {t.zones.map((z, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input className="max-w-48" value={z.name} onChange={(e) => { const zones = [...t.zones]; zones[i] = { ...z, name: e.target.value }; onChange({ ...services, transport: { ...services.transport, zones } }) }} />
                  <Input type="number" className="max-w-32" value={String(z.price ?? 0)} onChange={(e) => { const zones = [...t.zones]; zones[i] = { ...z, price: Number(e.target.value) || 0 }; onChange({ ...services, transport: { ...services.transport, zones } }) }} />
                  <span className="text-xs text-muted-foreground">{fcfa(z.price)} / {t.frequency}</span>
                  <Button variant="ghost" size="icon" onClick={() => onChange({ ...services, transport: { ...t, zones: t.zones.filter((_, x) => x !== i) } })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-48" placeholder="Zone (ex. Cocody)" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
                <Input className="max-w-32" type="number" placeholder="Prix" value={zonePrice} onChange={(e) => setZonePrice(e.target.value)} />
                <Button variant="outline" size="sm" onClick={addZone}><Plus className="size-4" /> Ajouter une zone</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cantine</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Toggle checked={c.enabled} onChange={(v) => onChange({ ...services, cantine: { ...c, enabled: v, type: v ? (c.type === "none" ? "regime" : c.type) : "none" } })} label="La cantine est proposée" />
          {c.enabled && (
            <>
              <div className="flex flex-wrap gap-2">
                <Select value={c.frequency} onValueChange={(v) => onChange({ ...services, cantine: { ...c, frequency: v as CantineService["frequency"] } })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Fréquence" /></SelectTrigger>
                  <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {c.regimes.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input className="max-w-48" value={r.name} onChange={(e) => { const regimes = [...c.regimes]; regimes[i] = { ...r, name: e.target.value }; onChange({ ...services, cantine: { ...services.cantine, regimes } }) }} />
                  <Input type="number" className="max-w-32" value={String(r.price ?? 0)} onChange={(e) => { const regimes = [...c.regimes]; regimes[i] = { ...r, price: Number(e.target.value) || 0 }; onChange({ ...services, cantine: { ...services.cantine, regimes } }) }} />
                  <span className="text-xs text-muted-foreground">{fcfa(r.price)} / {c.frequency}</span>
                  <Button variant="ghost" size="icon" onClick={() => onChange({ ...services, cantine: { ...c, regimes: c.regimes.filter((_, x) => x !== i) } })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-48" placeholder="Régime ou formule" value={regimeName} onChange={(e) => setRegimeName(e.target.value)} />
                <Input className="max-w-32" type="number" placeholder="Prix" value={regimePrice} onChange={(e) => setRegimePrice(e.target.value)} />
                <Button variant="outline" size="sm" onClick={addRegime}><Plus className="size-4" /> Ajouter</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uniforme scolaire</CardTitle>
          <p className="text-sm text-muted-foreground">Une seule question : l'établissement vend-il ou fournit-il les tenues ?</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle checked={u.enabled} onChange={(v) => onChange({ ...services, tenues: { ...u, enabled: v, type: v ? "uniform" : "dress_code" } })} label="L'établissement fournit / vend l'uniforme" />
          {u.enabled ? (
            <>
              <p className="text-sm">Ajoutez simplement les kits et leurs prix.</p>
              {u.items.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input className="max-w-56" value={item.name} onChange={(e) => { const items = [...u.items]; items[i] = { ...item, name: e.target.value }; onChange({ ...services, tenues: { ...u, items } }) }} />
                  <Input type="number" className="max-w-32" value={String(item.price ?? 0)} onChange={(e) => { const items = [...u.items]; items[i] = { ...item, price: Number(e.target.value) || 0 }; onChange({ ...services, tenues: { ...u, items } }) }} />
                  <span className="text-xs text-muted-foreground">{fcfa(item.price)}</span>
                  <Button variant="ghost" size="icon" onClick={() => onChange({ ...services, tenues: { ...u, items: u.items.filter((_, x) => x !== i) } })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-56" placeholder="Ex. Kit scolaire complet" value={kitName} onChange={(e) => setKitName(e.target.value)} />
                <Input type="number" className="max-w-32" placeholder="Prix" value={kitPrice} onChange={(e) => setKitPrice(e.target.value)} />
                <Button variant="outline" size="sm" onClick={addKit}><Plus className="size-4" /> Ajouter un kit</Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">L'uniforme est acheté par la famille.</p>
              <p className="mt-1 text-muted-foreground">Vous pourrez préciser les exigences de tenue dans les informations publiques de l'établissement.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
