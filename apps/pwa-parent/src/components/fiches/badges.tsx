// ============================================================================
// M4 — Badges & icônes Zero-Image (PWA parent) : aucun <img>, que du vectoriel
// + texte. Map icône→composant Lucide centralisée pour transport/cantine/
// tenues/fournitures (les JSONB ne stockent que des libellés d'icônes).
// ============================================================================

import {
  Book,
  Soup,
  Bus,
  Calculator,
  Car,
  Compass,
  CookingPot,
  FileText,
  FlaskConical,
  HardHat,
  NotebookPen,
  Package,
  PenLine,
  Pencil,
  Ruler,
  Salad,
  Shirt,
  Coffee,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

const ICONS: Record<string, LucideIcon> = {
  bus: Bus,
  car: Car,
  minibus: Bus,
  van: Car,
  utensils: UtensilsCrossed,
  bowl: Soup,
  sandwich: Salad,
  cup: Coffee,
  shirt: Shirt,
  book: Book,
  calculator: Calculator,
  flask: FlaskConical,
  notebook: NotebookPen,
  pen: PenLine,
  pencil: Pencil,
  ruler: Ruler,
  files: FileText,
  package: Package,
  compass: Compass,
  wrench: Wrench,
  "hard-hat": HardHat,
  toolbox: Wrench,
  drafting: Ruler,
}

export function ServiceIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && ICONS[name]) || Package
  return <Cmp className={className ?? "size-4"} aria-hidden />
}

const CYCLE_COLORS: Record<string, string> = {
  general: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  technique: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  professionnel: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
}

export function BadgeCycle({ cycleKey, label }: { cycleKey: string; label: string }) {
  return <Badge className={CYCLE_COLORS[cycleKey] ?? ""} variant="secondary">{label}</Badge>
}

export function BadgeSerie({ serie }: { serie: string }) {
  return <Badge variant="outline">{serie}</Badge>
}

export function BadgeStatus({ published }: { published: boolean }) {
  return <Badge variant={published ? "default" : "secondary"}>{published ? "Publié" : "Brouillon"}</Badge>
}

export function MealPotIcon({ className }: { className?: string }) {
  return <CookingPot className={className ?? "size-4"} aria-hidden />
}
