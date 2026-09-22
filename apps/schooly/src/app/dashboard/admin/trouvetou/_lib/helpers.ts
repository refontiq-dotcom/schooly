/** Helpers purs du module Trouvetou (testés isolément du JSX). */

/** Traduit le statut d'une réservation en libellé français. */
export function reservationLabel(status: string): string {
  if (status === "pending_payment") return "Attente paiement"
  if (status === "reserved") return "Réservée"
  if (status === "confirmed") return "Confirmée"
  if (status === "expired") return "Expirée"
  return status
}

export type ProfileCompletionState = {
  coverPhoto: string
  description: string
  address: string
  latitude: string
  longitude: string
  phone: string
  email: string
  gallery: string[]
  videoUrl: string
  highlights: string[]
  admissionNotes: string
}

export type ProfileCompletion = {
  done: number
  total: number
  percent: number
  checks: ReadonlyArray<readonly [boolean, string]>
}

/** Complétude du profil public : 8 critères, arrondi au pourcentage près. */
export function profileCompletion(state: ProfileCompletionState): ProfileCompletion {
  const checks = [
    [Boolean(state.coverPhoto), "Photo principale"],
    [Boolean(state.description.trim()), "Description"],
    [Boolean(state.address.trim() || (state.latitude && state.longitude)), "Localisation"],
    [Boolean(state.phone.trim() || state.email.trim()), "Contact"],
    [state.gallery.length > 0, "Galerie photo"],
    [Boolean(state.videoUrl.trim()), "Vidéo"],
    [state.highlights.length > 0, "Services / points forts"],
    [Boolean(state.admissionNotes.trim()), "Informations admission"],
  ] as const
  const done = checks.filter(([ok]) => ok).length
  return {
    done,
    total: checks.length,
    percent: Math.round((done / checks.length) * 100),
    checks,
  }
}

/** Message affichable pour n'importe quelle erreur (jamais `error: any`). */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
