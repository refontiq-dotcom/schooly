"use client"

import { useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ActionForm } from "@/components/action-form"
import {
  getDormitories,
  getBoardingSubscriptions,
  getEnrollmentsForSelect,
  createDormitory,
  createDormRoom,
  createBoardingSubscription,
} from "../actions"
import { Building2, Plus, Users, BedDouble } from "lucide-react"

function fmtCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}

const GENDER_LABELS: Record<string, string> = {
  male: "Garçons",
  female: "Filles",
  mixed: "Mixte",
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
}

export default function InternatPage() {
  const [dormitories, setDormitories] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [showDormForm, setShowDormForm] = useState(false)
  const [showRoomForm, setShowRoomForm] = useState<string | null>(null)
  const [showSubForm, setShowSubForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      const [dormsRes, subsRes, enrollRes] = await Promise.all([
        getDormitories(),
        getBoardingSubscriptions(),
        getEnrollmentsForSelect(),
      ])
      if ("data" in dormsRes) setDormitories(dormsRes.data as any[])
      if ("data" in subsRes) setSubs(subsRes.data as any[])
      if ("data" in enrollRes) setEnrollments(enrollRes.data as any[])
    })
  }

  useEffect(() => { load() }, [])

  const allRooms = dormitories.flatMap(d =>
    (d.dorm_rooms || []).map((r: any) => ({ ...r, dormitory_name: d.name }))
  )

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
              <p className="text-3xl font-bold">{allRooms.length}</p>
              <p className="text-sm text-muted-foreground">Chambres</p>
            </div>
            <BedDouble className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{subs.filter(s => s.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Internes actifs</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
      </div>

      {/* Dortoirs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Dortoirs & Chambres
            </CardTitle>
            <CardDescription>Organisez les hébergements de l'internat.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowDormForm(f => !f)}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau dortoir
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDormForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => { const r = await createDormitory(fd); if (r && !r.ok) return r as any; load(); setShowDormForm(false) }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label htmlFor="dorm-name">Nom du dortoir *</Label>
                  <Input id="dorm-name" name="name" placeholder="Ex. Pavillon Nord" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dorm-gender">Genre</Label>
                  <select
                    id="dorm-gender"
                    name="gender_restriction"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="mixed"
                  >
                    <option value="mixed">Mixte</option>
                    <option value="male">Garçons</option>
                    <option value="female">Filles</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dorm-cap">Capacité totale *</Label>
                  <Input id="dorm-cap" name="capacity" type="number" min="1" placeholder="60" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dorm-super">Responsable</Label>
                  <Input id="dorm-super" name="supervisor_name" placeholder="M. Kouamé" />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDormForm(false)}>Annuler</Button>
                  <Button type="submit" size="sm">Créer le dortoir</Button>
                </div>
              </ActionForm>
            </div>
          )}

          {dormitories.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun dortoir configuré.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dormitories.map(dorm => (
                <div key={dorm.id} className="rounded-lg border">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{dorm.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {GENDER_LABELS[dorm.gender_restriction]} · {dorm.capacity} places
                          {dorm.supervisor_name && ` · ${dorm.supervisor_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{dorm.dorm_rooms?.length ?? 0} chambre(s)</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRoomForm(showRoomForm === dorm.id ? null : dorm.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Chambre
                      </Button>
                    </div>
                  </div>

                  {showRoomForm === dorm.id && (
                    <div className="border-t p-3 bg-muted/30">
                      <ActionForm
                        action={async (fd) => {
                          fd.set("dormitory_id", dorm.id)
                          const r = await createDormRoom(fd)
                          if (r && !r.ok) return r as any
                          load()
                          setShowRoomForm(null)
                        }}
                        className="flex items-end gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <Label htmlFor={`room-num-${dorm.id}`}>N° de chambre</Label>
                          <Input id={`room-num-${dorm.id}`} name="room_number" placeholder="101" required />
                        </div>
                        <div className="space-y-1 flex-1">
                          <Label htmlFor={`room-cap-${dorm.id}`}>Lits</Label>
                          <Input id={`room-cap-${dorm.id}`} name="capacity" type="number" min="1" placeholder="4" required />
                        </div>
                        <Button type="submit" size="sm">Ajouter</Button>
                      </ActionForm>
                    </div>
                  )}

                  {dorm.dorm_rooms?.length > 0 && (
                    <div className="border-t p-3 flex flex-wrap gap-2">
                      {dorm.dorm_rooms.map((room: any) => (
                        <div key={room.id} className="rounded border px-2 py-1 text-xs flex items-center gap-1">
                          <BedDouble className="h-3 w-3 text-muted-foreground" />
                          Ch. {room.room_number} ({room.capacity} lits)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affectations élèves */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Élèves internes
            </CardTitle>
            <CardDescription>Gérez les affectations des élèves dans les chambres.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowSubForm(f => !f)} disabled={dormitories.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Affecter un élève
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSubForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => { const r = await createBoardingSubscription(fd); if (r && !r.ok) return r as any; load(); setShowSubForm(false) }}
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
                    {enrollments.map((e: any) => (
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
                    {allRooms.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.dormitory_name} — Ch. {r.room_number} ({r.capacity} lits)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="board-amount">Frais d'internat (FCFA)</Label>
                  <Input id="board-amount" name="amount_cfa" type="number" min="0" placeholder="50000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="board-start">Date d'entrée *</Label>
                  <Input id="board-start" name="start_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSubForm(false)}>Annuler</Button>
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
                  {subs.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">
                        {s.enrollments?.students?.last_name} {s.enrollments?.students?.first_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {s.enrollments?.classes?.name}
                        </span>
                      </td>
                      <td className="py-2">
                        {s.dorm_rooms
                          ? `${(s.dorm_rooms as any).dormitories?.name} — Ch. ${(s.dorm_rooms as any).room_number}`
                          : "—"
                        }
                      </td>
                      <td className="py-2">{fmtCFA(s.amount_cfa)}</td>
                      <td className="py-2">{new Date(s.start_date).toLocaleDateString("fr-FR")}</td>
                      <td className="py-2">
                        <Badge variant={STATUS_LABELS[s.status]?.variant ?? "outline"}>
                          {STATUS_LABELS[s.status]?.label ?? s.status}
                        </Badge>
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
