import { Badge } from "@/components/ui/badge"

type StatusVariant = "default" | "secondary" | "destructive" | "outline"

/** Libellés de statut partagés par les abonnements internat, cantine et transport. */
export const SERVICE_STATUS_LABELS: Record<string, { label: string; variant: StatusVariant }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
}

export function StatusBadge({ status }: { status: string }) {
  const entry = SERVICE_STATUS_LABELS[status]
  return <Badge variant={entry?.variant ?? "outline"}>{entry?.label ?? status}</Badge>
}
