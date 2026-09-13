#!/usr/bin/env node
/**
 * @refontiq/billing — sync-trouvetou.mjs
 *
 * Synchronise les ecoles publiees de Schooly vers Trouvetou via l'API HTTP
 * de Trouvetou (POST /api/v1/sync/schooly), avec la cle API du provider
 * (format `tv_live_<providerId>.<secret>`) — meme mecanisme que le
 * connecteur Sejoura. Aucun acces direct a la base Trouvetou.
 *
 * Usage : `npm run trouvetou:sync` (depuis la racine du repo)
 *
 * Config via .env.local (racine schooly) :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (connexion Schooly)
 *   TROUVETOU_SYNC_URL      → base de l'API Trouvetou (ex: https://trouvetou.vercel.app)
 *                            ou URL complete de l'endpoint (…/api/v1/sync/schooly)
 *   TROUVETOU_API_KEY       → cle API du provider Schooly (tv_live_…)
 *   TROUVETOU_INSTANCE_URL  → URL publique de cette instance Schooly (defaut https://admin.schooly.ci)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
const schoolyKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const syncUrl = (process.env.TROUVETOU_SYNC_URL || "").replace(/\/$/, "");
const apiKey = process.env.TROUVETOU_API_KEY;
const instanceUrl = process.env.TROUVETOU_INSTANCE_URL || "https://admin.schooly.ci";

if (!schoolyUrl || !schoolyKey) {
  console.error("[trouvetou:sync] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).");
  process.exit(1);
}
if (!syncUrl) {
  console.error("[trouvetou:sync] TROUVETOU_SYNC_URL requis (.env.local).");
  process.exit(1);
}
if (!apiKey) {
  console.error(
    "[trouvetou:sync] TROUVETOU_API_KEY requise (.env.local). " +
      "A generer via le SQL provider Schooly cote Trouvetou, puis executer." 
  );
  process.exit(1);
}

// L'URL peut etre la base de l'API ou l'URL complete de l'endpoint.
const ENDPOINT_SUFFIX = "/api/v1/sync/schooly";
const endpointUrl = syncUrl.endsWith(ENDPOINT_SUFFIX)
  ? syncUrl
  : `${syncUrl}${ENDPOINT_SUFFIX}`;

const schooly = createClient(schoolyUrl, schoolyKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Recuperer toutes les ecoles publiees
const { data: schools, error: schoolErr } = await schooly
  .from("schools")
  .select("id, name, city, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique")
  .eq("published_to_trouvetou", true)
  .is("deleted_at", null);

if (schoolErr) {
  console.error("[trouvetou:sync] Lecture ecoles impossible :", schoolErr.message);
  process.exit(1);
}

if (!schools || schools.length === 0) {
  console.log("[trouvetou:sync] Aucune ecole publiee a synchroniser (published_to_trouvetou = true).");
  process.exit(0);
}

let synced = 0;
for (const school of schools) {
  // Recuperer les niveaux avec places disponibles.
  // Schéma Schooly grade_levels : id, school_id, name, level, cycle (pas de capacity en base).
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
    photos_360: school.photos_360 || [],
    video_url: school.video_url,
    grille_tarifaire_publique: school.grille_tarifaire_publique || [],
    published: true,
  };

  try {
    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trouvetou-api-key": apiKey,
      },
      body: JSON.stringify({ school: schoolPayload, levels: niveaux }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok !== true) {
      console.error(`[trouvetou:sync] Echec sync ${school.name} (${res.status}): ${body?.error || "réponse inattendue"}` + (body?.code ? ` [${body.code}]` : ""));
      continue;
    }

    synced++;
    console.log(`[trouvetou:sync] OK: ${school.name} (${niveaux.length} niveaux, school_id=${body.school_id})`);
  } catch (fetchErr) {
    console.error(`[trouvetou:sync] Echec reseau pour ${school.name}: ${fetchErr.message}`);
  }
}

console.log(`[trouvetou:sync] Termine: ${synced}/${schools.length} ecoles synchronisees.`);
if (synced < schools.length) process.exit(1);
