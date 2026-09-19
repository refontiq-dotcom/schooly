import { getStaff, setStaffRoleActive } from "./actions"
import { AddStaffModal } from "./staff-modals"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { ElementType } from "react"
import { Power, Users, ShieldCheck, ArrowRight, KeyRound, UserCog, GraduationCap, WalletCards, ClipboardList, Eye, BookOpen } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  professeur: "Professeur / Enseignant",
  compta: "Comptabilité",
  secretariat: "Secrétariat",
  caisse: "Caisse",
  informatique: "Informatique / Administration Schooly",
  surveillance: "Surveillance",
  direction: "Direction",
  super_admin: "Super Admin",
}

export default async function StaffPage() {
  const result = await getStaff()
  const staff = Array.isArray(result.data) ? result.data as any[] : []

  const groups = staff.reduce<Record<string, any[]>>((acc, item) => {
    const key = item.role_code
    ;(acc[key] ??= []).push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Administration du personnel</p>
          <h1 className="text-3xl font-semibold tracking-tight">Personnel & rôles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque membre reçoit uniquement l'espace de travail correspondant à sa fonction.
          </p>
        </div>
        <AddStaffModal />
      </div>

      {result.error && (
        <Card><CardContent className="pt-6 text-sm text-destructive">{result.error}</CardContent></Card>
      )}

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Centre de pilotage du personnel</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Ici, le Directeur définit qui travaille dans l'établissement. Le rôle choisi détermine automatiquement
              l'espace de travail et les accès. Les affectations pédagogiques se règlent ensuite dans la structure académique.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
            <KeyRound className="h-4 w-4 text-primary" />
            <span>Accès pilotés par Schooly</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Membres actifs</CardDescription><CardTitle>{staff.filter((s) => s.is_active).length}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Fonctions</CardDescription><CardTitle>{Object.keys(groups).length}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Accès Schooly</CardDescription><CardTitle><ShieldCheck className="inline h-5 w-5 mr-1" /> Séparés par rôle</CardTitle></CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rôles et accès</CardTitle>
          <CardDescription>Le Directeur n'a pas à configurer chaque permission une par une : Schooly applique le socle d'accès adapté à chaque fonction.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["professeur", "Professeur / Enseignant", "Cours, appel, notes", BookOpen],
            ["compta", "Comptabilité", "Finance, relances, rapports", WalletCards],
            ["secretariat", "Secrétariat", "Inscriptions, structure, services", ClipboardList],
            ["informatique", "Informatique", "Configuration, paramétrage, rapports", KeyRound],
            ["caisse", "Caisse", "Encaissements et clôture", WalletCards],
            ["surveillance", "Surveillance", "Vie scolaire et accès", Eye],
            ["direction", "Direction", "Pilotage global de l'établissement", UserCog],
          ] as Array<[string, string, string, ElementType]>).map(([code, label, summary, Icon]) => {
            const count = staff.filter((s) => s.role_code === code && s.is_active).length
            return (
              <div key={String(code)} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <p className="font-medium">{String(label)}</p>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{String(summary)}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Équipe de l'établissement</CardTitle>
          <CardDescription>Les rôles actifs déterminent le dashboard et les actions accessibles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {staff.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Aucun membre du personnel</p>
              <p className="mt-1 text-sm text-muted-foreground">Ajoutez le premier membre pour lui donner son accès Schooly.</p>
            </div>
          ) : staff.map((item) => {
            const user = Array.isArray(item.users) ? item.users[0] : item.users
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{user?.full_name ?? "Utilisateur"}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email ?? "Email non renseigné"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{ROLE_LABELS[item.role_code] ?? item.role_code}</Badge>
                    <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "Actif" : "Suspendu"}</Badge>
                    <Badge variant={user?.is_activated ? "secondary" : "outline"}>
                      {user?.is_activated ? "Compte activé" : "Activation en attente"}
                    </Badge>
                    {item.role_code === "professeur" && (
                      <Link
                        href="/dashboard/academic-structure?tab=matrix"
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <GraduationCap className="h-3.5 w-3.5" />
                        Affectations
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
                <form action={setStaffRoleActive}>
                  <input type="hidden" name="roleId" value={item.id} />
                  <input type="hidden" name="isActive" value={String(!item.is_active)} />
                  <Button type="submit" variant="outline" size="sm">
                    <Power className="mr-2 h-4 w-4" />
                    {item.is_active ? "Suspendre" : "Réactiver"}
                  </Button>
                </form>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
