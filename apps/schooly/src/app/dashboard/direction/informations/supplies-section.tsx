import { getSuppliesState } from "./supplies-actions"
import { getSupplyProposalsForDirection } from "./supply-review-actions"
import { SuppliesEditor } from "./supplies-editor"
import { SupplyReview } from "./supply-review"

export async function SuppliesSection() {
  const [res, proposals] = await Promise.all([getSuppliesState(), getSupplyProposalsForDirection()])
  if (!res.ok) {
    return <p className="text-sm text-muted-foreground">{res.error} Les fournitures seront configurables dès qu’une année scolaire sera active.</p>
  }
  return <div className="space-y-6"><SupplyReview initial={proposals.ok ? (proposals.data ?? []) : []} /><SuppliesEditor initial={res.supplies} /></div>
}
