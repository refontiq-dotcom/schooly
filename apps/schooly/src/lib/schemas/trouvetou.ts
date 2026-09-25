import { z } from "zod"
import { normalizeHttpUrl } from "@/lib/safe-url"
import { isoDate, optionalText, requiredText } from "./shared"

const MAX_URL_LENGTH = 2048

const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(MAX_URL_LENGTH, `${label} est trop long (${MAX_URL_LENGTH} caractères max).`)
    .refine(
      (value) => normalizeHttpUrl(value) !== null,
      `${label} doit être une URL absolue commençant par http:// ou https://.`,
    )

const optionalHttpUrl = (label: string) =>
  z.preprocess(
    (value) =>
      value === undefined || value === null || (typeof value === "string" && value.trim() === "")
        ? null
        : value,
    httpUrl(label).nullable().default(null),
  )

const optionalHttpUrlList = (label: string) =>
  z.preprocess(
    (value) => value === undefined || value === null ? [] : value,
    z.array(httpUrl(label)).max(50, `${label} ne peut pas dépasser 50 URL.`).default([]),
  )

const optionalCoordinate = (label: string, min: number, max: number) =>
  z.preprocess(
    (value) =>
      value === undefined || value === null || (typeof value === "string" && value.trim() === "")
        ? null
        : value,
    z.coerce
      .number({ invalid_type_error: `${label} doit être un nombre.` })
      .min(min, `${label} doit être entre ${min} et ${max}.`)
      .max(max, `${label} doit être entre ${min} et ${max}.`)
      .nullable(),
  )

const optionalEmail = z.preprocess(
  (value) =>
    value === undefined || value === null || (typeof value === "string" && value.trim() === "")
      ? null
      : value,
  z.string().trim().email("L'adresse email publique est invalide.").max(160).nullable(),
)

export const trouvetouProfileSchema = z.object({
  description_publique: optionalText("La description", 2000),
  latitude: optionalCoordinate("La latitude", -90, 90),
  longitude: optionalCoordinate("La longitude", -180, 180),
  itineraire: optionalText("L'itinéraire", 1000),
  video_url: optionalHttpUrl("La vidéo"),
  photos_360: optionalHttpUrlList("Les photos 360°"),
  cover_photo_url: optionalHttpUrl("La photo principale"),
  gallery_photos: optionalHttpUrlList("La galerie"),
  public_address: optionalText("L'adresse publique", 300),
  public_phone: optionalText("Le téléphone public", 40),
  public_email: optionalEmail.default(null),
  public_website_url: optionalHttpUrl("Le site web"),
  public_highlights: z
    .array(z.string().trim().min(1).max(160))
    .max(20, "La liste des points forts ne peut pas dépasser 20 éléments.")
    .default([]),
  admission_notes: optionalText("Les informations d'admission", 2000),
})

export const trouvetouAdSchema = z
  .object({
    title: requiredText("Le titre", 160),
    message: requiredText("Le message", 1000),
    image_url: optionalHttpUrl("L'image de la publicité"),
    target_url: optionalHttpUrl("La destination de la publicité"),
    start_date: isoDate("La date de début", { allowFuture: true }),
    end_date: isoDate("La date de fin", { allowFuture: true }),
  })
  .refine((value) => value.end_date >= value.start_date, {
    path: ["end_date"],
    message: "La date de fin doit être postérieure ou égale à la date de début.",
  })

export type TrouvetouProfileInput = z.infer<typeof trouvetouProfileSchema>
export type TrouvetouAdInput = z.infer<typeof trouvetouAdSchema>