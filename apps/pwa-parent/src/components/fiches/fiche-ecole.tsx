// M4 — Fiche ecole publique (PWA parent, SANS auth) : header, offre, tarifs,
// services optionnels, selecteur de classe puis fournitures.
// Donnees : GET /api/v1/public/ecoles/[id]/fiche (schooly, garde-fou M1/M4).

"use client"

import { useEffect, useState } from "react"
import { Loader2, MapPin, Phone, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FicheModeAButton } from "@/components/fiches/fiche-mode-a-button"
import { PreinscriptionForm } from "@/components/fiches/preinscription-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { BadgeCycle, BadgeSerie, ServiceIcon } from "@/components/fiches/badges"

type FicheResponse = {
  ecole: { id: string; nom: string; ville: string | null; adresse: string | null; telephone: string | null; email: string | null; logo: string | null }
  formations: { key: string; label: string; levels: { grade_level_name: string; series: string[]; diploma: string }[] }[]
  formation: { key: string; label: string; levels: { grade_level_name: string; series: string[]; diploma: string }[] } | null
  cycles: { cycles: { key: string; label: string; levels: { grade_level_name: string; series: string[]; diploma: string }[] }[] }
  tarifs: { currency: string; registration_fee?: { amount: number }; academic_fee?: { amount: number }; registration_fees?: { amount: number; status: string }[]; school_fees?: { amount: number; status: string }[]; exam_fees?: { class_name: string; exam_name: string; amount: number; amount_affecte?: number; amount_non_affecte?: number }[]; custom_fees?: { id: string; label: string; amount: number; status: string }[]; installments: { label: string; amount: number; due_date: string | null }[]; notes?: string }
  services: { transport: { enabled: boolean; vehicle_icon: string; zones: { name: string; price: number }[] }; cantine: { enabled: boolean; meal_icon: string; regimes: { name: string; price: number }[] }; tenues: { enabled: boolean; items: { name: string }[] } }
  classes: string[]
  fournitures: { manuals: { subject: string; title: string; editor: string; icon: string; required_for_inscription: boolean }[]; stationery: { name: string; quantity: string; icon: string }[]; equipment: { name: string; quantity: string; icon: string; required_for_inscription: boolean }[] } | null
}

function fcfa(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} F`
}

export function FicheEcole({ schoolId, apiBase }: { schoolId: string; apiBase: string }) {
  const [data, setData] = useState<FicheResponse | null>(null)
  const [formation, setFormation] = useState("")
  const [classe, setClasse] = useState("")
  const [loadingF, setLoadingF] = useState(false)
  const [loadingTarifs, setLoadingTarifs] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`${apiBase}/api/v1/public/ecoles/${schoolId}/fiche`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("introuvable"))))
      .then((j: FicheResponse) => setData(j))
      .catch(() => setError("Fiche introuvable ou ecole non publiee."))
  }, [apiBase, schoolId])

  async function selectFormation(next: string) {
    setFormation(next)
    setClasse("")
    setLoadingTarifs(true)
    try {
      const r = await fetch(`${apiBase}/api/v1/public/ecoles/${schoolId}/fiche?formation=${encodeURIComponent(next)}`)
      if (!r.ok) throw new Error("tarifs indisponibles")
      const j: FicheResponse = await r.json()
      setData((current) => current ? { ...current, formation: j.formation, tarifs: j.tarifs } : current)
    } catch {
      // Le parcours reste utilisable avec les tarifs déjà chargés.
    } finally {
      setLoadingTarifs(false)
    }
  }

  async function selectClasse(next: string) {
    setClasse(next)
    if (!next || !data) return
    setLoadingF(true)
    try {
      const r = await fetch(`${apiBase}/api/v1/public/ecoles/${schoolId}/fiche?classe=${encodeURIComponent(next)}`)
      const j: FicheResponse = await r.json()
      setData({ ...data, fournitures: j.fournitures })
    } catch { /* selecteur reste utilisable */ } finally { setLoadingF(false) }
  }

  if (error) return (<div className="mx-auto max-w-2xl space-y-2 p-6"><h1 className="text-xl font-semibold">Fiche ecole</h1><p className="text-sm text-muted-foreground">{error}</p></div>)
  if (!data) return (<div className="mx-auto flex max-w-2xl items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement de la fiche…</div>)
  const selectedFormation = data.formations?.find((x) => x.key === formation) ?? data.formation
  const activeLevels = selectedFormation?.levels ?? []
  const f = data.fournitures
  const registrationTotal = (data.tarifs.registration_fees ?? []).reduce((sum, item) => sum + item.amount, 0) || data.tarifs.registration_fee?.amount || 0
  const schoolTotal = (data.tarifs.school_fees ?? []).reduce((sum, item) => sum + item.amount, 0) || data.tarifs.academic_fee?.amount || 0
  const customTotal = (data.tarifs.custom_fees ?? []).reduce((sum, item) => sum + item.amount, 0)
  const scheduleTotal = (data.tarifs.installments ?? []).reduce((sum, item) => sum + item.amount, 0)
  const totalPole = registrationTotal + schoolTotal + customTotal
  const totalWithSchedule = totalPole + (scheduleTotal > 0 ? scheduleTotal : 0)
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <Card><CardContent className="flex items-center gap-3 pt-4">
        {data.ecole.logo ? <img src={data.ecole.logo} alt="" className="size-16 rounded-lg border object-contain" /> : null}
        <div><h1 className="text-xl font-semibold">{data.ecole.nom}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {data.ecole.ville ? (<span className="flex items-center gap-1"><MapPin className="size-3.5" />{data.ecole.ville}</span>) : null}
          {data.ecole.telephone ? (<span className="flex items-center gap-1"><Phone className="size-3.5" />{data.ecole.telephone}</span>) : null}
          {data.ecole.email ? (<span className="flex items-center gap-1"><Mail className="size-3.5" />{data.ecole.email}</span>) : null}
        </p></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Choisir votre formation</CardTitle></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Un seul établissement, plusieurs pôles : choisissez le parcours qui correspond à votre enfant.</p>
      <div className="grid gap-2 sm:grid-cols-2">{data.formations.map((c) => (<button key={c.key} type="button" onClick={() => selectFormation(c.key)} className={`rounded-lg border p-3 text-left transition ${formation === c.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}><div className="font-medium">{c.label}</div><div className="mt-1 text-xs text-muted-foreground">{c.levels.length} niveau{c.levels.length > 1 ? "x" : ""} proposé{c.levels.length > 1 ? "s" : ""}</div></button>))}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Offre academique</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.cycles.cycles.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <BadgeCycle cycleKey={c.key} label={c.label} />
            <div className="flex flex-wrap gap-1.5">
              {c.levels.map((l) => (
                <span key={l.grade_level_name} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  {l.grade_level_name}
                  {l.series.map((s) => (<BadgeSerie key={s} serie={s} />))}
                  {l.diploma !== "aucun" ? <Badge variant="secondary">{l.diploma}</Badge> : null}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Parcours {selectedFormation?.label ? `— ${selectedFormation.label}` : ""}</CardTitle></CardHeader><CardContent className="space-y-1.5">{selectedFormation ? selectedFormation.levels.map((l) => <div key={l.grade_level_name} className="rounded-md border p-2 text-sm"><span className="font-medium">{l.grade_level_name}</span>{l.series.length ? <span className="ml-2 text-muted-foreground">{l.series.join(" · ")}</span> : null}{l.diploma !== "aucun" ? <Badge variant="secondary" className="ml-2">{l.diploma}</Badge> : null}</div>) : <p className="text-sm text-muted-foreground">Sélectionnez un pôle pour voir son parcours.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Tarifs {selectedFormation?.label ? `— ${selectedFormation.label}` : ""} ({data.tarifs.currency})</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {data.tarifs.registration_fees?.length ? data.tarifs.registration_fees.map((f) => <p key={`ins-${f.status}`}>Frais d'inscription — {f.status === "affecte" ? "élève affecté" : "élève non affecté"} : <strong>{fcfa(f.amount)}</strong></p>) : data.tarifs.registration_fee ? (<p>Frais d'inscription : <strong>{fcfa(data.tarifs.registration_fee.amount)}</strong></p>) : null}
        {data.tarifs.school_fees?.length ? data.tarifs.school_fees.map((f) => <p key={`sco-${f.status}`}>Frais de scolarité — {f.status === "affecte" ? "élève affecté" : "élève non affecté"} : <strong>{fcfa(f.amount)}</strong></p>) : data.tarifs.academic_fee ? (<p>Frais de scolarité : <strong>{fcfa(data.tarifs.academic_fee.amount)}</strong></p>) : null}
        {data.tarifs.custom_fees?.length ? <div className="border-t pt-2"><p className="font-medium">Autres frais</p>{data.tarifs.custom_fees.map((f) => <p key={f.id}>{f.label} — {f.status === "affecte" ? "élève affecté" : "élève non affecté"} : <strong>{fcfa(f.amount)}</strong></p>)}</div> : null}
        {data.tarifs.exam_fees?.length ? <div className="border-t pt-2"><p className="font-medium">Droits d'examen</p>{data.tarifs.exam_fees.map((f) => <div key={f.class_name + f.exam_name}><p>{f.class_name} — {f.exam_name}</p><p className="pl-3">Élève affecté : <strong>{fcfa(f.amount_affecte ?? f.amount)}</strong></p><p className="pl-3">Élève non affecté : <strong>{fcfa(f.amount_non_affecte ?? f.amount)}</strong></p></div>)}</div> : null}
        {(data.tarifs.installments ?? []).map((t, i) => (<p key={i}>{t.label} : <strong>{fcfa(t.amount)}</strong>{t.due_date ? ` — ${t.due_date}` : ""}</p>))}
        {data.tarifs.notes ? <p className="text-muted-foreground">{data.tarifs.notes}</p> : null}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Services optionnels</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {data.services.transport.enabled ? (<p className="flex items-center gap-2"><ServiceIcon name={data.services.transport.vehicle_icon} />Transport : {data.services.transport.zones.map((z) => `${z.name} (${fcfa(z.price)})`).join(" · ") || "nous contacter"}</p>) : null}
        {data.services.cantine.enabled ? (<p className="flex items-center gap-2"><ServiceIcon name={data.services.cantine.meal_icon} />Cantine : {data.services.cantine.regimes.map((r) => `${r.name} (${fcfa(r.price)})`).join(" · ") || "nous contacter"}</p>) : null}
        {data.services.tenues.enabled ? (<p className="flex items-center gap-2"><ServiceIcon name="shirt" />Tenues : {data.services.tenues.items.map((t) => t.name).join(" · ")}</p>) : null}
        {!data.services.transport.enabled && !data.services.cantine.enabled && !data.services.tenues.enabled ? (<p className="text-muted-foreground">Aucun service optionnel declare.</p>) : null}
      </CardContent></Card>
      <PreinscriptionForm formations={data.formations} formation={formation} onFormationChange={selectFormation} schoolId={schoolId} />
      <Card><CardHeader><CardTitle className="text-base">Fournitures par classe</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Classe de votre enfant</span><Select value={classe} onChange={(e) => selectClasse(e.target.value)}><option value="">Choisir une classe…</option>{(activeLevels.length ? activeLevels.map((x) => x.grade_level_name) : data.classes).map((c) => (<option key={c} value={c}>{c}</option>))}</Select></label>
        {loadingF ? (<p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement…</p>) : null}
        {classe && f ? (
          <div className="space-y-3 text-sm">
            {f.manuals.length ? (<div><p className="font-medium">Manuels</p>{f.manuals.map((m, i) => (<p key={i} className="flex items-center gap-2"><ServiceIcon name={m.icon} />{m.subject} — {m.title}{m.editor ? ` (${m.editor})` : ""}{m.required_for_inscription ? <Badge variant="secondary">requis</Badge> : null}</p>))}</div>) : null}
            {f.stationery.length ? (<div><p className="font-medium">Papeterie</p>{f.stationery.map((s, i) => (<p key={i} className="flex items-center gap-2"><ServiceIcon name={s.icon} />{s.name} × {s.quantity}</p>))}</div>) : null}
            {f.equipment.length ? (<div><p className="font-medium">A apporter a l&apos;inscription</p>{f.equipment.map((e, i) => (<p key={i} className="flex items-center gap-2"><ServiceIcon name={e.icon} />{e.name} × {e.quantity}{e.required_for_inscription ? <Badge variant="secondary">requis</Badge> : null}</p>))}</div>) : null}
            <FicheModeAButton data={{
              ecoleNom: data.ecole.nom,
              ecoleVille: data.ecole.ville,
              ecoleContact: data.ecole.telephone ?? data.ecole.email,
              classe,
              currency: data.tarifs.currency,
              registrationFee: data.tarifs.registration_fee?.amount ?? null,
              academicFee: data.tarifs.academic_fee?.amount ?? null,
              installments: data.tarifs.installments,
              manuals: f.manuals.map((m) => ({ subject: m.subject, title: m.title, editor: m.editor, required: m.required_for_inscription })),
              stationery: f.stationery.map((st) => ({ name: st.name, quantity: st.quantity })),
              equipment: f.equipment.map((e) => ({ name: e.name, quantity: e.quantity, required: e.required_for_inscription })),
              transport: data.services.transport.enabled ? data.services.transport.zones.map((z) => `${z.name} (${fcfa(z.price)})`).join(" · ") : null,
              cantine: data.services.cantine.enabled ? data.services.cantine.regimes.map((r) => `${r.name} (${fcfa(r.price)})`).join(" · ") : null,
              tenues: data.services.tenues.enabled ? data.services.tenues.items.map((t) => t.name).join(" · ") : null,
              notes: data.tarifs.notes ?? null,
            }} />
          </div>
        ) : classe && !f ? (
          <p className="text-sm text-muted-foreground">Liste en cours de publication par l&apos;ecole.</p>
        ) : (
          <p className="text-sm text-muted-foreground">{formation ? "Sélectionnez une classe pour poursuivre le parcours." : "Sélectionnez d’abord un pôle de formation."}</p>
        )}
      </CardContent></Card>
    </div>
  )
}
