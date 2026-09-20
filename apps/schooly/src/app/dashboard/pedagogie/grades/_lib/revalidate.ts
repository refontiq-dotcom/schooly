// apps/schooly/src/app/dashboard/pedagogie/grades/_lib/revalidate.ts
// Module serveur uniquement : importe `next/cache`, ne jamais l'importer depuis
// un composant client.
//
// Depuis l'éclatement du module d'évaluation en trois écrans (hub, saisie,
// bulletins), une écriture doit invalider les trois — se limiter au hub laissait
// la saisie afficher une note périmée.
import { revalidatePath } from "next/cache"

export const GRADES_PATHS = [
  "/dashboard/pedagogie/grades",
  "/dashboard/pedagogie/grades/notes",
  "/dashboard/pedagogie/grades/report-cards",
] as const

/** Invalide l'ensemble du module d'évaluation après une écriture. */
export function revalidateGrades(): void {
  for (const path of GRADES_PATHS) revalidatePath(path)
}
