"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfirmPaymentButton({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_reference: `SIM-${Date.now()}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de la confirmation");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handlePay} disabled={loading} className="btn-primary w-full">
        {loading ? "Paiement en cours..." : "Simuler le paiement et confirmer"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
