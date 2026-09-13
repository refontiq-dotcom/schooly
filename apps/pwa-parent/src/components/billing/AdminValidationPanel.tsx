"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatFCFA, formatDate } from "@refontiq/billing";
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Check, Ban, Search, CreditCard, Phone, Eye, MoreHorizontal } from "lucide-react";
import type { SubscriptionPaymentRequest } from "@refontiq/billing";

interface AdminValidationPanelProps {
  productId: string;
  productName: string;
  requests: (SubscriptionPaymentRequest & { tenant?: { company_name: string; contact_name: string; contact_email: string } })[];
  onValidate: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

type RequestWithTenant = SubscriptionPaymentRequest & { tenant?: { company_name: string; contact_name: string; contact_email: string } };

export function AdminValidationPanel({
  productId,
  productName,
  requests,
  onValidate,
  onReject,
  onRefresh,
}: AdminValidationPanelProps) {
  const [validateTarget, setValidateTarget] = useState<typeof requests[0] | null>(null);
  const [rejectTarget, setRejectTarget] = useState<typeof requests[0] | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "validated" | "rejected">("all");

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const validatedRequests = requests.filter((r) => r.status === "validated");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const tenantName = r.tenant?.company_name || "";
      const tenantContact = r.tenant?.contact_name || "";
      const haystack = `${tenantName} ${tenantContact} ${r.sender_phone || ""} ${r.tier_id || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const confirmValidate = useCallback(async () => {
    if (!validateTarget) return;
    setActioningId(validateTarget.id);
    try {
      await onValidate(validateTarget.id);
      setValidateTarget(null);
      await onRefresh();
    } catch (err) {
      console.error("Validation failed:", err);
    } finally {
      setActioningId(null);
    }
  }, [validateTarget, onValidate, onRefresh]);

  const confirmReject = useCallback(async () => {
    if (!rejectTarget) return;
    setActioningId(rejectTarget.id);
    try {
      await onReject(rejectTarget.id);
      setRejectTarget(null);
      await onRefresh();
    } catch (err) {
      console.error("Rejection failed:", err);
    } finally {
      setActioningId(null);
    }
  }, [rejectTarget, onReject, onRefresh]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Validations de paiement {productName}
          </h2>
          <p className="text-xs text-slate-500">
            Paiements Wave déclarés par les gérants — validation manuelle requise
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {pendingRequests.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Clock className="w-3 h-3" /> {pendingRequests.length} en attente
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh} className="shrink-0">
            <Search className="w-4 h-4" /> Rafraîchir
          </Button>
        </div>
      </div>

      {/* Alerte visuelle */}
      {pendingRequests.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {pendingRequests.length} demande{pendingRequests.length > 1 ? "s" : ""} de paiement en attente de validation
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Vérifiez les paiements Wave sur votre compte et validez pour activer les abonnements.
            </p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par établissement, contact, n° Wave, formule…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="validated">Validées</option>
          <option value="rejected">Rejetées</option>
        </select>
      </div>

      {/* Onglets par statut */}
      <div className="space-y-6">
        {pendingRequests.length > 0 && (
          <ValidationSection
            title="En attente de validation"
            requests={filteredRequests.filter((r) => r.status === "pending")}
            emptyMessage="Aucune validation en attente"
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            badgeVariant="secondary"
            onValidate={setValidateTarget}
            onReject={setRejectTarget}
            actioningId={actioningId}
          />
        )}

        {validatedRequests.length > 0 && (
          <ValidationSection
            title="Validées"
            requests={filteredRequests.filter((r) => r.status === "validated")}
            emptyMessage="Aucune validation"
            icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
            badgeVariant="default"
            readOnly
          />
        )}

        {rejectedRequests.length > 0 && (
          <ValidationSection
            title="Rejetées"
            requests={filteredRequests.filter((r) => r.status === "rejected")}
            emptyMessage="Aucun rejet"
            icon={<XCircle className="w-4 h-4 text-red-600" />}
            badgeVariant="destructive"
            readOnly
          />
        )}
      </div>

      {/* Modals */}
      <ValidationModal
        open={!!validateTarget}
        onClose={() => setValidateTarget(null)}
        title="Confirmer la validation"
        description="Cette action active immédiatement l'abonnement de l'établissement"
        request={validateTarget}
        actionLabel="Valider"
        actionVariant="default"
        onAction={confirmValidate}
        loading={actioningId === validateTarget?.id}
      />

      <ValidationModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Rejeter le paiement"
        description="Le gérant sera notifié et pourra soumettre une nouvelle demande"
        request={rejectTarget}
        actionLabel="Rejeter"
        actionVariant="destructive"
        onAction={confirmReject}
        loading={actioningId === rejectTarget?.id}
      />
    </div>
  );
}

interface ValidationSectionProps {
  title: string;
  requests: RequestWithTenant[];
  emptyMessage: string;
  icon: React.ReactNode;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  onValidate?: (req: RequestWithTenant) => void;
  onReject?: (req: RequestWithTenant) => void;
  actioningId?: string | null;
  readOnly?: boolean;
}

function ValidationSection({
  title,
  requests,
  emptyMessage,
  icon,
  badgeVariant,
  onValidate,
  onReject,
  actioningId,
  readOnly,
}: ValidationSectionProps) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant={badgeVariant}>{requests.length}</Badge>
        </div>
      </div>
      {requests.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Établissement</th>
                <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Contact</th>
                <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Formule</th>
                <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Montant</th>
                <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">N° Wave</th>
                <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Demandé le</th>
                {!readOnly && <th className="text-right p-4 text-xs font-medium text-slate-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                  <td className="p-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {req.tenant?.company_name || "Établissement inconnu"}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {req.tenant?.contact_name || "—"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {req.tenant?.contact_email || "—"}
                    </p>
                  </td>
                  <td className="p-4">
                    <Badge variant={req.tier_id === "entreprise" ? "default" : "secondary"}>
                      {req.tier_id || "—"}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatFCFA(req.amount)}
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {req.sender_phone || "—"}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {formatDate(req.created_at)}
                  </td>
                  {!readOnly && (
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject?.(req)}
                          disabled={actioningId === req.id}
                        >
                          <Ban className="w-4 h-4" /> Rejeter
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onValidate?.(req)}
                          disabled={actioningId === req.id}
                        >
                          <Check className="w-4 h-4" /> Valider
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface ValidationModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  request: RequestWithTenant | null;
  actionLabel: string;
  actionVariant: "default" | "destructive";
  onAction: () => void;
  loading: boolean;
}

function ValidationModal({
  open,
  onClose,
  title,
  description,
  request,
  actionLabel,
  actionVariant,
  onAction,
  loading,
}: ValidationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {request && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Établissement</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {request.tenant?.company_name || "—"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Formule</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.tier_id || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Montant déclaré</p>
                <p className="font-medium text-slate-900 dark:text-white">{formatFCFA(request.amount)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-400">N° Wave</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.sender_phone || "—"}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Annuler
              </Button>
              <Button variant={actionVariant} onClick={onAction} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : actionLabel}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
