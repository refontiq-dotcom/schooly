import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import ConfirmPaymentButton from "./confirm-payment-button";
import type { Reservation } from "@/types";
import { RESERVATION_STATUS_LABEL } from "@/types";

export const revalidate = 0;

async function getReservation(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("*, establishments(name)")
    .eq("id", id)
    .single();
  return data as (Reservation & { establishments: { name: string } }) | null;
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) return notFound();

  const status = reservation.status;
  const isReserved = status === "reserved" || status === "confirmed";
  const qrDataUrl = isReserved
    ? await QRCode.toDataURL(reservation.qr_code_token, { width: 260, margin: 1 })
    : null;

  return (
    <div className="max-w-lg mx-auto card text-center">
      {status === "rejected_fraud" ? (
        <>
          <div className="badge-danger mb-4">Demande rejetée</div>
          <h1 className="text-xl font-bold text-navy mb-2">Réservation refusée</h1>
          <p className="text-slate-600">
            Votre demande n&apos;a pas pu aboutir pour des raisons de sécurité.
            Contactez l&apos;établissement si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
          </p>
        </>
      ) : status === "waitlisted" ? (
        <>
          <div className="badge-info mb-4">Liste d&apos;attente</div>
          <h1 className="text-xl font-bold text-navy mb-2">
            Vous êtes sur la liste d&apos;attente
          </h1>
          <p className="text-slate-600 mb-4">
            <strong>{reservation.student_full_name}</strong> est inscrit sur la liste
            d&apos;attente de <strong>{reservation.establishments?.name}</strong>.
          </p>
          {reservation.waitlist_position && (
            <p className="text-2xl font-bold text-navy mb-2">
              Position #{reservation.waitlist_position}
            </p>
          )}
          {reservation.parent_trust_score !== null && (
            <p className="text-xs text-slate-400 mb-3">
              Score de confiance parent : {reservation.parent_trust_score}/100
            </p>
          )}
          <p className="text-sm text-slate-500">
            Vous serez prévenu automatiquement dès qu&apos;une place se libère.
          </p>
        </>
      ) : status === "pending_payment" ? (
        <>
          <h1 className="text-xl font-bold text-navy mb-2">Finaliser le paiement</h1>
          <p className="text-slate-600 mb-6">
            Votre dossier de réservation pour <strong>{reservation.student_full_name}</strong>{" "}
            est en attente de paiement des frais de réservation auprès de{" "}
            <strong>{reservation.establishments?.name}</strong>.
          </p>
          <ConfirmPaymentButton reservationId={reservation.id} />
          <p className="text-xs text-slate-400 mt-4">
            L&apos;intégration d&apos;un moyen de paiement en ligne (mobile money / carte)
            est prévue en Phase 1 — voir README du projet.
          </p>
        </>
      ) : status === "expired" ? (
        <>
          <div className="badge-danger mb-4">{RESERVATION_STATUS_LABEL[status]}</div>
          <h1 className="text-xl font-bold text-navy mb-2">Réservation expirée</h1>
          <p className="text-slate-600">
            Le délai de confirmation a été dépassé. Vous pouvez refaire une demande depuis
            la fiche de l&apos;établissement.
          </p>
        </>
      ) : status === "cancelled" ? (
        <>
          <div className="badge-muted mb-4">{RESERVATION_STATUS_LABEL[status]}</div>
          <h1 className="text-xl font-bold text-navy mb-2">Réservation annulée</h1>
          <p className="text-slate-600">
            Cette réservation a été annulée. Contactez l&apos;établissement pour plus
            d&apos;informations.
          </p>
        </>
      ) : (
        <>
          <div className="badge-success mb-4">Réservation confirmée</div>
          <h1 className="text-xl font-bold text-navy mb-2">
            Place réservée pour {reservation.student_full_name}
          </h1>
          <p className="text-slate-600 mb-6">
            Présentez ce QR code à l&apos;accueil de{" "}
            <strong>{reservation.establishments?.name}</strong> pour finaliser
            l&apos;inscription de votre enfant.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code de réservation" className="mx-auto mb-4" />
          )}
          {reservation.expires_at && (
            <p className="text-sm text-amber-600">
              ⚠️ Cette réservation doit être finalisée avant le{" "}
              {new Date(reservation.expires_at).toLocaleString("fr-FR")}, faute de quoi
              la place sera automatiquement libérée.
            </p>
          )}
        </>
      )}
    </div>
  );
}