#!/usr/bin/env node
/**
 * Schooly — Export complet d'un établissement
 *
 * Usage :
 *   node scripts/backup/export-school.mjs --school-id <uuid> --output backup.json
 *
 * Exporte toutes les données configurables d'une école :
 *   - Structure académique (années, niveaux, classes, matières)
 *   - Fournitures (checklist items)
 *   - Moyens de paiement
 *   - Documents requis
 *   - Frais scolaires (fee_schedules)
 *   - Profils financiers
 *   - Paramètres de l'école
 *
 * Les données sensibles (mots de passe, tokens) ne sont PAS exportées.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..");

// Charger .env.local
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
const schoolIdIdx = args.indexOf("--school-id");
const outputIdx = args.indexOf("--output");

if (schoolIdIdx === -1 || outputIdx === -1) {
  console.error("Usage: node export-school.mjs --school-id <uuid> --output <file.json>");
  process.exit(1);
}

const schoolId = args[schoolIdIdx + 1];
const outputFile = args[outputIdx + 1];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const tables = [
  "academic_years",
  "grade_levels",
  "classes",
  "subjects",
  "class_subject_assignments",
  "enrollment_checklist_items",
  "school_payment_methods",
  "required_documents",
  "fee_schedules",
  "financial_profiles",
  "school_features",
];

const exportData = {
  version: "1.2",
  exported_at: new Date().toISOString(),
  school_id: schoolId,
  data: {},
};

for (const table of tables) {
  const { data, error } = await supabase.from(table).select("*").eq("school_id", schoolId);
  if (error) {
    console.error(`[export] Erreur ${table}:`, error.message);
    continue;
  }
  exportData.data[table] = data || [];
  console.log(`[export] ${table}: ${data?.length || 0} lignes`);
}

// Infos de l'école (sans secrets)
const { data: school } = await supabase
  .from("schools")
  .select("id, name, city, school_type, academic_year_id, mena_code, drena_code")
  .eq("id", schoolId)
  .maybeSingle();

exportData.school = school || null;

writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
console.log(`[export] Terminé → ${outputFile}`);
