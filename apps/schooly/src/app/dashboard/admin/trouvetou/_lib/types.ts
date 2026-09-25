/**
 * Modèle typé du module Trouvetou + normalisation à la frontière.
 * Les données arrivent de la page serveur en `unknown` : toute ligne
 * invalide est écartée avant d'atteindre l'UI d'administration.
 */

import { normalizeHttpUrl, normalizeHttpUrlList } from "@/lib/safe-url"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : []
}

export type TrouvetouSchool = {
  id: string
  name: string
  city: string | null
  published_to_trouvetou: boolean
  description_publique: string | null
  latitude: number | null
  longitude: number | null
  itineraire: string | null
  photos_360: string[]
  video_url: string | null
  grille_tarifaire_publique: unknown | null
  cover_photo_url: string | null
  gallery_photos: string[]
  public_address: string | null
  public_phone: string | null
  public_email: string | null
  public_website_url: string | null
  public_highlights: string[]
  admission_notes: string | null
}

export type TrouvetouReservation = {
  id: string
  student_full_name: string
  parent_full_name: string
  parent_phone: string
  status: string
  created_at: string
  grade_level_id: string | null
  /** Champs de qualification (absents du select initial, renseignés après PATCH). */
  student_birthdate?: string | null
  parent_email?: string | null
}

export type TrouvetouAd = {
  id: string
  title: string
  message: string
  image_url: string | null
  target_url: string | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at?: string
}

export function normalizeSchool(raw: unknown): TrouvetouSchool | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return null
  return {
    id: raw.id,
    name: raw.name,
    city: asNullableString(raw.city),
    published_to_trouvetou: Boolean(raw.published_to_trouvetou),
    description_publique: asNullableString(raw.description_publique),
    latitude: typeof raw.latitude === "number" ? raw.latitude : null,
    longitude: typeof raw.longitude === "number" ? raw.longitude : null,
    itineraire: asNullableString(raw.itineraire),
    photos_360: normalizeHttpUrlList(raw.photos_360),
    video_url: normalizeHttpUrl(raw.video_url),
    grille_tarifaire_publique: raw.grille_tarifaire_publique ?? null,
    cover_photo_url: normalizeHttpUrl(raw.cover_photo_url),
    gallery_photos: normalizeHttpUrlList(raw.gallery_photos),
    public_address: asNullableString(raw.public_address),
    public_phone: asNullableString(raw.public_phone),
    public_email: asNullableString(raw.public_email),
    public_website_url: normalizeHttpUrl(raw.public_website_url),
    public_highlights: asStringArray(raw.public_highlights),
    admission_notes: asNullableString(raw.admission_notes),
  }
}

export function normalizeReservations(raw: unknown): TrouvetouReservation[] {
  if (!Array.isArray(raw)) return []
  const result: TrouvetouReservation[] = []
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== "string") continue
    result.push({
      id: row.id,
      student_full_name: asString(row.student_full_name),
      parent_full_name: asString(row.parent_full_name),
      parent_phone: asString(row.parent_phone),
      status: asString(row.status, "pending_payment"),
      created_at: asString(row.created_at),
      grade_level_id: asNullableString(row.grade_level_id),
      student_birthdate: asNullableString(row.student_birthdate),
      parent_email: asNullableString(row.parent_email),
    })
  }
  return result
}

export function normalizeAds(raw: unknown): TrouvetouAd[] {
  if (!Array.isArray(raw)) return []
  const result: TrouvetouAd[] = []
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== "string") continue
    if (typeof row.title !== "string") continue
    result.push({
      id: row.id,
      title: row.title,
      message: asString(row.message),
      image_url: normalizeHttpUrl(row.image_url),
      target_url: normalizeHttpUrl(row.target_url),
      start_date: asString(row.start_date),
      end_date: asString(row.end_date),
      is_active: Boolean(row.is_active),
      created_at: asNullableString(row.created_at) ?? undefined,
    })
  }
  return result
}
