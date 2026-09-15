import { redirect } from "next/navigation"
import { Building2, User, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { getSchoolSettings, updateSchoolSettings, updateDirectorProfile } from "./actions"
import { SCHOOL_TYPES } from "./school-types"

export default async function SettingsPage() {
  let settings
  try {
    settings = await getSchoolSettings()
  } catch {
    redirect("/login")
  }

  const typeLabel =
    SCHOOL_TYPES.find((t) => t.value === settings.school_type)?.label ?? "Non renseigné"

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Informations de l&apos;établissement et du compte de direction.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identité de l'établissement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Établissement
            </CardTitle>
            <CardDescription>
              Ces informations apparaissent dans le menu et sur vos documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateSchoolSettings} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">Nom de l&apos;établissement</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={settings.name}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={settings.city ?? ""}
                  placeholder="Ex: Abidjan"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="schoolType">Type d&apos;établissement</Label>
                <select
                  id="schoolType"
                  name="schoolType"
                  defaultValue={settings.school_type ?? ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Non renseigné</option>
                  {SCHOOL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full">
                Enregistrer les modifications
              </Button>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Compte de direction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" /> Compte de direction
              </CardTitle>
              <CardDescription>
                Nom affiché pour l&apos;utilisateur connecté.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateDirectorProfile} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={settings.directorName}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email professionnel</Label>
                  <Input
                    id="email"
                    name="email"
                    defaultValue={settings.directorEmail ?? ""}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    L&apos;adresse de connexion ne peut pas être modifiée ici.
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Mettre à jour mon profil
                </Button>
              </ActionForm>
            </CardContent>
          </Card>

          {/* Informations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" /> Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type actuel</span>
                <span className="font-medium">{typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Créé le</span>
                <span className="font-medium">
                  {new Date(settings.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Annuaire Trouvetou</span>
                <Badge variant={settings.published_to_trouvetou ? "default" : "secondary"}>
                  {settings.published_to_trouvetou ? "Publié" : "Non publié"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                La publication dans l&apos;annuaire se gère depuis le module Trouvetou.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
