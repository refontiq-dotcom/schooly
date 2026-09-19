"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FileSpreadsheet, GripVertical, Loader2, Upload, WandSparkles, XCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  commitAdmissionAssignment,
  getAdmissionImportBatches,
  importAdmissionsList,
  previewAdmissionAssignment,
  saveAdmissionAssignmentPreview,
} from "@/app/dashboard/admissions/intake-actions"

type Year = { id: string; label: string; is_current?: boolean }
type Level = { id: string; name: string; level?: number; cycle?: string | null }
type Batch = {
  id: string; filename: string; status: string; total_rows: number; valid_rows: number; error_rows: number;
  created_at: string; academic_years?: { label: string }[] | null
}
type PreviewRow = {
  id: string
  import_row_id: string
  position: number
  class_id: string | null
  hard_valid: boolean
  constraint_reason: string | null
  student?: { id: string; first_name: string; last_name: string; gender?: string | null; grade_name?: string | null }
  class?: { id: string; name: string; capacity?: number | null } | null
}

export default function IntakeClient({
  schoolId, academicYears, gradeLevels,
}: { schoolId: string; academicYears: Year[]; gradeLevels: Level[] }) {
  const currentYear = academicYears.find((y) => y.is_current) ?? academicYears[0]
  const [yearId, setYearId] = useState(currentYear?.id ?? "")
  const [batches, setBatches] = useState<Batch[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [previewBatchId, setPreviewBatchId] = useState("")
  const [previewLevelId, setPreviewLevelId] = useState("")
  const [loading, setLoading] = useState(false)
  const [dragged, setDragged] = useState<number | null>(null)

  async function refresh() {
    if (!schoolId) return
    const result = await getAdmissionImportBatches(schoolId)
    if (result.data) setBatches(result.data as Batch[])
  }

  useEffect(() => { refresh() }, [schoolId])

  async function handleImport(formData: FormData) {
    formData.set("schoolId", schoolId)
    formData.set("academicYearId", yearId)
    setLoading(true)
    const result = await importAdmissionsList(formData)
    setLoading(false)
    if (result.error) { toast.error(result.error); return }
    toast.success(`Import terminé : ${result.data?.valid ?? 0} ligne(s) exploitable(s).`)
    setImportOpen(false)
    await refresh()
  }

  async function openAssignment(batch: Batch) {
    setPreviewBatchId(batch.id)
    setPreview([])
    setAssignmentOpen(true)
  }

  async function generatePreview() {
    if (!previewBatchId || !previewLevelId || !yearId) return
    setLoading(true)
    const result = await previewAdmissionAssignment(schoolId, yearId, previewBatchId, previewLevelId)
    setLoading(false)
    if (result.error) return toast.error(result.error)
    setPreview((result.data?.rows ?? []) as PreviewRow[])
    toast.success(`Prévisualisation générée : ${result.data?.assigned ?? 0} affecté(s).`)
  }

  const validCount = preview.filter((r) => r.hard_valid).length
  const invalidCount = preview.length - validCount

  function moveRow(from: number, to: number) {
    if (to < 0 || to >= preview.length || from === to) return
    const next = [...preview]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setPreview(next.map((r, i) => ({ ...r, position: i + 1 })))
  }

  async function saveAndCommit() {
    if (!preview.length || invalidCount > 0) return toast.error("Corrigez les élèves sans classe avant de valider.")
    setLoading(true)
    const save = await saveAdmissionAssignmentPreview(
      schoolId,
      previewBatchId,
      preview.map((r) => ({ id: r.id, classId: r.class_id, position: r.position })),
    )
    if (save.error) {
      setLoading(false)
      return toast.error(save.error)
    }
    const result = await commitAdmissionAssignment(schoolId, previewBatchId)
    setLoading(false)
    if (result.error) return toast.error(result.error)
    toast.success(`${result.data?.assigned_rows ?? validCount} affectation(s) validée(s).`)
    setAssignmentOpen(false)
    setPreview([])
    await refresh()
  }

  const batchActions = useMemo(() => batches.filter((b) => b.valid_rows > 0), [batches])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3 gap-2">
            <Link href="/dashboard/direction/admissions"><ArrowLeft className="h-4 w-4" />Admissions</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Affectations Ministère</h1>
          <p className="text-sm text-muted-foreground">
            Importez la liste officielle, contrôlez les données puis répartissez automatiquement les élèves dans les classes.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={yearId} onValueChange={setYearId}>
            <SelectTrigger className="min-h-11 w-[190px]"><SelectValue placeholder="Année scolaire" /></SelectTrigger>
            <SelectContent>{academicYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.label}{y.is_current ? " · actuelle" : ""}</SelectItem>)}</SelectContent>
          </Select>
          <Button className="min-h-11 gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />Importer CSV / Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><WandSparkles className="h-5 w-5" />Affectation intelligente</CardTitle>
          <CardDescription>
            L'algorithme respecte d'abord la capacité et les options obligatoires, puis cherche une répartition équilibrée des profils avant de distribuer en serpentin.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4"><p className="text-2xl font-bold">{batches.length}</p><p className="text-sm text-muted-foreground">Imports récents</p></div>
          <div className="rounded-xl border p-4"><p className="text-2xl font-bold">{batches.reduce((n, b) => n + b.valid_rows, 0)}</p><p className="text-sm text-muted-foreground">Lignes exploitables</p></div>
          <div className="rounded-xl border p-4"><p className="text-2xl font-bold">{batches.reduce((n, b) => n + b.error_rows, 0)}</p><p className="text-sm text-muted-foreground">Lignes à corriger</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {batches.map((batch) => (
          <Card key={batch.id}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border p-3"><FileSpreadsheet className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">{batch.filename}</p>
                  <p className="text-sm text-muted-foreground">{batch.academic_years?.[0]?.label ?? "Année inconnue"} · {new Date(batch.created_at).toLocaleString("fr-FR")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{batch.valid_rows} valides</Badge>
                    {batch.error_rows > 0 && <Badge variant="destructive">{batch.error_rows} erreurs</Badge>}
                    <Badge variant="outline">{batch.total_rows} lignes</Badge>
                  </div>
                </div>
              </div>
              <Button disabled={batch.valid_rows === 0} className="min-h-11 gap-2" onClick={() => openAssignment(batch)}>
                <WandSparkles className="h-4 w-4" />Préparer l'affectation
              </Button>
            </CardContent>
          </Card>
        ))}
        {!batches.length && (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Aucun import. Commencez par importer la liste officielle du Ministère.</CardContent></Card>
        )}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen} className="max-w-lg">
        <DialogClose onClick={() => setImportOpen(false)} />
        <DialogHeader>
          <DialogTitle>Importer une liste officielle</DialogTitle>
          <DialogDescription>CSV, XLSX ou XLS · 10 Mo maximum. Les colonnes peuvent être nommées « Nom », « Prénom », « Date de naissance », « Sexe », « Niveau », « Matricule », « N° orientation », « Options ».</DialogDescription>
        </DialogHeader>
        <form action={handleImport} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ministry-file">Fichier</Label>
            <Input id="ministry-file" name="file" type="file" accept=".csv,.xlsx,.xls,text/csv" required disabled={loading} />
          </div>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Contrôle automatique</p>
            <p className="text-muted-foreground mt-1">Schooly reconnaît les variantes de noms de colonnes, associe les niveaux existants et isole les lignes invalides sans les mélanger aux données valides.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Importer</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen} className="max-w-5xl">
        <DialogClose onClick={() => setAssignmentOpen(false)} />
        <DialogHeader>
          <DialogTitle>Prévisualiser l'affectation</DialogTitle>
          <DialogDescription>Choisissez le niveau, laissez Schooly répartir les élèves, puis déplacez les lignes par glisser-déposer avant validation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select value={previewLevelId} onValueChange={setPreviewLevelId}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Niveau à affecter" /></SelectTrigger>
              <SelectContent>{gradeLevels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="min-h-11 gap-2" onClick={generatePreview} disabled={loading || !previewLevelId}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Calculer
            </Button>
          </div>

          {preview.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />{validCount} affectés</Badge>
                {invalidCount > 0 && <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />{invalidCount} sans place</Badge>}
              </div>
              <div className="max-h-[55vh] overflow-auto rounded-xl border">
                {preview.map((row, index) => (
                  <div
                    key={row.id}
                    draggable
                    onDragStart={() => setDragged(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragged !== null) moveRow(dragged, index); setDragged(null) }}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b p-3 last:border-b-0"
                  >
                    <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" />
                    <div>
                      <p className="font-medium">{row.student?.last_name} {row.student?.first_name}</p>
                      <p className="text-xs text-muted-foreground">Position {row.position} · {row.student?.gender ?? "Sexe non renseigné"}</p>
                      {row.constraint_reason && <p className="text-xs text-destructive">{row.constraint_reason}</p>}
                    </div>
                    <Badge variant={row.hard_valid ? "outline" : "destructive"}>{row.class?.name ?? "Aucune classe"}</Badge>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                Le glisser-déposer modifie l'ordre de répartition. Les contraintes de capacité et d'options restent bloquantes lors de la validation.
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Fermer</Button>
          {preview.length > 0 && <Button type="button" disabled={loading || invalidCount > 0} onClick={saveAndCommit}>Valider les affectations</Button>}
        </DialogFooter>
      </Dialog>
    </div>
  )
}
