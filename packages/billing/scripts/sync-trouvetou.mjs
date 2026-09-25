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

  const niveaux = (levels || []).map((l) => ({
    id: l.id,
    label: l.name,
    capacity: 0,
    prix_min: null,
    prix_max: null,
    places_disponibles: 0,
  }));

  const schoolPayload = {
    id: school.id,
    schooly_instance_url: instanceUrl,
    nom: school.name,
    ville: school.city,
    latitude: school.latitude,
    longitude: school.longitude,
    description_publique: school.description_publique,
    itineraire: school.itineraire,
    cover_photo: normalizeHttpUrl(school.cover_photo_url),
    gallery: normalizeHttpUrlList(school.gallery_photos),
    photos_360: normalizeHttpUrlList(school.photos_360),
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
    if (!res.ok || body?.ok !== true) {
      console.error(`[trouvetou:sync] Echec sync ${school.name} (${res.status}): ${body?.error || "réponse inattendue"}`);
      continue;
    }
    synced++;
    console.log(`[trouvetou:sync] OK: ${school.name} (${niveaux.length} niveaux)`);
  } catch (fetchErr) {
    console.error(`[trouvetou:sync] Echec reseau pour ${school.name}: ${fetchErr.message}`);
  }
}

console.log(`[trouvetou:sync] Termine: ${synced}/${schools.length} ecoles synchronisees.`);
if (synced < schools.length) process.exit(1);
