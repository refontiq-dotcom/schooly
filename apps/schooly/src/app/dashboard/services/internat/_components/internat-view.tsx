import { useState } from "react"
import { BedDouble, Building2, Plus, Users } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "../../_components/status-badge"
import { fmtCFA } from "../../_lib/format"
import { asActionResult, isActionOk, type Dormitory, type EnrollmentOption, type ServiceSub } from "../../_lib/types"
import { DormitoriesSection } from "./dormitories-section"

/** Libellé « Dortoir — Ch. N » d'un abonnement, ou tiret si non affecté. */
export function subRoomLabel(sub: ServiceSub): string {
  if (!sub.dorm_rooms) return "—"
  const dormName = sub.dorm_rooms.dormitories?.name ?? null
  return dormName
    ? `${dormName} — Ch. ${sub.dorm_rooms.room_number}`
    : `Ch. ${sub.dorm_rooms.room_number}`
}

type InternatViewProps = {
  dormitories: Dormitory[]
  subs: ServiceSub[]
  enrollments: EnrollmentOption[]
  onCreateDormitory: (formData: FormData) => Promise<unknown>
  onCreateRoom: (formData: FormData) => Promise<unknown>
  onCreateSub: (formData: FormData) => Promise<unknown>
}

export function InternatView({
  dormitories,
  subs,
  enrollments,
  onCreateDormitory,
  onCreateRoom,
  onCreateSub,
}: InternatViewProps) {
  const [showSubForm, setShowSubForm] = useState(false)

  const activeCount = subs.filter((s) => s.status === "active").length
  const roomCount = dormitories.reduce((acc, d) => acc + (d.dorm_rooms?.length ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{dormitories.length}</p>
              <p className="text-sm text-muted-foreground">Dortoirs</p>
            </div>
            <Building2 className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{roomCount}</p>
              <p className="text-sm text-muted-foreground">Chambres</p>
            </div>
            <BedDouble className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Internes actifs</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
      </div>

      <DormitoriesSection
        dormitories={dormitories}
        onCreateDormitory={onCreateDormitory}
        onCreateRoom={onCreateRoom}
      />

      {/* Affectations élèves */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Élèves internes
            </CardTitle>
            <CardDescription>Gérez les affectations des élèves dans les chambres.</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowSubForm((f) => !f)}
            disabled={dormitories.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" /> Affecter un élève
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSubForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (formData) => {
                  const result = await onCreateSub(formData)
                  if (!isActionOk(asActionResult(result))) return asActionResult(result)
                  setShowSubForm(false)
                }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label htmlFor="board-enrollment">Élève *</Label>
                  <select
                    id="board-enrollment"
                    name="enrollment_id"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner un élève</option>
                    {enrollments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.students?.last_name} {e.students?.first_name} — {e.classes?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="board-room">Chambre</Label>
                  <select
                    id="board-room"
                    name="room_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sans chambre spécifique</option>
                    {dormitories.flatMap((d) =>
                      (d.dorm_rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {d.name} — Ch. {r.room_number} ({r.capacity} lits)
                        </option>
                      )),
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="board-amount">Frais d&apos;internat (FCFA)</Label>
                  <Input id="board-amount" name="amount_cfa" type="number" min="0" placeholder="50000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="board-start">Date d&apos;entrée *</Label>
                  <Input id="board-start" name="start_date" type="date" required />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSubForm(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" size="sm">Affecter</Button>
                </div>
              </ActionForm>
            </div>
          )}

          {subs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun élève interne enregistré.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 font-medium">Élève</th>
                    <th className="text-left py-2 font-medium">Chambre</th>
                    <th className="text-left py-2 font-medium">Frais</th>
                    <th className="text-left py-2 font-medium">Depuis</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">
                        {sub.enrollments?.students?.last_name} {sub.enrollments?.students?.first_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {sub.enrollments?.classes?.name}
                        </span>
                      </td>
                      <td className="py-2">{subRoomLabel(sub)}</td>
                      <td className="py-2">{fmtCFA(sub.amount_cfa ?? 0)}</td>
                      <td className="py-2">{new Date(sub.start_date).toLocaleDateString("fr-FR")}</td>
                      <td className="py-2">
                        <StatusBadge status={sub.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
