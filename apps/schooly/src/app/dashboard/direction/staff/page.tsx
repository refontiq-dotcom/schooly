import { getStaff } from "./actions"
import { AddStaffModal } from "./staff-modals"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Power, Users, ShieldCheck } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  professeur: "Professeur / Enseignant",
  compta: "Comptabilité",
  secretariat: "Secrétariat",
  caisse: "Caisse",
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
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{ROLE_LABELS[item.role_code] ?? item.role_code}</Badge>
                    <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "Actif" : "Suspendu"}</Badge>
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
