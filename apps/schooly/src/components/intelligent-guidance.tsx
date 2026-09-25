"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { ArrowRight, BrainCircuit, ChevronDown, CircleAlert, Lightbulb, ShieldAlert, Info, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { rankGuidanceItems, isDismissible, type GuidanceItem, type GuidanceSeverity } from "@/lib/guidance"

const SEVERITY_ICON: Record<GuidanceSeverity, typeof ShieldAlert> = {
  critical: ShieldAlert,
  action: CircleAlert,
  warning: Lightbulb,
  info: Info,
}

/** Une alerte ignorée reste masquée 7 jours, sauf si son contenu change entre-temps. */
const SNOOZE_DAYS = 7

type DismissedEntry = { hash: string; until: number }

const DISMISSED_EVENT = "schooly:guidance-change"
const EMPTY_DISMISSED_RAW = ""

function storageKey(contextKey: string) {
  return `schooly:guidance:${contextKey}`
}

function parseDismissed(raw: string): Record<string, DismissedEntry> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const result: Record<string, DismissedEntry> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue
      const entry = value as { hash?: unknown; until?: unknown }
      if (typeof entry.hash === "string" && typeof entry.until === "number") {
        result[id] = { hash: entry.hash, until: entry.until }
      }
    }
    return result
  } catch {
    return {}
  }
}

function getDismissedRaw(contextKey: string): string {
  if (typeof window === "undefined") return EMPTY_DISMISSED_RAW
  return window.localStorage.getItem(storageKey(contextKey)) ?? EMPTY_DISMISSED_RAW
}

function subscribeDismissed(contextKey: string, onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined
  const key = storageKey(contextKey)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(DISMISSED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(DISMISSED_EVENT, onStoreChange)
  }
}

function saveDismissed(contextKey: string, data: Record<string, DismissedEntry>) {
  try {
    window.localStorage.setItem(storageKey(contextKey), JSON.stringify(data))
    window.dispatchEvent(new Event(DISMISSED_EVENT))
  } catch {
    // Stockage indisponible (navigation privée...) : on continue sans persister.
  }
}

function contentHash(item: GuidanceItem) {
  return `${item.title}::${item.description}`
}

function GuidanceRow({ item, dismissible, onDismiss, compact = false }: {
  item: GuidanceItem
  dismissible: boolean
  onDismiss: () => void
  compact?: boolean
}) {
  const Icon = SEVERITY_ICON[item.severity]
  return (
    <div className={compact ? "flex items-start gap-3 rounded-lg border bg-background p-3" : "rounded-lg border bg-background p-4"}>
      <div className="flex items-start gap-3">
        <Icon className={compact ? "mt-0.5 h-4 w-4 shrink-0 text-primary" : "mt-0.5 h-5 w-5 shrink-0 text-primary"} />
        <div className="min-w-0 flex-1">
          <p className={compact ? "text-sm font-medium" : "font-medium"}>{item.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          {item.actionLabel && item.href && (
            <Button asChild size="sm" variant={compact ? "outline" : "default"} className="mt-3">
              <Link href={item.href}>{item.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          )}
          {item.actionLabel && !item.href && item.onAction && (
            <Button size="sm" variant={compact ? "outline" : "default"} className="mt-3" onClick={item.onAction}>
              {item.actionLabel}<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            aria-label="Ignorer cette suggestion pour 7 jours"
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function IntelligentGuidance({
  items,
  title = "Schooly vous guide",
  contextKey,
}: {
  items: GuidanceItem[]
  title?: string
  /**
   * Clé stable identifiant cette page/ce module (ex. "direction-dashboard",
   * "finance", "personnel"). Sert d'espace de noms pour mémoriser les
   * suggestions ignorées. Obligatoire dès qu'au moins un item est
   * masquable, sinon le bouton "Ignorer" n'a aucun effet persistant.
   */
  contextKey: string
}) {
  const ranked = rankGuidanceItems(items)
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const dismissedRaw = useSyncExternalStore(
    useCallback((onStoreChange) => subscribeDismissed(contextKey, onStoreChange), [contextKey]),
    useCallback(() => getDismissedRaw(contextKey), [contextKey]),
    () => EMPTY_DISMISSED_RAW,
  )
  const dismissed = useMemo(() => parseDismissed(dismissedRaw), [dismissedRaw])

  useEffect(() => {
    const nextExpiry = Object.values(dismissed).reduce((earliest, entry) => Math.min(earliest, entry.until), Infinity)
    if (!Number.isFinite(nextExpiry)) return
    const delay = Math.max(0, nextExpiry - now)
    const timeout = window.setTimeout(() => setNow(Date.now()), delay)
    return () => window.clearTimeout(timeout)
  }, [dismissed, now])

  const visible = ranked.filter((item) => {
    if (!isDismissible(item)) return true
    const entry = dismissed[item.id]
    if (!entry) return true
    if (entry.hash !== contentHash(item)) return true // la situation a changé : on réaffiche
    return now >= entry.until
  })

  if (visible.length === 0) return null

  const [top, ...rest] = visible

  function dismiss(item: GuidanceItem) {
    const next = {
      ...dismissed,
      [item.id]: { hash: contentHash(item), until: now + SNOOZE_DAYS * 24 * 60 * 60 * 1000 },
    }
    saveDismissed(contextKey, next)
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" />{title}</span>
          {visible.length > 1 && (
            <span className="text-xs font-normal text-muted-foreground">{visible.length} suggestions</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <GuidanceRow item={top} dismissible={isDismissible(top)} onDismiss={() => dismiss(top)} />

        {rest.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {expanded ? "Masquer" : `Voir ${rest.length} autre${rest.length > 1 ? "s" : ""} suggestion${rest.length > 1 ? "s" : ""}`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <div className="space-y-2">
                {rest.map((item) => (
                  <GuidanceRow key={item.id} item={item} dismissible={isDismissible(item)} onDismiss={() => dismiss(item)} compact />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
