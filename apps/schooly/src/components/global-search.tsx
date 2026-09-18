"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Clock, FileText, GraduationCap, Loader2, Search, Users, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getDirectorySnapshot } from "@/app/dashboard/admissions/actions"
import {
  buildSearchHits,
  SEARCH_KIND_LABELS,
  type DirectorySnapshot,
  type SearchHit,
  type SearchKind,
} from "@/lib/directory-index"

const KIND_ICON: Record<SearchKind, typeof GraduationCap> = {
  student: GraduationCap,
  guardian: Users,
  "pre-enrollment": Clock,
  enrollment: FileText,
  teacher: GraduationCap,
}

const EMPTY_SNAPSHOT: DirectorySnapshot = {
  students: [],
  guardians: [],
  enrollments: [],
  preEnrollments: [],
  teachers: [],
}

export function GlobalSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [snapshot, setSnapshot] = useState<DirectorySnapshot>(EMPTY_SNAPSHOT)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    if (loaded.current) return
    loaded.current = true
    setLoading(true)
    const res = await getDirectorySnapshot()
    if (res.data) setSnapshot(res.data as DirectorySnapshot)
    setLoading(false)
  }, [])

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
        void load()
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [load])

  useEffect(() => {
    function onPointer(e: globalThis.MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    return () => document.removeEventListener("mousedown", onPointer)
  }, [])

  const hits = useMemo(() => buildSearchHits(snapshot, query), [query, snapshot])

  useEffect(() => {
    setActive(0)
  }, [query])

  function go(hit: SearchHit) {
    const url = `${hit.href}&q=${encodeURIComponent(query.trim())}`
    setOpen(false)
    router.push(url)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const hit = hits[active]
      if (hit) go(hit)
      else if (query.trim()) {
        router.push(`/dashboard/direction/admissions?q=${encodeURIComponent(query.trim())}`)
        setOpen(false)
      }
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<SearchKind, SearchHit[]>()
    for (const hit of hits) {
      const list = map.get(hit.kind)
      if (list) list.push(hit)
      else map.set(hit.kind, [hit])
    }
    return [...map.entries()]
  }, [hits])

  let runningIndex = -1

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1 max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            void load()
          }}
          onFocus={() => {
            setOpen(true)
            void load()
          }}
          onKeyDown={onKeyDown}
          placeholder="Élève, tuteur, professeur, matricule…"
          aria-label="Recherche élèves, tuteurs, professeurs et inscriptions"
          autoComplete="off"
          spellCheck={false}
          className="h-10 min-h-10 pl-9 pr-16 text-base md:text-sm"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="min-h-8 min-w-8"
              aria-label="Effacer la recherche"
              onClick={() => {
                setQuery("")
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              Ctrl K
            </kbd>
          )}
        </div>
      </div>

      {open && query.trim() ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1.5 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border bg-card p-1 shadow-lg"
        >
          {loading && snapshot.students.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement de l’annuaire…
            </div>
          ) : hits.length === 0 ? (
            <div className="space-y-1 px-3 py-6 text-center">
              <p className="text-sm font-medium">Aucun résultat pour « {query.trim()} »</p>
              <p className="text-xs text-muted-foreground">
                Nom, prénom, téléphone, matricule ou classe. Accents ignorés.
              </p>
            </div>
          ) : (
            grouped.map(([kind, items]) => {
              const Icon = KIND_ICON[kind]
              return (
                <div key={kind} className="py-1">
                  <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {SEARCH_KIND_LABELS[kind]}
                  </p>
                  {items.map((hit) => {
                    runningIndex += 1
                    const index = runningIndex
                    return (
                      <button
                        key={`${hit.kind}-${hit.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={cn(
                          "flex w-full min-h-11 cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left transition-colors",
                          index === active ? "bg-muted" : "hover:bg-muted/70",
                        )}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(hit)}
                      >
                        <span className="text-sm font-medium">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="text-xs text-muted-foreground">{hit.subtitle}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
