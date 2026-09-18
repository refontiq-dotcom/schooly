import Link from "next/link"
import { getMovementOverview, getMovementActivations } from "./actions"
import { MovementForm } from "./movement-form"
import { ActivationForm } from "./activation-form"

export default async function MovementsPage() {
  const [result, activations] = await Promise.all([getMovementOverview(), getMovementActivations()])
  const data = result.data
  const available = data?.enrollments.filter(e => !data.requests.some(r => r.enrollment_id === e.id)) ?? []
  return <main className="space-y-6">
    <Link href="/dashboard/direction/admissions" className="text-primary underline">Retour aux inscriptions</Link>
    <h1 className="text-2xl font-semibold">Préparer un mouvement TRF / ORT</h1>
    <p>Préparez une demande puis activez TRF administrativement pour 60 jours. Aucun quitus, aucune inscription d’accueil et aucun changement de tarif ne sont effectués. ORT reste à vérifier.</p>
    <p>Pour inscrire un élève venant d’un autre établissement, utilisez <Link href="/dashboard/admissions/import" className="text-primary underline">l’import par code de transfert</Link>.</p>
    {result.error && <p role="alert">{result.error}</p>}
    {activations.error && <p role="alert">{activations.error}</p>}
    {data && <>
      <section className="space-y-4 rounded border p-4">
        <h2 className="text-xl font-semibold">Nouvelle demande</h2>
        <p>Une seule demande par inscription. La modification et l’annulation des brouillons ne sont pas encore disponibles : vérifiez les informations avant d’enregistrer.</p>
        {available.length > 0 ? <MovementForm enrollments={available} />
          : <p>Aucune inscription active sans demande disponible.</p>}
      </section>
      <section className="space-y-4 rounded border p-4">
        <h2 className="text-xl font-semibold">Demandes enregistrées</h2>
        {data.requests.length === 0 ? <p>Aucune demande enregistrée.</p> : <ul className="space-y-3">
          {data.requests.map(r => {
            const activation = activations.data?.find(a => a.request_id === r.id)
            const expired = activation && Date.now() >= new Date(activation.expires_at).getTime()
            return <li key={r.id} className="rounded border p-3">
            <p className="font-medium">{data.enrollments.find(e => e.id === r.enrollment_id)?.label ?? "Inscription source non active ou indisponible"}</p>
            <p>{r.kind === "ORT" ? "ORT — Orientation à vérifier" : "TRF — Transfert volontaire"}</p>
            {activation ? <p>
              {expired ? "Activation expirée" : "Activation administrative active"} — échéance : {new Intl.DateTimeFormat("fr-FR", {
                dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan",
              }).format(new Date(activation.expires_at))}. Aucun quitus ni droit d’importation accordé.
            </p> : <p>{activations.canActivate ? "Brouillon non activé" : "État d’activation réservé à la direction ou indisponible"}</p>}
            {activations.canActivate && !activation && r.kind === "TRF" && <ActivationForm requestId={r.id} />}
            <p>Code de suivi : <strong>{r.tracking_code}</strong> — non utilisable pour une inscription d’accueil.</p>
            <p>Motif : {r.reason}</p>
            {r.decision_reference && <p>Référence déclarée : {r.decision_reference}</p>}
            <p>Enregistré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Abidjan" }).format(new Date(r.created_at))}</p>
          </li>})}
        </ul>}
      </section>
    </>}
  </main>
}
