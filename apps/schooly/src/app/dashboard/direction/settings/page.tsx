import { redirect } from "next/navigation"
import { Building2, User, Info, CheckCircle2, Download, Printer, FileText, ListChecks, GraduationCap, BookOpen, CreditCard, Bus, Users, Bell, ShieldCheck, Settings2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSchoolSettings, type SchoolSettings } from "./actions"
import { EditSchoolSettingsModal, EditDirectorProfileModal } from "./settings-modals"
import { IntelligentGuidance } from "@/components/intelligent-guidance"
import { getFicheState } from "../informations/actions"
import { InformationsWizard } from "../informations/informations-wizard"
import { getRequiredDocuments } from "./required-documents-actions"
import { RequiredDocuments } from "./required-documents"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  let settings: SchoolSettings
  try {
    settings = await getSchoolSettings()
  } catch {
    redirect("/login")
  }

  const { tab = "accueil" } = await searchParams
  const activeTab = tab || "accueil"

  const missing: string[] = []
  if (!settings.name?.trim()) missing.push("le nom de l’établissement")
  if (!settings.city?.trim()) missing.push("la ville")
  if (!settings.school_type) missing.push("le type d’établissement")

  const tabs = [
    { id: "accueil", label: "Vue d’ensemble", icon: Settings2 },
    { id: "etablissement", label: "Établissement", icon: Building2 },
    { id: "fiches", label: "Fiches", icon: FileText },
    { id: "formations", label: "Formations & classes", icon: GraduationCap },
    { id: "fonctionnalites", label: "Fonctionnalités", icon: ListChecks },
    { id: "pedagogie", label: "Pédagogie", icon: BookOpen },
    { id: "finance", label: "Frais & paiements", icon: CreditCard },
    { id: "services", label: "Services", icon: Bus },
    { id: "utilisateurs", label: "Utilisateurs & rôles", icon: Users },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "securite", label: "Sécurité", icon: ShieldCheck },
  ] as const

  const typeLabel = settings.school_type
    ? ({ primaire: "Primaire", college: "Collège", lycee: "Lycée", professionnel: "Professionnel / Technique", islamique: "Islamique / Franco-arabe", superieur: "Supérieur" } as Record<string, string>)[settings.school_type] ?? "Type personnalisé"
    : "Non renseigné"

  const fiche = activeTab === "fiches" ? await getFicheState() : null
  const requiredDocuments = activeTab === "fiches" ? await getRequiredDocuments() : null

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurez votre établissement simplement. Schooly vous indique ce qui est prêt et ce qui reste à faire.
          </p>
        </div>

        {activeTab === "accueil" && missing.length > 0 && (
          <IntelligentGuidance
            title="Commencez par les réglages essentiels"
            items={[{
              id: "settings-incomplete",
              title: "Quelques informations manquent",
              description: `Il manque ${missing.join(", ")}. Complétez-les pour que Schooly puisse les utiliser dans vos fiches et documents.`,
              severity: "action",
              actionLabel: "Compléter",
              href: "?tab=etablissement",
            }]}
            contextKey="settings"
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuration</CardTitle>
              <CardDescription>Tout ce qui peut être paramétré par votre établissement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`?tab=${id}`}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${activeTab === id ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </a>
              ))}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            {activeTab === "accueil" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Votre configuration</CardTitle>
                    <CardDescription>Un point de départ clair : ouvrez une rubrique uniquement lorsque vous devez la modifier.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {tabs.slice(1).map(({ id, label, icon: Icon }) => (
                      <a key={id} href={`?tab=${id}`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-2 font-medium"><Icon className="size-4" />{label}</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {id === "fiches" ? "Fiche établissement et fiche de renseignement." :
                           id === "fonctionnalites" ? "Activez seulement les fonctions utiles à votre école." :
                           "Configurez cette rubrique quand vous en avez besoin."}
                        </p>
                      </a>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><User className="size-4" />Mon profil</CardTitle>
                    <CardDescription>Votre compte de direction.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{settings.directorName || "À renseigner"}</p>
                      <p className="text-sm text-muted-foreground">{settings.directorEmail || "Email non renseigné"}</p>
                    </div>
                    <EditDirectorProfileModal settings={settings} />
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "etablissement" && (
              <Card id="etablissement">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4" />Établissement</CardTitle>
                    <CardDescription>Les informations que Schooly utilise dans vos fiches, documents et communications.</CardDescription>
                  </div>
                  <EditSchoolSettingsModal settings={settings} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Nom</p><p className="font-medium">{settings.name || "À renseigner"}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ville</p><p className="font-medium">{settings.city || "À renseigner"}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{typeLabel}</p></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "fiches" && (
              fiche && fiche.ok ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><FileText className="size-5" />Fiches</CardTitle>
                      <CardDescription>Les fiches sont des éléments de configuration de votre établissement. Commencez par la fiche établissement, puis préparez la fiche de renseignement utilisée pour recueillir les informations nécessaires.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-4 bg-muted/20">
                        <p className="font-medium">Fiche de l’établissement</p>
                        <p className="mt-1 text-sm text-muted-foreground">Identité, formations, services et tarifs de l’établissement.</p>
                        <Badge className="mt-3">À configurer ci-dessous</Badge>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="font-medium">Fiche de renseignement</p>
                        <p className="mt-1 text-sm text-muted-foreground">Préparez les informations à recueillir auprès des familles et les champs nécessaires à la préinscription.</p>
                        <Badge variant="secondary" className="mt-3">Configuration dédiée</Badge>
                      </div>
                    </CardContent>
                  </Card>
                  {requiredDocuments?.ok ? <RequiredDocuments initialDocuments={requiredDocuments.documents} /> : <Card><CardContent className="p-6 text-sm text-muted-foreground">{requiredDocuments?.error ?? "Configuration indisponible."}</CardContent></Card>}
                  <InformationsWizard state={fiche.state} />
                </div>
              ) : (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">{fiche?.error ?? "Cette rubrique n’est pas disponible pour votre compte."}</CardContent></Card>
              )
            )}

            {activeTab === "fonctionnalites" && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-5" />Fonctionnalités</CardTitle><CardDescription>Activez uniquement les fonctionnalités dont votre établissement a besoin.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    ["Élèves", "Inscriptions, dossiers élèves et préinscriptions."],
                    ["Pédagogie", "Classes, matières, affectations et fournitures."],
                    ["Finance", "Paiements, frais et échéanciers."],
                    ["Services", "Cantine, transport, uniformes et autres services."],
                    ["Communication", "Notifications et communications avec les familles."],
                  ].map(([title, description]) => (
                    <div key={title} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Disponible</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {["formations","pedagogie","finance","services","utilisateurs","notifications","securite"].includes(activeTab) && (
              <Card>
                <CardHeader><CardTitle>{tabs.find((item) => item.id === activeTab)?.label}</CardTitle><CardDescription>Cette rubrique est maintenant regroupée dans Paramètres pour garder le menu principal simple.</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Nous conserverons ici uniquement les réglages nécessaires, avec des valeurs proposées automatiquement lorsque Schooly connaît déjà la règle.</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Download className="size-4" />Données et départ de Schooly</CardTitle><CardDescription>Récupérez les données de votre établissement à tout moment.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <a href="/api/school/export?format=json" download className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"><Download className="mr-2 size-4" />Télécharger l’archive</a>
                <a href="/api/school/export?format=html" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Printer className="mr-2 size-4" />Imprimer / PDF</a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Info className="size-4" />Informations du compte</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Type actuel</p><p className="font-medium">{typeLabel}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Créé le</p><p className="font-medium">{new Date(settings.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Annuaire Trouvetou</p><div className="mt-1 flex items-center gap-2"><Badge variant={settings.published_to_trouvetou ? "default" : "secondary"}>{settings.published_to_trouvetou ? "Publié" : "Non publié"}</Badge>{settings.published_to_trouvetou && <CheckCircle2 className="size-4" />}</div></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
