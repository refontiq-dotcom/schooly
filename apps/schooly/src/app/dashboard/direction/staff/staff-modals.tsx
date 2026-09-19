"use client"

import { useState } from "react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { createStaffMember } from "./actions"

const ROLE_OPTIONS = [
  { value: "direction", label: "Direction" },
  { value: "professeur", label: "Professeur / Enseignant" },
  { value: "compta", label: "Comptabilité" },
  { value: "secretariat", label: "Secrétariat" },
  { value: "caisse", label: "Caisse" },
  { value: "surveillance", label: "Surveillance" },
]

export function AddStaffModal() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState("professeur")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Ajouter un membre</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un membre du personnel</DialogTitle>
          <DialogDescription>
            Créez son accès Schooly et choisissez sa fonction. Ses menus et permissions seront adaptés automatiquement.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={createStaffMember} onSuccess={() => { toast.success("Accès créé"); setOpen(false) }} onError={(error) => toast.error(error)}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" name="fullName" required placeholder="Ex. Jean Kouassi" />
            </div>
            <div>
              <Label htmlFor="email">Email professionnel</Label>
              <Input id="email" name="email" type="email" required placeholder="jean@etablissement.ci" />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone (facultatif)</Label>
              <Input id="phone" name="phone" placeholder="+225 ..." />
            </div>
            <div>
              <Label>Fonction</Label>
              <Select name="roleCode" value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="password">Mot de passe initial</Label>
              <Input id="password" name="password" type="password" minLength={8} required placeholder="8 caractères minimum" />
              <p className="mt-1 text-xs text-muted-foreground">Communiquez-le au membre par un canal privé. Il pourra ensuite utiliser son propre accès.</p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit">Créer l'accès</Button>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
