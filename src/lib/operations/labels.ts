import type {
  BehaviorKind,
  DocumentStatus,
  DocumentType,
  FeeStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types";

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  pending: "À payer",
  partial: "Échéancier en cours",
  paid: "Soldé",
  overdue: "En retard",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  moov: "Moov Money",
  wave: "Wave",
  cash: "Espèces",
  bank: "Virement",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "En attente de confirmation",
  confirmed: "Confirmé",
  failed: "Échoué",
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  acte_naissance: "Acte de naissance",
  photo_identite: "Photo d'identité",
  carnet_vaccination: "Carnet de vaccination",
  bulletin_precedent: "Bulletin précédent",
  certificat_scolarite: "Certificat de scolarité",
  piece_identite: "Pièce d'identité",
  dossier_examen: "Dossier d'examen",
  autre: "Autre document",
};

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  missing: "Manquant",
  submitted: "Déposé",
  validated: "Validé",
  rejected: "À corriger",
};

export const BEHAVIOR_KIND_LABEL: Record<BehaviorKind, string> = {
  positif: "Point positif",
  a_surveiller: "À surveiller",
  incident: "Incident",
};

export function formatXof(amount: number | null | undefined) {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function feeStatusClass(status: FeeStatus) {
  if (status === "paid") return "badge-success";
  if (status === "overdue") return "badge-danger";
  if (status === "partial") return "badge-warning";
  return "inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-semibold";
}

export function documentStatusClass(status: DocumentStatus) {
  if (status === "validated") return "badge-success";
  if (status === "rejected" || status === "missing") return "badge-danger";
  return "badge-warning";
}

export const DOCUMENT_TYPES: DocumentType[] = [
  "acte_naissance",
  "photo_identite",
  "carnet_vaccination",
  "bulletin_precedent",
  "certificat_scolarite",
  "piece_identite",
  "dossier_examen",
  "autre",
];
