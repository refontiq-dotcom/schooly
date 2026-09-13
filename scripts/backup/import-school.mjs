#!/usr/bin/env node
/**
 * Schooly — Import des données d'un établissement
 *
 * Usage :
 *   node scripts/backup/import-school.mjs --input backup.json --target-school-id <uuid>
 *
 * Importe les données exportées par export-school.mjs dans une NOUVELLE école.
 * Les UUID sont régénérés pour éviter les conflits.
 *
 * Options :
 *   --dry-run  : affiche ce qui serait importé sans écrire en base
 *   --skip-existing : ignore les entrées déjà existantes (par nom)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..");

for (const file of [resolve(REPO_ROOT, ".env.local")]) {
  try {
    const content = await import("node:fs").then((fs) => fs.readFileSync(file, "utf8"));
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}

const args = process.argv.slice(2);
const inputIdx = args.indexOf("--input");
const targetIdx = args.indexOf("--target-school-id");
const dryRun = args.includes("--dry-run");
const skipExisting = args.includes("--skip-existing");

if (inputIdx === -1 || targetIdx === -1) {
  console.error("Usage: node import-school.mjs --input <file.json> --target-school-id <uuid> [--dry-run] [--skip-existing]");
  process.exit(1);
}

const inputFile = args[inputIdx + 1];
const targetSchoolId = args[targetIdx + 1];

const exportData = JSON.parse(readFileSync(inputFile, "utf8"));

if (exportData.version !== "1.2") {
  console.warn(`[import] Version ${exportData.version} détectée (attendu 1.2)`);
}

console.log(`[import] Source: ${exportData.school?.name || "inconnu"} (${exportData.school_id})`);
console.log(`[import] Cible: ${targetSchoolId}`);
console.log(`[import] Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const idMap = new Map(); // ancien_id → nouvel_id

const importOrder = [
  "enrollment_checklist_items",
  "school_payment_methods",
  "required_documents",
  "fee_schedules",
  "financial_profiles",
  "school_features",
  "academic_years",
  "grade_levels",
  "classes",
  "subjects",
  "class_subject_assignments",
];

for (const table of importOrder) {
  const rows = exportData.data[table] || [];
  if (rows.length === 0) continue;

  console.log(`[import] ${table}: ${rows.length} lignes...`);

  for (const row of rows) {
    const newId = randomUUID();
    const oldId = row.id;

    const newRow = {
      ...row,
      id: newId,
      school_id: targetSchoolId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (dryRun) {
      console.log(`  [dry-run] ${table}: ${row.name || row.nom || oldId} → ${newId}`);
      idMap.set(oldId, newId);
      continue;
    }

    const { error } = await supabase.from(table).insert(newRow);
    if (error) {
      if (skipExisting && error.code === "23505") {
        console.log(`  [skip] ${table}: ${row.name || row.nom} (doublon)`);
      } else {
        console.error(`  [erreur] ${table}:`, error.message);
      }
    } else {
      idMap.set(oldId, newId);
    }
  }
}

console.log(`[import] Terminé. ${idMap.size} IDs mappés.`);
