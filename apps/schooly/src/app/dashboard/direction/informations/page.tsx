import { getFicheState } from "./actions"
import { InformationsWizard } from "./informations-wizard"
import { SuppliesSection } from "./supplies-section"

export const dynamic = "force-dynamic"

export default async function InformationsPage() {
  const state = await getFicheState()

  if (!state.ok) {
    return (
      <div className="space-y-2 p-6">
        <h1 className="text-xl font-semibold">Fiche de renseignement</h1>
        <p className="text-sm text-muted-foreground">
          {state.error ?? "Cette page n’est pas disponible pour votre compte."}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <InformationsWizard state={state} supplies={<SuppliesSection />} />
    </div>
  )
}
