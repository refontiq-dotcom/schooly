"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarIcon, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { getAcademicYears, createAcademicYear } from "@/app/dashboard/academic-structure/actions"

type AcademicYear = {
  id: string
  label: string
  start_date: string
  end_date: string
  status: string
}

const COOKIE_NAME = "active_academic_year_id"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Calcule la fenêtre de l'année scolaire : Septembre N → Juillet N+1.
 * Retourne les bornes ISO et le label « AAAA-AAAA ».
 */
export function computeAcademicWindow(now: Date = new Date()) {
  const startYear = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    label: `${startYear}-${startYear + 1}`,
    start_date: `${startYear}-09-01`,
    end_date: `${startYear + 1}-07-15`,
  }
}

export function AcademicYearSelector({ schoolId }: { schoolId?: string | null }) {
  const router = useRouter()
  const [years, setYears] = useState<AcademicYear[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const fetchedSchoolId = useRef<string | null>(null)

  const load = useCallback(async () => {
    const res = await getAcademicYears()
    if (res.error || !res.data) return []
    setYears(res.data as AcademicYear[])
    return res.data as AcademicYear[]
  }, [])

  useEffect(() => {
    if (!schoolId || fetchedSchoolId.current === schoolId) return
    fetchedSchoolId.current = schoolId
    setLoading(true)
    load()
      .then((data) => {
        const active = data.find((y) => y.status === "en_cours")
        const stored = document.cookie
          .split("; ")
          .find((c) => c.startsWith(`${COOKIE_NAME}=`))
          ?.split("=")[1]
        const remembered = data.find((y) => y.id === stored)
        setSelectedId(remembered?.id ?? active?.id ?? "")
      })
      .finally(() => setLoading(false))
  }, [schoolId, load])

  const persistCookie = (yearId: string) => {
    document.cookie = `${COOKIE_NAME}=${yearId}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
  }

  /**
   * Changer d'année ici = changer le CONTEXTE DE LECTURE (cookie), jamais
   * activer/clôturer en base. L'activation réelle reste le bouton « Activer »
   * de l'onglet Années (RPC atomique). Un clic header clôturait N à tort.
   */
  function handleChange(yearId: string) {
    if (yearId === selectedId) return
    setSelectedId(yearId)
    persistCookie(yearId)
    toast.success("Année affichée")
    router.refresh()
  }

  /** Crée l'année scolaire courante (Sept N → Juil N+1) et la pose en contexte de lecture. */
  async function handleCreateCurrent() {
    const win = computeAcademicWindow()
    setCreating(true)
    try {
      const fd = new FormData()
      fd.set("label", win.label)
      fd.set("startDate", win.start_date)
      fd.set("endDate", win.end_date)
      const res = await createAcademicYear(fd)
      if (res?.error) {
        // Année déjà existante (ex: créée via Structure académique) → on la sélectionne.
        const data = await load()
        const existing = data.find((y) => y.label === win.label)
        if (!existing) {
          toast.error(res.error)
          return
        }
        handleChange(existing.id)
      } else {
        const data = await load()
        const created = data.find((y) => y.label === win.label)
        if (created) handleChange(created.id)
      }
    } finally {
      setCreating(false)
    }
  }

  const activeYear = years.find((y) => y.id === selectedId)

  if (!schoolId) return null

  // Aucune année en base : proposition intelligente de création de l'année courante.
  if (years.length === 0) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      )
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2"
        disabled={creating}
        onClick={handleCreateCurrent}
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Créer {computeAcademicWindow().label}
      </Button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <CalendarIcon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      <label htmlFor="academic-year" className="sr-only">Année académique affichée</label>
      <Select
        value={selectedId}
        onValueChange={handleChange}
        disabled={loading || creating}
      >
        <SelectTrigger id="academic-year" ariaLabel="Année académique affichée" className="h-10 w-[168px] text-base sm:w-[200px]">
          {/* Le SelectValue maison rend la valeur brute (uuid) : on affiche le label. */}
          <span className={selectedId ? "" : "text-muted-foreground"}>
            {activeYear?.label ?? "Année académique"}
          </span>
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year.id} value={year.id}>
              <div className="flex items-center gap-2">
                <span>{year.label}</span>
                {year.status === "en_cours" && (
                  <span className="text-[10px] px-1 rounded bg-primary text-primary-foreground">Active</span>
                )}
                {year.status === "cloturee" && (
                  <span className="text-[10px] px-1 rounded border text-muted-foreground">Clôturée</span>
                )}
                {year.status === "planifiee" && (
                  <span className="text-[10px] px-1 rounded bg-secondary text-secondary-foreground">Planifiée</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeYear && (
        <span className="hidden text-xs text-muted-foreground xl:inline">
          {activeYear.start_date ? `${activeYear.start_date.slice(8, 10)}/${activeYear.start_date.slice(5, 7)}/${activeYear.start_date.slice(0, 4)} → ${activeYear.end_date.slice(8, 10)}/${activeYear.end_date.slice(5, 7)}/${activeYear.end_date.slice(0, 4)}` : ""}
        </span>
      )}
    </div>
  )
}
