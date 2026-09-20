import { getSuppliesState } from "./supplies-actions"
import { SuppliesEditor } from "./supplies-editor"

export async function SuppliesSection() {
  const res = await getSuppliesState()
  if (!res.ok) {
    return (<p className="text-sm text-muted-foreground">{res.error} Les fournitures seront configurables des qu\u2019une annee scolaire sera active.</p>)
  }
  return <SuppliesEditor initial={res.supplies} />
}
