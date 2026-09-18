export type GuidanceSeverity = "critical" | "action" | "warning" | "info"

export type GuidanceItem = {
  id: string
  title: string
  description: string
  severity: GuidanceSeverity
  actionLabel?: string
  onAction?: () => void
}

export function nextGuidanceItem(items: GuidanceItem[]) {
  return items.find(item => item.severity === "critical")
    ?? items.find(item => item.severity === "action")
    ?? items.find(item => item.severity === "warning")
    ?? items.find(item => item.severity === "info")
}

export function predictiveHint(condition: boolean, item: Omit<GuidanceItem, "severity">): GuidanceItem | null {
  return condition ? { ...item, severity: "warning" } : null
}
