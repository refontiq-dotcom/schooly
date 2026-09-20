import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionForm } from "@/components/action-form"
import { InviteStaffForm } from "./invite-form"
import { getStaffMembers, setStaffActive, updateStaffRole } from "./actions"
import { STAFF_ROLE_CODES, STAFF_ROLE_LABELS, type StaffMember } from "./staff-roles"

export const dynamic = "force-dynamic"

function RoleSelect({ member }: { member: StaffMember }) {
  return (
    <ActionForm action={updateStaffRole} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={member.id} />
      <select
        name="roleCode"
        defaultValue={member.role_code}
        className="h-10 rounded-md border border-input bg-background px-2 text-base text-foreground"
      >
        {STAFF_ROLE_CODES.map((code) => (
          <option key={code} value={code}>
            {STAFF_ROLE_LABELS[code]}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        Enregistrer
      </Button>
    </ActionForm>
  )
}

export default async function StaffPage() {
  const res = await getStaffMembers()
  const members = res.data ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personnel & rôles</h1>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            Invitez le staff de l&apos;établissement et attribuez un rôle d&apos;accès.
          </p>
        </div>
        <InviteStaffForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Équipe</CardTitle>
          <CardDescription>
            {members.length} membre{members.length > 1 ? "s" : ""} rattaché
            {members.length > 1 ? "s" : ""} à l&apos;établissement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {res.error ? (
            <p role="alert" className="text-base text-destructive">{res.error}</p>
          ) : members.length === 0 ? (
            <p className="text-base text-muted-foreground">Aucun membre pour le moment.</p>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-semibold text-foreground">{member.full_name}</p>
                    <p className="truncate text-base text-muted-foreground">
                      {[member.email, member.phone].filter(Boolean).join(" · ") || "Sans contact"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={member.is_active ? "default" : "secondary"}>
                      {member.is_active ? "Actif" : "Inactif"}
                    </Badge>
                    <RoleSelect member={member} />
                    <ActionForm action={setStaffActive}>
                      <input type="hidden" name="membershipId" value={member.id} />
                      <input type="hidden" name="isActive" value={member.is_active ? "false" : "true"} />
                      <Button type="submit" variant="ghost" size="sm">
                        {member.is_active ? "Désactiver" : "Réactiver"}
                      </Button>
                    </ActionForm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
