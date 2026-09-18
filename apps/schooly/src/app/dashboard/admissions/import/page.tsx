import Link from "next/link"
import { getImportOptions } from "./actions"
import { ImportForm } from "./import-form"

export default async function ImportMovementPage() {
  const result = await getImportOptions()
  const data = result.data
  return <main className="space-y-6">
    <Link href="/dashboard/direction/admissions" className="text-primary underline">Retour aux inscriptions</Link>
    <h1 className="text-2xl font-semibold">Inscrire un élève via un transfert Schooly</h1>
    <p>Réservé à la direction. La saisie du code crée une <strong>nouvelle inscription</strong> dans votre établissement : l’inscription d’origine est conservée, les notes, paiements et bulletins restent dans l’école de départ.</p>
    <p>Le dossier de l’élève n’est pas consultable avant l’importation : un code ne donne aucun droit de lecture entre établissements.</p>
    {result.error && <p role="alert">{result.error}</p>}
    {data && <ImportForm classes={data.classes} years={data.years} />}
  </main>
}