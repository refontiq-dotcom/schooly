"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Search, X } from "lucide-react"

export type ChipOption = { value: string; label: string; count?: number }

export function DirectoryToolbar({
  query,
  onQueryChange,
  placeholder,
  hint,
  chips,
  chipValue,
  onChipChange,
  letters,
  activeLetter,
  onLetterChange,
  resultCount,
  totalCount,
  showSearch = true,
}: {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  hint?: string
  chips?: ChipOption[]
  chipValue?: string
  onChipChange?: (value: string) => void
  letters?: string[]
  activeLetter?: string
  onLetterChange?: (letter: string) => void
  resultCount: number
  totalCount: number
  showSearch?: boolean
}) {
  const showLetters = Boolean(letters && letters.length > 1 && !query.trim() && onLetterChange)
  const filteredHint = useMemo(() => {
    if (totalCount === 0) return null
    if (query.trim() || (chipValue && chipValue !== "all") || (activeLetter && activeLetter !== "all")) {
      return `${resultCount} / ${totalCount}`
    }
    return `${totalCount}`
  }, [activeLetter, chipValue, query, resultCount, totalCount])

  return (
    <div className="space-y-3">
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-11 min-h-11 pl-9 pr-20 text-base md:text-sm"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="min-h-8 min-w-8"
                aria-label="Effacer la recherche"
                onClick={() => onQueryChange("")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
            {filteredHint ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {filteredHint}
              </span>
            ) : null}
          </div>
        </div>
      ) : filteredHint ? (
        <p className="text-xs tabular-nums text-muted-foreground">{filteredHint} fiches</p>
      ) : null}
      {hint && showSearch ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      {chips && chips.length > 1 && onChipChange ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtres">
          {chips.map((chip) => {
            const selected = (chipValue ?? "all") === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChipChange(chip.value)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {chip.label}
                {typeof chip.count === "number" ? (
                  <span className={cn("tabular-nums", selected ? "opacity-90" : "text-muted-foreground")}>
                    {chip.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {showLetters ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Index alphabetique">
          <button
            type="button"
            onClick={() => onLetterChange?.("all")}
            aria-pressed={activeLetter === "all" || !activeLetter}
            className={cn(
              "inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-md text-xs font-semibold",
              activeLetter === "all" || !activeLetter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Tous
          </button>
          {letters!.map((letter) => {
            const selected = activeLetter === letter
            return (
              <button
                key={letter}
                type="button"
                onClick={() => onLetterChange?.(letter)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-md font-mono text-xs font-semibold",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function DirectoryEmpty({
  query,
  onClear,
  emptyLabel,
}: {
  query: string
  onClear: () => void
  emptyLabel: string
}) {
  if (!query.trim()) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
  }

  return (
    <div className="space-y-3 p-8 text-center">
      <p className="text-sm font-medium">Aucun résultat pour « {query.trim()} »</p>
      <p className="text-xs text-muted-foreground">
        Essayez le nom, le prénom, le téléphone, le matricule ou la classe. Les accents et espaces sont ignorés.
      </p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onClear}>
        Effacer la recherche
      </Button>
    </div>
  )
}
