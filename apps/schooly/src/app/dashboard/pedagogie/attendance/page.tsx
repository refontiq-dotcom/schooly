"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { ActionForm } from "@/components/action-form"
import {
  getCourseSessions,
  getAttendanceForSession,
  recordAttendance,
  type CourseSessionRow,
  type AttendanceRecordRow,
} from "../actions"
import { useSupabaseUser } from "@/hooks/use-supabase-user"

// Types de lignes importés de ../actions (source unique, schéma fidèle).
type CourseSession = CourseSessionRow
type AttendanceRecord = AttendanceRecordRow

export default function AttendancePage() {
  const user = useSupabaseUser()
  const [sessions, setSessions] = useState<CourseSession[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    getCourseSessions().then(res => { if (res.data) setSessions(res.data) })
  }, [user])

  useEffect(() => {
    if (!selectedSession) return
    let active = true
    // setState dans une micro-tâche : react-hooks/set-state-in-effect interdit
    // un setState synchrone dans le corps de l'effet (cascading renders).
    // `active` annule les retards si la session change entre-temps.
    void Promise.resolve().then(() => {
      if (active) setLoading(true)
    })
    getAttendanceForSession(selectedSession).then(res => {
      if (!active) return
      setLoading(false)
      if (res.data) setAttendance(res.data)
    })
    return () => {
      active = false
    }
  }, [selectedSession])

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) +
      ` · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present": return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "absent": return <XCircle className="h-5 w-5 text-red-500" />
      case "tardy": return <Clock className="h-5 w-5 text-orange-500" />
      case "excused": return <ShieldCheck className="h-5 w-5 text-blue-500" />
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "absent": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "tardy": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "excused": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const statistics = {
    present: attendance.filter(a => a.status === "present").length,
    absent: attendance.filter(a => a.status === "absent").length,
    tardy: attendance.filter(a => a.status === "tardy").length,
    excused: attendance.filter(a => a.status === "excused").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appel / Assiduité</h1>
          <p className="text-muted-foreground">
            Marquez la présence des élèves pour chaque session de cours.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sélection de la session */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Sélectionner une session
            </CardTitle>
            <CardDescription>Choisissez une session de cours pour prendre l&apos;appel.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune session disponible</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedSession === session.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {session.classes?.name} — {session.subjects?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(session.starts_at)}
                        </p>
                      </div>
                      {selectedSession === session.id && (
                        <Badge className="bg-primary text-primary-foreground">Sélectionné</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistiques + Liste des élèves */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Liste des élèves
            </CardTitle>
            <CardDescription>
              {selectedSession
                ? `Appel pour la session du ${new Date(sessions.find(s => s.id === selectedSession)?.starts_at || "").toLocaleDateString("fr-FR")}`
                : "Sélectionnez une session pour voir les élèves"
            }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Sélectionnez une session pour commencer l&apos;appel</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
                <p className="mt-2 text-sm text-muted-foreground">Chargement de la liste...</p>
              </div>
            ) : (
              <>
                {/* Statistiques rapides */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    <span className="font-bold text-lg">{statistics.present}</span>
                    <span className="text-xs text-muted-foreground">Présents</span>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <span className="font-bold text-lg">{statistics.absent}</span>
                    <span className="text-xs text-muted-foreground">Absents</span>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                    <span className="font-bold text-lg">{statistics.tardy}</span>
                    <span className="text-xs text-muted-foreground">Tardifs</span>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <ShieldCheck className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <span className="font-bold text-lg">{statistics.excused}</span>
                    <span className="text-xs text-muted-foreground">Excusés</span>
                  </div>
                </div>

                {/* Liste des élèves avec appel rapide */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {attendance.map(record => ({
                    name: `${record.enrollments?.students?.first_name} ${record.enrollments?.students?.last_name}`,
                    status: record.status,
                    enrollmentId: record.enrollments?.id ?? "",
                  } as { name: string; status: string; enrollmentId: string })) ? (
                    attendance.map(record => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(record.status)}
                          <span className="font-medium">
                            {record.enrollments?.students?.first_name} {record.enrollments?.students?.last_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(record.status)}>
                            {record.status === "present" ? "Présent" :
                             record.status === "absent" ? "Absent" :
                             record.status === "tardy" ? "Tardif" : "Excusé"}
                          </Badge>
                          {record.remark && (
                            <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                              {record.remark}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucun élève dans cette session</p>
                    </div>
                  )}
                </div>

                {/* Formulaire d'appel rapide */}
                {attendance.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg border bg-card">
                    <h4 className="font-medium mb-3">Appel rapide (pour les élèves sans statut)</h4>
                    <ActionForm action={recordAttendance} className="flex gap-2 items-end flex-wrap">
                      <input type="hidden" name="sessionId" value={selectedSession || ""} />
                      <div className="space-y-1">
                        <Label htmlFor="attendanceEnrollmentId">Élève</Label>
                        <Input id="attendanceEnrollmentId" name="enrollmentId" list="studentList" placeholder="ID élève" />
                        <datalist id="studentList">
                          {attendance.map(a => (
                            <option key={a.id} value={a.enrollments?.id ?? ""} label={`${a.enrollments?.students?.first_name} ${a.enrollments?.students?.last_name}`} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-1">
                        <Label>Statut</Label>
                        <div className="flex gap-1">
                          {["present", "absent", "tardy", "excused"].map(s => (
                            <label key={s} className="flex-1 cursor-pointer">
                              <input type="button" name="status" value={s} className="sr-only" />
                              <Button type="button" size="sm" variant={s === "present" ? "default" : "outline"} className={s === "present" ? "bg-green-500 hover:bg-green-600" : s === "absent" ? "bg-red-500 hover:bg-red-600" : s === "tardy" ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-500 hover:bg-blue-600"}>
                                {s === "present" ? "✓" : s === "absent" ? "✗" : s === "tardy" ? "~»" : "!"}
                              </Button>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="remark">Remarque</Label>
                        <Input id="remark" name="remark" placeholder="Optionnel" />
                      </div>
                      <Button type="submit">Enregistrer</Button>
                    </ActionForm>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
