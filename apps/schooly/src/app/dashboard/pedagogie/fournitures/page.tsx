import { getTeacherSupplyProposals } from "./actions"
import { TeacherSuppliesClient } from "./teacher-supplies-client"

export const dynamic = "force-dynamic"

export default async function TeacherSuppliesPage() {
  const result = await getTeacherSupplyProposals()
  if (!result.ok) {
    return <div className="p-6"><h1 className="text-2xl font-semibold">Mes fournitures</h1><p className="mt-2 text-sm text-muted-foreground">{result.error}</p></div>
  }
  return <TeacherSuppliesClient initial={result.data ?? []} />
}
