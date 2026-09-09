"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Clock,
  Plus,
  Warning,
} from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { useSupabaseUser } from "@/hooks/use-supabase-user"

type DisciplineIncident = {
  id: string
  type: string
  severity: string
  description: string
  student_name: string
  class_name: string
  reported_at: string
  reported_by: string
  status: string
}

export default function DisciplinePage() {
  const user = useSupabaseUser()
  const [incidents, setIncidents] = useState<DisciplineIncident[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    // Simulate loading incidents - would come from API
    const mockIncidents: DisciplineIncident[] = [
      {
        id: "1",
        type: "retard",
        severity: "mineur",
        description: "Retard de 15 minutes en cours de mathématiques",
        student_name: "Jean Dupont",
        class_name: "6ème A",
        reported_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        reported_by: "Mme. Martin",
        status: "open",
      },
      {
        id: "2",
        type: "non-respect",
        severity: "modéré",
        description: "Non-respect des consignes de silence en salle de classe",
        student_name: "Marie Laurent",
        class_name: "5ème B",
        reported_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        reported_by: "M. Dubois",
        status: "open",
      },
    ]
    setIncidents(mockIncidents)
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "mineur": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "modéré": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "grave": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="default" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En cours</Badge>
      case "resolved": return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Résolu</Badge>
      default: return <Badge variant="outline">En attente</Badge>
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discipline & Vie scolaire</h1>
          <p className="text-muted-foreground">
            Gestion des incidents, retenues et conseils de discipline.
          </p>
        </div>
        {(user?.role === "surveillance" || user?.role === "direction") && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Annuler" : "Nouvel incident"}
          </Button>
        )}
      </div>

      {/* Statistiques rapides */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{incidents.length}</p>
                <p className="text-sm text-muted-foreground">Incidents enregistrés</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{incidents.filter(i => i.status === "open").length}</p>
                <p className="text-sm text-muted-foreground">En cours de traitement</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{incidents.filter(i => i.severity === "grave").length}</p>
                <p className="text-sm text-muted-foreground">Graves</p>
              </div>
              <Warning className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire d'incident */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Signaler un incident
            </CardTitle>
            <CardDescription>Enregistrez un nouveau incident disciplinaire.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={async (formData: FormData) => {
              // Server action would go here
              setShowForm(false)
            }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="studentName">Élève</Label>
                <Input id="studentName" name="studentName" placeholder="Nom de l'élève" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="className">Classe</Label>
                <Input id="className" name="className" placeholder="Ex: 6ème A" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="incidentType">Type d'incident</Label>
                <Select id="incidentType" name="type" required>
                  <option value="retard">Retard</option>
                  <option value="non-respect">Non-respect des règles</option>
                  <option value="insulte">Insulte / Injure</option>
                  <option value="bagarre">Bagarre / Violence</option>
                  <option value="autre">Autre</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="severity">Gravité</Label>
                <Select id="severity" name="severity" required>
                  <option value="mineur">Mineur</option>
                  <option value="modere">Modéré</option>
                  <option value="grave">Grave</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="action">Action prévue</Label>
                <Select id="action" name="action">
                  <option value="verbal_avertissement">Avertissement verbal</option>
                  <option value="retenue">Retenue</option>
                  <option value="note_parente">Note parente</option>
                  <option value="conseil_discipline">Conseil de discipline</option>
                  <option value="autre">Autre</option>
                </Select>
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  className="h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Décrivez l'incident en détail..."
                  required
                />
              </div>
              <Button type="submit" className="lg:col-span-3">
                <Plus className="h-4 w-4 mr-2" />Signaler l'incident
              </Button>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {/* Liste des incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Historique des incidents
          </CardTitle>
          <CardDescription>Tous les incidents disciplinaires enregistrés.</CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Aucun incident enregistré</p>
              <p className="text-sm">
                {showForm
                  ? "Le formulaire est ouvert, remplissez-le pour signaler le premier incident."
                  : "Cliquez sur 'Nouvel incident' pour commencer."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map(incident => (
                <div
                  key={incident.id}
                  className="flex items-start justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${incident.severity === "grave" ? "bg-red-100 dark:bg-red-900/30" : incident.severity === "modere" ? "bg-orange-100 dark:bg-orange-900/30" : "bg-yellow-100 dark:bg-yellow-900/30"}`}>
                      <AlertTriangle className={`h-4 w-4 ${incident.severity === "grave" ? "text-red-500" : incident.severity === "modere" ? "text-orange-500" : "text-yellow-500"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{incident.student_name}</p>
                        {getStatusBadge(incident.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {incident.class_name} · {incident.type}
                      </p>
                      <p className="text-sm mt-1">{incident.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Par: {incident.reported_by}</span>
                        <span>·</span>
                        <span>{formatDate(incident.reported_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(incident.severity)}>
                      {incident.severity}
                    </Badge>
                    <Button size="sm" variant="outline">Voir</Button>
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
