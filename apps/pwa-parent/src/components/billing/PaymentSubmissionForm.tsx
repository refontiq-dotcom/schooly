"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Phone, HelpCircle, ExternalLink } from "lucide-react";
import { formatFCFA } from "@refontiq/billing";

interface PaymentSubmissionFormProps {
  productId: string;
  productName: string;
  tierId: string;
  tierLabel: string;
  amount: number;
  onSubmit: (data: { senderPhone: string; notes?: string }) => Promise<void>;
  isLoading?: boolean;
}

// Wave pay URL from env (fallback to config)
const WAVE_PAY_URL = process.env.NEXT_PUBLIC_WAVE_PAY_URL || "https://pay.wave.com/m/M_ci_RImDyQYI8ccj/c/ci/";

export function PaymentSubmissionForm({
  productId,
  productName,
  tierId,
  tierLabel,
  amount,
  onSubmit,
  isLoading,
}: PaymentSubmissionFormProps) {
  const [senderPhone, setSenderPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!senderPhone.trim()) {
      setError("Le numéro Wave est requis");
      return;
    }

    if (!/^(0[1-9]\d{8}|\+225\s?0[1-9]\d{8})$/.test(senderPhone.replace(/\s/g, ""))) {
      setError("Format invalide. Ex: 07xxxxxxxx ou +225 07xxxxxxxx");
      return;
    }

    try {
      await onSubmit({ senderPhone: senderPhone.trim(), notes: notes.trim() });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la soumission");
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800">Demande envoyée !</h3>
              <p className="text-sm text-green-700 mt-1">
                Votre demande de validation de paiement a été soumise au Super Admin.
              </p>
              <p className="text-xs text-green-600 mt-2">
                Vous serez notifié dès que le paiement sera validé ou rejeté.
              </p>
            </div>
            <Button variant="outline" onClick={() => setSuccess(false)} className="w-full sm:w-auto">
              Faire une autre demande
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base">Paiement {tierLabel}</CardTitle>
            <CardDescription className="text-xs">
              Montant : <span className="font-semibold text-amber-800">{formatFCFA(amount)}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-800 mb-2">
              <HelpCircle className="w-4 h-4" />
              <span>Payez via le lien Wave officiel :</span>
            </div>
            <a
              href={WAVE_PAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-amber-700 underline break-all hover:text-amber-900"
            >
              {WAVE_PAY_URL}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-800 mb-2">
              <Phone className="w-4 h-4" />
              <span>Après paiement, saisissez le numéro Wave expéditeur :</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="space-y-1">
                <label htmlFor="sender-phone" className="text-xs font-medium text-amber-900">
                  Numéro Wave (ex: 07xxxxxxxx)
                </label>
                <Input
                  id="sender-phone"
                  type="tel"
                  placeholder="07 00 00 00 00"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  disabled={isLoading}
                  className="text-sm"
                  maxLength={15}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="notes" className="text-xs font-medium text-amber-900">
                  Notes (optionnel)
                </label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Référence transaction, commentaire..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isLoading}
                  className="text-sm"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !senderPhone.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  "Soumettre pour validation"
                )}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
