import { redirect } from "next/navigation"
import { Building2, User, Info, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSchoolSettings, type SchoolSettings } from "./actions"
import { EditSchoolSettingsModal, EditDirectorProfileModal } from "./settings-modals"
import { IntelligentGuidance } from "@/components/intelligent-guidance"

export default async function SettingsPage() {
  let settings: SchoolSettings
  try {
    settings = await getSchoolSettings()
  } catch {
    redirect("/login")
  }

  const missing: string[] = []
  if (!settings.name?.trim()) missing.push("le nom de l’établissement")
  if (!settings.city?.trim()) missing.push("la ville")
  if (!settings.school_type) missing.push("le type d’établissement")

  const typeLabel = settings.school_type
    ? ({ primaire: "Primaire", college: "Collège", lycee: "Lycée", professionnel: "Professionnel / Technique", islamique: "Islamique / Franco-arabe", superieur: "Supérieur" } as Record<string, string>)[settings.school_type] ?? "Type personnalisé"
    : "Non renseigné"

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">Les informations essentielles de votre établissement et de votre profil.</p>
      </div>

      {missing.length > 0 && (
        <IntelligentGuidance
          title="Une petite mise au point est nécessaire"
          items={[{
            id: "settings-incomplete",
            title: "Quelques informations manquent",
            description: `Il manque ${missing.join(", ")}. Complétez-les seulement si elles sont nécessaires à vos documents ou à l’identification de l’établissement.`,
            severity: "action",
            actionLabel: "Compléter les informations",
            href: "#etablissement",
          }]}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="etablissement">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Établissement</CardTitle>
              <CardDescription>Les informations de base utilisées par Schooly.</CardDescription>
            </div>
            <EditSchoolSettingsModal settings={settings} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Nom</p>
              <p className="font-medium">{settings.name || "À renseigner"}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ville</p><p className="font-medium">{settings.city || "À renseigner"}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{typeLabel}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Mon profil</CardTitle>
              <CardDescription>Ce que les autres utilisateurs voient de votre compte.</CardDescription>
            </div>
            <EditDirectorProfileModal settings={settings} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Nom</p><p className="font-medium">{settings.directorName || "À renseigner"}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Email de connexion</p><p className="font-medium break-all">{settings.directorEmail || "Non renseigné"}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4" />Informations du compte</CardTitle><CardDescription>Informations de référence, sans réglage inutile à modifier.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Type actuel</p><p className="font-medium">{typeLabel}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Créé le</p><p className="font-medium">{new Date(settings.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p></div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Annuaire Trouvetou</p>
            <div className="mt-1 flex items-center gap-2"><Badge variant={settings.published_to_trouvetou ? "default" : "secondary"}>{settings.published_to_trouvetou ? "Publié" : "Non publié"}</Badge>{settings.published_to_trouvetou && <CheckCircle2 className="h-4 w-4" />}</div>
            <p className="mt-1 text-xs text-muted-foreground">Géré depuis Trouvetou.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
