export type RequiredDocument = {
  id: string
  label: string
  required: boolean
  applicableToLevelId?: string | null
}

export const DEFAULT_REQUIRED_DOCUMENTS: RequiredDocument[] = [
  { id: "default-acte-naissance", label: "Extrait acte de naissance", required: true },
  { id: "default-photos", label: "Photos d’identité", required: true },
  { id: "default-piece-parent", label: "Pièce d’identité du parent / responsable", required: true },
  { id: "default-bulletin", label: "Bulletin de l'année précédente", required: false },
  { id: "default-certificat-scolarite", label: "Certificat de scolarité", required: false },
  { id: "default-certificat-transfert", label: "Certificat de transfert", required: false },
  { id: "default-certificat-medical", label: "Certificat médical", required: false },
]
