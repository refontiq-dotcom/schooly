"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ActionForm } from "@/components/action-form"
import { reviewMoratorium } from "@/app/dashboard/finance/moratoriums/actions"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"

export function ReviewMoratoriumModal({ moratorium, onSuccess }: { moratorium: { id:string; requested_amount:number; reason:string; due_date:string; student:string }; onSuccess?:()=>void }) {
  const [open,setOpen]=useState(false)
  const [action,setAction]=useState<"approve"|"reject">("approve")
  const [count,setCount]=useState("3")
  async function submit(fd:FormData){
    const result=await reviewMoratorium(fd)
    if(result.error){toast.error(result.error);return}
    toast.success(action==="approve" ? "Moratoire approuvé et échéancier créé." : "Demande rejetée.")
    setOpen(false); onSuccess?.()
  }
  return <>
    <div className="flex gap-1">
      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Examiner" onClick={()=>{setAction("approve");setOpen(true)}}><CheckCircle2 className="h-4 w-4" /></Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Rejeter" onClick={()=>{setAction("reject");setOpen(true)}}><XCircle className="h-4 w-4 text-destructive" /></Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen} label="Examiner un moratoire">
      <DialogClose onClick={()=>setOpen(false)} />
      <DialogHeader>
        <DialogTitle>{action==="approve" ? "Approuver le moratoire" : "Rejeter la demande"}</DialogTitle>
        <DialogDescription>{moratorium.student} · {moratorium.requested_amount.toLocaleString("fr-FR")} FCFA · échéance proposée {moratorium.due_date}</DialogDescription>
      </DialogHeader>
      <DialogContent>
        <ActionForm action={submit}>
          <input type="hidden" name="moratoriumId" value={moratorium.id} />
          <input type="hidden" name="action" value={action} />
          {action==="approve" ? <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm"><span className="text-muted-foreground">Motif : </span>{moratorium.reason}</div>
            <div className="space-y-1">
              <Label htmlFor="approvedAmount">Montant approuvé (FCFA)</Label>
              <Input id="approvedAmount" name="approvedAmount" type="number" min="1" max={moratorium.requested_amount} defaultValue={moratorium.requested_amount} required />
            </div>
            <div className="space-y-1">
              <Label>Nombre d&apos;échéances</Label>
              <Select name="installmentCount" value={count} onValueChange={setCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[2,3,4,5,6,8,10,12].map(n=><SelectItem key={n} value={String(n)}>{n} échéances</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Schooly crée automatiquement l&apos;échéancier et le suivra.</p>
            </div>
          </div> : <div className="rounded-md border border-destructive/30 p-3 text-sm">Cette décision clôturera la demande. La famille pourra déposer une nouvelle demande si les règles de l&apos;établissement l&apos;autorisent.</div>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Annuler</Button>
            <Button type="submit" variant={action==="approve" ? "default" : "destructive"}>{action==="approve" ? "Approuver et planifier" : "Rejeter"}</Button>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  </>
}
