"use client"
import { useEffect, useState } from "react"
import { getGradeChangeRequestHistory, type GradeChangeRequestHistory } from "@/app/dashboard/pedagogie/grade-correction-actions"
export function RequestHistory({requestId}:{requestId:string}){
 const [rows,setRows]=useState<GradeChangeRequestHistory[]>([])
 const [error,setError]=useState("")
 useEffect(()=>{ void getGradeChangeRequestHistory(requestId).then(r=>{if(r.error)setError(r.error);else setRows(r.data??[])}) },[requestId])
 if(error)return <p className="mt-2 text-xs text-destructive">{error}</p>
 return <ol className="mt-3 space-y-2 border-l pl-4">{rows.map(row=><li key={row.id} className="text-xs"><div className="font-medium">{row.event_type==="created"?"Création":row.event_type==="approved"?"Confirmation":"Refus"} · {row.actor_name_snapshot??"Utilisateur"}</div><div className="text-muted-foreground">{new Date(row.created_at).toLocaleString("fr-FR")} · {row.status_before??"—"} → {row.status_after}</div>{row.decision_reason&&<div>Motif : {row.decision_reason}</div>}</li>)}</ol>
}