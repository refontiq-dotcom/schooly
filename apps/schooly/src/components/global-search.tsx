"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Clock, FileText, GraduationCap, Loader2, Search, Users, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { searchDirectory } from "@/app/dashboard/admissions/actions"
import {
  SEARCH_KIND_LABELS,
  type SearchHit,
  type SearchKind,
} from "@/lib/directory-index"

const KIND_ICON: Record<SearchKind, typeof GraduationCap> = {
  student: GraduationCap,
  guardian: Users,
  "pre-enrollment": Clock,
  enrollment: FileText,
}

/** Anti-rebond : on ne part pas au serveur à chaque frappe. */
const SEARCH_DEBOUNCE_MS = 200

/** En dessous de deux caractères, la recherche n'a pas d'intérêt (ni de requête). */
const SEARCH_MIN_LENGTH = 2

/** Référence stable : évite de recréer un tableau vide à chaque rendu. */
const NO_HITS: SearchHit[] = []

export function GlobalSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // S3 : les hits viennent du serveur (filtrage trigram en base) — plus aucun
  // instantané de l'annuaire en mémoire. Le résultat est étiqueté par la requête
  // qui l'a produit, ce qui permet de dériver « chargement » et « obsolète »
  // pendant le rendu au lieu d'entretenir des drapeaux dans un effet.
  const [result, setResult] = useState<{
    query: string
    hits: SearchHit[]
    mayHaveMore: boolean
  } | null>(null)

  const trimmed = query.trim()
  const isSearchable = trimmed.length >= SEARCH_MIN_LENGTH
  const isFresh = result !== null && result.query === trimmed
  const hits = isSearchable && isFresh ? result.hits : NO_HITS
  const mayHaveMore = isSearchable && isFresh ? result.mayHaveMore : false
  const loading = isSearchable && !isFresh

  // Effet : uniquement l'appel réseau. Aucun setState synchrone dans son corps
  // (règle react-hooks/set-state-in-effect) ; le garde `cancelled` empêche une
  // réponse tardive d'écraser les résultats d'une frappe plus récente.
  useEffect(() => {
    if (!isSearchable) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await searchDirectory(trimmed)
      if (cancelled) return
      setResult(
        "data" in res
          ? { query: trimmed, hits: res.data.hits, mayHaveMore: res.data.mayHaveMore }
          : { query: trimmed, hits: NO_HITS, mayHaveMore: false }
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, isSearchable])

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    return () => document.removeEventListener("mousedown", onPointer)
  }, [])

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery)
    setActive(0)
  }

  function go(hit: SearchHit) {
    const url = `${hit.href}&q=${encodeURIComponent(query.trim())}`
    setOpen(false)
    router.push(url)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Nom, téléphone, matricule, classe…"
          aria-label="Recherche élèves, tuteurs, inscriptions"
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
                handleQueryChange("")
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
          {loading && hits.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche en cours…
            </div>
          ) : hits.length === 0 && !mayHaveMore ? (
            <div className="space-y-1 px-3 py-6 text-center">
              <p className="text-sm font-medium">Aucun résultat pour « {query.trim()} »</p>
              <p className="text-xs text-muted-foreground">
                Nom, prénom, téléphone, matricule ou classe. Accents ignorés.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="space-y-1 px-3 py-6 text-center">
              <p className="text-sm font-medium">Trop de correspondances pour « {query.trim()} »</p>
              <p className="text-xs text-muted-foreground">
                Affinez avec un nom, un matricule ou un numéro de téléphone.
              </p>
            </div>
          ) : (
            <>
              {grouped.map(([kind, items]) => {
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
              })}
              {mayHaveMore ? (
                <p className="border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                  D’autres correspondances ont pu être écartées : affinez avec un
                  nom, un matricule ou un numéro de téléphone.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
