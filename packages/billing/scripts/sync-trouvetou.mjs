#!/usr/bin/env node
/**
 * Synchronise les ecoles publiees de Schooly vers Trouvetou.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalizeHttpUrl, normalizeHttpUrlList } from "./safe-url.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..");

function loadDotEnvLocal() {
  const file = resolve(REPO_ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadDotEnvLocal();

const schoolyUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const schoolyKey = process.env.SUPABASE_SECRET_KEY;
const syncUrl = (process.env.TROUVETOU_SYNC_URL || "").replace(/\/$/, "");
const apiKey = process.env.TROUVETOU_API_KEY;
const instanceUrl = process.env.TROUVETOU_INSTANCE_URL || "https://admin.schooly.ci";

if (!schoolyUrl || !schoolyKey || !syncUrl || !apiKey) {
  console.error("[trouvetou:sync] Configuration Schooly/Trouvetou incomplete (.env.local).");
  process.exit(1);
}

const ENDPOINT_SUFFIX = "/api/v1/sync/schooly";
const endpointUrl = syncUrl.endsWith(ENDPOINT_SUFFIX) ? syncUrl : `${syncUrl}${ENDPOINT_SUFFIX}`;
const schooly = createClient(schoolyUrl, schoolyKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: schools, error: schoolErr } = await schooly
  .from("schools")
  .select("id, name, city, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique, cover_photo_url, gallery_photos, public_address, public_phone, public_email, public_website_url, public_highlights, admission_notes")
  .eq("published_to_trouvetou", true)
  .is("deleted_at", null);

if (schoolErr) {
  console.error("[trouvetou:sync] Lecture ecoles impossible :", schoolErr.message);
  process.exit(1);
}
if (!schools?.length) {
  console.log("[trouvetou:sync] Aucune ecole publiee a synchroniser.");
  process.exit(0);
}

let synced = 0;
for (const school of schools) {
  const { data: levels, error: levelErr } = await schooly
    .from("grade_levels")
    .select("id, name")
    .eq("school_id", school.id)
    .is("deleted_at", null);

  if (levelErr) {
    console.error(`[trouvetou:sync] Echec lecture niveaux pour ${school.name}: ${levelErr.message}`);
    continue;
  }

  const levelIds = (levels || []).map((level) => level.id);
  const [{ data: classes, error: classesErr }, { data: enrollments, error: enrollmentsErr }, { data: reservations, error: reservationsErr }] = await Promise.all([
    levelIds.length
      ? schooly.from("classes").select("grade_level_id, capacity").eq("school_id", school.id).is("deleted_at", null).in("grade_level_id", levelIds)
      : Promise.resolve({ data: [], error: null }),
    levelIds.length
      ? schooly.from("enrollments").select("grade_level_id").eq("school_id", school.id).in("status", ["confirmed", "active"]).is("deleted_at", null).in("grade_level_id", levelIds)
      : Promise.resolve({ data: [], error: null }),
    levelIds.length
      ? schooly.from("trouvetou_reservations").select("grade_level_id").eq("school_id", school.id).eq("status", "reserved").gt("expires_at", new Date().toISOString()).in("grade_level_id", levelIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (classesErr || enrollmentsErr || reservationsErr) {
    console.error(`[trouvetou:sync] Echec lecture disponibilites pour ${school.name}:`, classesErr?.message || enrollmentsErr?.message || reservationsErr?.message);
    continue;
  }

  const capacities = {};
  const occupied = {};
  for (const row of classes || []) capacities[row.grade_level_id] = (capacities[row.grade_level_id] || 0) + (Number(row.capacity) || 0);
  for (const row of enrollments || []) occupied[row.grade_level_id] = (occupied[row.grade_level_id] || 0) + 1;
  for (const row of reservations || []) occupied[row.grade_level_id] = (occupied[row.grade_level_id] || 0) + 1;

  const niveaux = (levels || []).map((level) => {
    const capacity = capacities[level.id] || 0;
    return {
      id: level.id,
      label: level.name,
      capacity,
      prix_min: null,
      prix_max: null,
      places_disponibles: Math.max(0, capacity - (occupied[level.id] || 0)),
    };
  });

  // Règles médias Trouvetou, alignées sur la contrainte SQL
  // schools_trouvetou_gallery_max_4 / schools_trouvetou_photos_360_max_1
  // (migration 20260927005000) : 4 photos classiques au total, la photo
  // principale comprise, et une seule source 360°. On normalise d'abord — ce qui
  // écarte toute URL non http/https — puis on plafonne. L'ordre inverse
  // laisserait une URL dangereuse occuper l'une des places autorisées.
  const coverPhoto = normalizeHttpUrl(school.cover_photo_url);
  const galleryPhotos = normalizeHttpUrlList(school.gallery_photos)
    .filter((photo) => photo !== coverPhoto)
    .slice(0, coverPhoto ? 3 : 4);
  const photos360 = normalizeHttpUrlList(school.photos_360).slice(0, 1);

  const schoolPayload = {
    id: school.id,
    schooly_instance_url: instanceUrl,
    nom: school.name,
    ville: school.city,
    latitude: school.latitude,
    longitude: school.longitude,
    description_publique: school.description_publique,
    itineraire: school.itineraire,
    cover_photo: coverPhoto,
    gallery: galleryPhotos,
    photos_360: photos360,
    video_url: normalizeHttpUrl(school.video_url),
    grille_tarifaire_publique: school.grille_tarifaire_publique || [],
    contact: {
      address: school.public_address,
      phone: school.public_phone,
      email: school.public_email,
      website: normalizeHttpUrl(school.public_website_url),
    },
    highlights: Array.isArray(school.public_highlights) ? school.public_highlights : [],
    admission_notes: school.admission_notes,
    published: true,
  };

  try {
    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-trouvetou-api-key": apiKey },
      body: JSON.stringify({ school: schoolPayload, levels: niveaux }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok !== true || typeof body?.listing_id !== "string") {
      console.error(`[trouvetou:sync] Echec sync ${school.name} (${res.status}): ${body?.error || "identifiant de fiche manquant"}`);
      continue;
    }
    const { error: confirmationError } = await schooly
      .from("schools")
      .update({
        trouvetou_listing_id: body.listing_id,
        trouvetou_synced_at: new Date().toISOString(),
      })
      .eq("id", school.id);
    if (confirmationError) {
      console.error(`[trouvetou:sync] Fiche créée mais confirmation Schooly impossible pour ${school.name}: ${confirmationError.message}`);
      continue;
    }
    synced++;
    console.log(`[trouvetou:sync] OK: ${school.name} (${niveaux.length} niveaux, fiche ${body.listing_id})`);
  } catch (fetchErr) {
    console.error(`[trouvetou:sync] Echec reseau pour ${school.name}: ${fetchErr.message}`);
  }
}

console.log(`[trouvetou:sync] Termine: ${synced}/${schools.length} ecoles synchronisees.`);
if (synced < schools.length) process.exit(1);
