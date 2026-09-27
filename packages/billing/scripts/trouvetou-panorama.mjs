/**
 * Sérialisation des photos 360° pour la synchronisation Schooly -> Trouvetou.
 *
 * Volontairement SANS effet de bord et sans accès réseau : la fonction est pure
 * pour être testée sur tous les cas, y compris ceux qu'aucun jeu de données
 * réel ne produira jamais (URL exotique, statut incohérent, absence de média).
 *
 * Règle de rétrocompatibilité : tant qu'une école n'a pas de visite publiée,
 * le champ historique `schools.photos_360` continue d'être transmis tel quel.
 * Une école migrée ne doit donc jamais voir ses photos disparaître de
 * Trouvetou parce que la nouvelle table est vide.
 */
import { normalizeHttpUrl } from "./safe-url.mjs";

/** Seuls les médias publiés quittent Schooly. */
const PUBLISHABLE_STATUS = "published";

/**
 * @typedef {object} PanoramaContract
 * @property {string} id
 * @property {"photo_360"} media_type
 * @property {string} url
 * @property {number|null} width
 * @property {number|null} height
 * @property {number|null} byte_size
 * @property {string|null} content_type
 * @property {string|null} room_id
 * @property {"equirectangular_2_1"} projection
 * @property {string|null} validated_at
 */

/**
 * Convertit une ligne `school_media` en contrat Trouvetou, ou `null` si elle
 * n'est pas publiable ou si son URL n'est pas sûre.
 *
 * Le filtre d'URL est indispensable : la clé R2 est générée par le serveur,
 * mais `public_url` reste une donnée de base, et le script ne doit jamais
 * pouvoir pousser un `javascript:` vers le site public.
 *
 * @param {object} media
 * @returns {PanoramaContract|null}
 */
export function toPanoramaContract(media) {
  if (!media || media.status !== PUBLISHABLE_STATUS) return null;
  if (media.kind !== "panorama_360") return null;

  const url = normalizeHttpUrl(media.public_url);
  if (!url) return null;

  return {
    id: media.id,
    // Sans ce marqueur, Trouvetou ne peut pas distinguer une visite d'une photo
    // et la projette comme une image plate dans sa visionneuse.
    media_type: "photo_360",
    url,
    width: media.width ?? null,
    height: media.height ?? null,
    byte_size: media.byte_size ?? null,
    content_type: media.content_type ?? null,
    room_id: media.room_id ?? null,
    projection: "equirectangular_2_1",
    validated_at: media.validated_at ?? null,
  };
}

/**
 * Compose la partie 360° d'une charge utile de synchronisation.
 *
 * @param {object} params
 * @param {object[]} params.media       lignes `school_media` de l'école
 * @param {string[]|null} params.legacyPhotos360  ancien champ `schools.photos_360`
 * @returns {{ panoramas: PanoramaContract[], photos_360: string[] }}
 */
export function buildPanoramaPayload({ media, legacyPhotos360 }) {
  const panoramas = (media || []).map(toPanoramaContract).filter(Boolean);

  // Repli : sans visite publiée, on transmet l'historique. `photos_360` reste
  // un simple tableau d'URL, inchangé, tant que Trouvetou n'a pas adopté
  // `panoramas`.
  const legacy = (legacyPhotos360 || []).map(normalizeHttpUrl).filter(Boolean).slice(0, 1);
  const photos360 = panoramas.length > 0 ? [panoramas[0].url] : legacy;

  return { panoramas, photos_360: photos360 };
}
