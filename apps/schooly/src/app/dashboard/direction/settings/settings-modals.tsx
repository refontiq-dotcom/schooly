"use client"

import { useState } from "react"
import { Building2, Pencil, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ActionForm } from "@/components/action-form"
import { updateSchoolSettings, updateDirectorProfile, type SchoolSettings } from "./actions"
import { SCHOOL_TYPES } from "./school-types"
import { toast } from "sonner"

export function EditSchoolSettingsModal({ settings }: { settings: SchoolSettings }) {
  const [open, setOpen] = useState(false)
  async function submit(formData: FormData) {
    const result = await updateSchoolSettings(formData)
    if (result?.error) { toast.error(result.error); return }
    toast.success("Informations de l’établissement mises à jour.")
    setOpen(false)
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Pencil className="mr-2 h-4 w-4" />Modifier</Button>
      <Dialog open={open} onOpenChange={setOpen} label="Modifier l'établissement">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Modifier l’établissement</DialogTitle>
          <DialogDescription>Modifiez uniquement les informations utilisées par Schooly pour identifier votre établissement.</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={submit} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="settings-name">Nom de l’établissement</Label><Input id="settings-name" name="name" defaultValue={settings.name} required /></div>
            <div className="space-y-1"><Label htmlFor="settings-city">Ville</Label><Input id="settings-city" name="city" defaultValue={settings.city ?? ""} placeholder="Ex. Abidjan" /></div>
            <div className="space-y-1"><Label htmlFor="settings-type">Type d’établissement</Label>
              <select id="settings-type" name="schoolType" defaultValue={settings.school_type ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Non renseigné</option>
                {SCHOOL_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function EditDirectorProfileModal({ settings }: { settings: SchoolSettings }) {
  const [open, setOpen] = useState(false)
  async function submit(formData: FormData) {
    const result = await updateDirectorProfile(formData)
    if (result?.error) { toast.error(result.error); return }
    toast.success("Votre profil a été mis à jour.")
    setOpen(false)
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Pencil className="mr-2 h-4 w-4" />Modifier</Button>
      <Dialog open={open} onOpenChange={setOpen} label="Modifier mon profil">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Modifier mon profil</DialogTitle>
          <DialogDescription>Votre nom est utilisé dans Schooly. L’adresse de connexion reste inchangée.</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={submit} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="profile-name">Nom complet</Label><Input id="profile-name" name="fullName" defaultValue={settings.directorName} required /></div>
            <div className="space-y-1"><Label htmlFor="profile-email">Email professionnel</Label><Input id="profile-email" value={settings.directorEmail ?? ""} disabled readOnly /></div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
