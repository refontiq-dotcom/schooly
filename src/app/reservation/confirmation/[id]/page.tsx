import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import ConfirmPaymentButton from "./confirm-payment-button";
import type { Reservation } from "@/types";

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

  const isReserved = reservation.status === "reserved" || reservation.status === "confirmed";
  const qrDataUrl = isReserved
    ? await QRCode.toDataURL(reservation.qr_code_token, { width: 260, margin: 1 })
    : null;

  return (
    <div className="max-w-lg mx-auto card text-center">
      {!isReserved ? (
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
