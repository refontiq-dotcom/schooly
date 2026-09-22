"use client"

import { useState, useTransition } from "react"
import { Check, FileText, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ClassSuppliesConfiguration } from "@/lib/fiches/types"
import type { TeacherSupplyProposal } from "./actions"
import { saveTeacherSupplyProposal, submitTeacherSupplyProposal } from "./actions"

type Proposal = TeacherSupplyProposal
const statusLabel: Record<Proposal["status"], string> = {
  draft:"Brouillon", submitted:"Soumise", changes_requested:"Correction demandée", approved:"Validée", rejected:"Refusée"
}

function emptyConfig(name:string):ClassSuppliesConfiguration {
  return {status:"draft",class_label:name,level:0,cycle:"",year:"",manuals:[],stationery:[],equipment:[]}
}

export function TeacherSuppliesClient({initial}:{initial:Proposal[]}) {
  const [items,setItems]=useState(initial)
  const [selected,setSelected]=useState(initial[0]?.assignment_id ?? "")
  const [pending,startTransition]=useTransition()
  const current=items.find(x=>x.assignment_id===selected)
  function patch(config:ClassSuppliesConfiguration){ if(!current)return; setItems(xs=>xs.map(x=>x.assignment_id===current.assignment_id?{...x,configurations:config}:x)) }
  function save(){if(!current)return;startTransition(async()=>{const r=await saveTeacherSupplyProposal(current.assignment_id,current.configurations);if(r.ok)toast.success("Votre liste est enregistrée.");else toast.error(r.error)})}
  function submit(){if(!current)return;startTransition(async()=>{const r=await submitTeacherSupplyProposal(current.assignment_id);if(r.ok){setItems(xs=>xs.map(x=>x.assignment_id===current.assignment_id?{...x,status:"submitted",review_note:null}:x));toast.success("Liste envoyée à la direction.");}else toast.error(r.error)})}
  if(!items.length)return <div className="mx-auto max-w-4xl p-6"><Card><CardHeader><CardTitle>Aucune matière affectée</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Schooly affichera ici les classes et matières qui vous sont attribuées.</CardContent></Card></div>
  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Mes fournitures</h1><p className="mt-1 text-sm text-muted-foreground">Préparez les besoins de vos matières. La direction valide ensuite la liste officielle.</p></div>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card><CardHeader><CardTitle className="text-base">Mes matières</CardTitle></CardHeader><CardContent className="space-y-2">{items.map(x=><button key={x.assignment_id} onClick={()=>setSelected(x.assignment_id)} className={`w-full rounded-xl border p-3 text-left transition ${selected===x.assignment_id?"border-primary bg-primary/5":"hover:bg-muted/50"}`}><div className="font-medium">{x.subject_name}</div><div className="text-xs text-muted-foreground">{x.class_name}</div><Badge variant={x.status==="approved"?"default":x.status==="submitted"?"secondary":"outline"} className="mt-2">{statusLabel[x.status]}</Badge></button>)}</CardContent></Card>
      {current&&<Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{current.subject_name} — {current.class_name}</CardTitle><p className="text-sm text-muted-foreground">Révision {current.revision}. Vos modifications restent enregistrées pour cette matière.</p></div><div className="flex gap-2"><Button variant="outline" onClick={save} disabled={pending}><Check className="mr-1 size-4"/>Enregistrer</Button><Button onClick={submit} disabled={pending}><Send className="mr-1 size-4"/>Soumettre</Button></div></div>{current.review_note&&<div className="mt-3 rounded-lg border border-orange-300/50 bg-orange-50 p-3 text-sm">Demande de correction : {current.review_note}</div>}</CardHeader>
      <CardContent className="space-y-6">
        <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">📚 Manuel</h2><p className="text-xs text-muted-foreground">Le livre que les parents doivent utiliser.</p></div><Button variant="outline" size="sm" onClick={()=>patch({...current.configurations,manuals:[...current.configurations.manuals,{subject:current.subject_name,title:"",editor:"",icon:"book",required_for_inscription:false}]})}><Plus className="mr-1 size-4"/>Ajouter</Button></div>
        <div className="space-y-2">{current.configurations.manuals.map((m,i)=><div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_2fr_1fr_auto]"><div><Label>Matière</Label><Input value={m.subject} onChange={e=>{const a=[...current.configurations.manuals];a[i]={...m,subject:e.target.value};patch({...current.configurations,manuals:a})}}/></div><div><Label>Titre *</Label><Input value={m.title} onChange={e=>{const a=[...current.configurations.manuals];a[i]={...m,title:e.target.value};patch({...current.configurations,manuals:a})}}/></div><div><Label>Éditeur</Label><Input value={m.editor} onChange={e=>{const a=[...current.configurations.manuals];a[i]={...m,editor:e.target.value};patch({...current.configurations,manuals:a})}}/></div><Button variant="ghost" size="icon" className="self-end" onClick={()=>patch({...current.configurations,manuals:current.configurations.manuals.filter((_,x)=>x!==i)})}><Trash2 className="size-4"/></Button></div>)}</div></section>
        <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">📒 Cahiers & papeterie</h2></div><Button variant="outline" size="sm" onClick={()=>patch({...current.configurations,stationery:[...current.configurations.stationery,{category:"Écriture",name:"",quantity:"",icon:"file-text"}]})}><Plus className="mr-1 size-4"/>Ajouter</Button></div>
        <div className="space-y-2">{current.configurations.stationery.map((s,i)=><div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_2fr_1fr_auto]"><div><Label>Catégorie</Label><Input value={s.category} onChange={e=>{const a=[...current.configurations.stationery];a[i]={...s,category:e.target.value};patch({...current.configurations,stationery:a})}}/></div><div><Label>Article *</Label><Input value={s.name} onChange={e=>{const a=[...current.configurations.stationery];a[i]={...s,name:e.target.value};patch({...current.configurations,stationery:a})}}/></div><div><Label>Quantité *</Label><Input value={s.quantity} onChange={e=>{const a=[...current.configurations.stationery];a[i]={...s,quantity:e.target.value};patch({...current.configurations,stationery:a})}}/></div><Button variant="ghost" size="icon" className="self-end" onClick={()=>patch({...current.configurations,stationery:current.configurations.stationery.filter((_,x)=>x!==i)})}><Trash2 className="size-4"/></Button></div>)}</div></section>
        <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">🎒 Matériel</h2><p className="text-xs text-muted-foreground">Ce qui est nécessaire pour votre matière.</p></div><Button variant="outline" size="sm" onClick={()=>patch({...current.configurations,equipment:[...current.configurations.equipment,{name:"",quantity:"",required_for_inscription:false,icon:"briefcase"}]})}><Plus className="mr-1 size-4"/>Ajouter</Button></div>
        <div className="space-y-2">{current.configurations.equipment.map((e,i)=><div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[2fr_1fr_1fr_auto]"><div><Label>Article *</Label><Input value={e.name} onChange={x=>{const a=[...current.configurations.equipment];a[i]={...e,name:x.target.value};patch({...current.configurations,equipment:a})}}/></div><div><Label>Quantité *</Label><Input value={e.quantity} onChange={x=>{const a=[...current.configurations.equipment];a[i]={...e,quantity:x.target.value};patch({...current.configurations,equipment:a})}}/></div><label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={e.required_for_inscription} onChange={x=>{const a=[...current.configurations.equipment];a[i]={...e,required_for_inscription:x.target.checked};patch({...current.configurations,equipment:a})}}/>Inscription</label><Button variant="ghost" size="icon" className="self-end" onClick={()=>patch({...current.configurations,equipment:current.configurations.equipment.filter((_,x)=>x!==i)})}><Trash2 className="size-4"/></Button></div>)}</div></section>
        <div className="flex items-center justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={save} disabled={pending}><FileText className="mr-1 size-4"/>Enregistrer le brouillon</Button><Button onClick={submit} disabled={pending}><Send className="mr-1 size-4"/>Envoyer à la direction</Button></div>
      </CardContent></Card>}
    </div>
  </div>
}
