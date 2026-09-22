"use client"

import { useState, useTransition } from "react"
import { Check, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { SupplyReviewRow } from "./supply-review-actions"
import { publishClassSupplyFromProposals, reviewSupplyProposal } from "./supply-review-actions"

export function SupplyReview({ initial }:{initial:SupplyReviewRow[]}){
 const [items,setItems]=useState(initial);const [note,setNote]=useState<Record<string,string>>({});const [pending,startTransition]=useTransition()
 const classes=[...new Map(items.map(x=>[x.class_id,x.class_name])).entries()]
 function review(id:string,decision:"approved"|"changes_requested"|"rejected"){startTransition(async()=>{const r=await reviewSupplyProposal(id,decision,note[id]??"");if(r.ok){setItems(xs=>xs.map(x=>x.id===id?{...x,status:decision,review_note:note[id]??null}:x));toast.success(decision==="approved"?"Proposition validée.":"Décision enregistrée.")}else toast.error(r.error)})}
 if(!items.length)return <Card><CardHeader><CardTitle className="text-base">Propositions des enseignants</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Aucune proposition pour le moment. Les enseignants les verront dans leur espace pédagogique.</CardContent></Card>
 return <Card><CardHeader><CardTitle className="text-base">Propositions des enseignants</CardTitle></CardHeader><CardContent className="space-y-4">
 {classes.map(([classId,className])=>{const rows=items.filter(x=>x.class_id===classId);return <div key={classId} className="rounded-xl border p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{className}</h3><p className="text-xs text-muted-foreground">{rows.length} matière(s) ayant proposé des fournitures</p></div><Button size="sm" disabled={pending||rows.some(x=>x.status!=="approved")} onClick={()=>startTransition(async()=>{const r=await publishClassSupplyFromProposals(classId);if(r.ok)toast.success(`Liste de ${className} publiée.`);else toast.error(r.error)})}><Send className="mr-1 size-4"/>Publier la liste</Button></div>
 <div className="space-y-2">{rows.map(x=><div key={x.id} className="rounded-lg bg-muted/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium">{x.subject_name}</div><div className="text-xs text-muted-foreground">{x.teacher_name} · révision {x.revision}</div></div><Badge variant={x.status==="approved"?"default":x.status==="submitted"?"secondary":"outline"}>{x.status==="changes_requested"?"Correction demandée":x.status==="approved"?"Validée":x.status==="submitted"?"À valider":x.status}</Badge></div><div className="mt-2 grid gap-1 text-xs"><span>📚 {x.configurations.manuals.length} manuel(s)</span><span>📒 {x.configurations.stationery.length} fourniture(s)</span><span>🎒 {x.configurations.equipment.length} matériel(s)</span></div>{x.status==="submitted"&&<div className="mt-3 flex flex-wrap gap-2"><Input className="min-w-56 flex-1" placeholder="Note au professeur (facultatif)" value={note[x.id]??""} onChange={e=>setNote(n=>({...n,[x.id]:e.target.value}))}/><Button size="sm" onClick={()=>review(x.id,"approved")} disabled={pending}><Check className="mr-1 size-4"/>Valider</Button><Button size="sm" variant="outline" onClick={()=>review(x.id,"changes_requested")} disabled={pending}><MessageSquare className="mr-1 size-4"/>Demander correction</Button></div>}</div>)}</div></div>})}
 </CardContent></Card>
}
