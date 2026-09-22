import { useState } from "react"
import { BedDouble, Building2, Plus } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { asActionResult, isActionOk, type Dormitory } from "../../_lib/types"

const GENDER_LABELS: Record<string, string> = {
  male: "Garçons",
  female: "Filles",
  mixed: "Mixte",
}

type DormitoriesSectionProps = {
  dormitories: Dormitory[]
  onCreateDormitory: (formData: FormData) => Promise<unknown>
  onCreateRoom: (formData: FormData) => Promise<unknown>
}

/** Carte « Dortoirs & Chambres » : liste des dortoirs, création dortoir + chambre. */
export function DormitoriesSection({
  dormitories,
  onCreateDormitory,
  onCreateRoom,
}: DormitoriesSectionProps) {
  const [showDormForm, setShowDormForm] = useState(false)
  const [roomFormFor, setRoomFormFor] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Dortoirs &amp; Chambres
          </CardTitle>
          <CardDescription>Organisez les hébergements de l&apos;internat.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowDormForm((f) => !f)}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau dortoir
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showDormForm && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <ActionForm
              action={async (formData) => {
                const result = await onCreateDormitory(formData)
                if (!isActionOk(asActionResult(result))) return asActionResult(result)
                setShowDormForm(false)
              }}
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
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDormForm(false)}>
                  Annuler
                </Button>
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
            {dormitories.map((dorm) => (
              <div key={dorm.id} className="rounded-lg border">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{dorm.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {GENDER_LABELS[dorm.gender_restriction] ?? dorm.gender_restriction} · {dorm.capacity} places
                        {dorm.supervisor_name && ` · ${dorm.supervisor_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{dorm.dorm_rooms?.length ?? 0} chambre(s)</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRoomFormFor(roomFormFor === dorm.id ? null : dorm.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Chambre
                    </Button>
                  </div>
                </div>

                {roomFormFor === dorm.id && (
                  <div className="border-t p-3 bg-muted/30">
                    <ActionForm
                      action={async (formData) => {
                        formData.set("dormitory_id", dorm.id)
                        const result = await onCreateRoom(formData)
                        if (!isActionOk(asActionResult(result))) return asActionResult(result)
                        setRoomFormFor(null)
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

                {(dorm.dorm_rooms?.length ?? 0) > 0 && (
                  <div className="border-t p-3 flex flex-wrap gap-2">
                    {dorm.dorm_rooms!.map((room) => (
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
  )
}
