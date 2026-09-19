#!/usr/bin/env node
/**
 * Schooly — Test de charge Phase 13 (pic de rentrée).
 *
 * Simule N inscriptions simultanées sur une école pour vérifier :
 * - l'absence de doublons matricule (contrainte unique),
 * - la stabilité des performances (temps de réponse p50/p95/p99),
 * - la cohérence finale (count attendu = N).
 *
 * Usage : node scripts/load-test-enrollments.mjs <schoolId> <count> <concurrency>
 *   schoolId  : UUID de l'école cible (dédoublonné en table de staging)
 *   count     : nombre total d'inscriptions à tenter (defaut 200)
 *   concurrency: lots paralleles (defaut 20)
 *
 * Variables (.env.local a la racine du workspace schooly) :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 *
 * Metriques sortiees en JSON sur stdout (syslog/metrics).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..");

// Chargement .env.local (priorite sur process.env existant)
for (const file of [resolve(REPO_ROOT, ".env.local")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.length > 1 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

const [, , schoolIdArg, countArg, concArg] = process.argv;
const schoolId = schoolIdArg || process.env.LOAD_TEST_SCHOOL_ID;
const TOTAL = Math.max(1, parseInt(countArg || "200", 10));
const CONCURRENCY = Math.max(1, Math.min(50, parseInt(concArg || "20", 10)));

if (!schoolId) {
  console.error("Usage: node scripts/load-test-enrollments.mjs <schoolId> [count] [concurrency]");
  console.error("  ou definir LOAD_TEST_SCHOOL_ID dans .env.local");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("[load-test] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY requis");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// Récupérer un grade_level valide pour l'école
const gradeRes = await fetch(`${url}/rest/v1/grade_levels?school_id=eq.${schoolId}&select=id&limit=1`, { headers });
const gradeBody = await gradeRes.json();
const gradeLevelId = gradeBody?.[0]?.id;
if (!gradeLevelId) {
  console.error(`[load-test] Aucun grade_level trouvé pour l'école ${schoolId}. Seed requis.`);
  process.exit(1);
}
console.error(`[load-test] Ecole ${schoolId}, grade_level ${gradeLevelId}, ${TOTAL} inscriptions, concurrence ${CONCURRENCY}`);

// Récupérer l'année académique en cours
const yearRes = await fetch(`${url}/rest/v1/academic_years?school_id=eq.${schoolId}&status=eq.en_cours&select=id&limit=1`, { headers });
const yearBody = await yearRes.json();
const academicYearId = yearBody?.[0]?.id;
if (!academicYearId) {
  console.error(`[load-test] Aucune année académique active (en_cours) pour l'école ${schoolId}. Seed requis.`);
  process.exit(1);
}

let _counter = 0;
function uniqueMatricule() {
  _counter++;
  return `LT${Date.now().toString(36).slice(-4)}${String(_counter).padStart(4, "0")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Schooly — Test de charge Phase 13 (pic de rentrée).
 *
 * Simule N inscriptions simultanées sur une école pour vérifier :
 * - l'absence de doublons matricule (contrainte unique),
 * - la stabilité des performances (temps de réponse p50/p95/p99),
 * - la cohérence finale (count attendu = N).
 *
 * Pour chaque inscription, crée un étudiant + tuteur + inscription (transactionnel).
 *
 * Usage : node scripts/load-test-enrollments.mjs <schoolId> <count> <concurrency>
 *   schoolId  : UUID de l'école cible
 *   count     : nombre total d'inscriptions à tenter (defaut 200)
 *   concurrency: lots paralleles (defaut 20)
 *
 * Variables (.env.local a la racine du workspace schooly) :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */

async function fetchJson(path, init = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

async function enrollOnce(i) {
  const matricule = uniqueMatricule();
  const t0 = performance.now();
  try {
    // 1. Créer étudiant
    const studentRes = await fetchJson("/students", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ school_id: schoolId, first_name: `Charge${i}`, last_name: `Test${Date.now().toString(36).slice(-4)}`, gender: i % 2 === 0 ? "M" : "F", date_of_birth: "2015-01-15" }),
    });
    if (studentRes.status !== 201 || !studentRes.body?.[0]?.id) {
      return { ok: false, status: studentRes.status, ms: performance.now() - t0, matricule, step: "student", error: JSON.stringify(studentRes.body).slice(0, 200) };
    }
    const studentId = studentRes.body[0].id;

    // 2. Créer tuteur
    const guardianRes = await fetchJson("/guardians", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ full_name: `Tuteur Charge ${i}-${Date.now().toString(36).slice(-4)}`, phone: `+225${String(700000000 + Math.floor(Math.random() * 99999999)).padStart(10, "0")}` }),
    });
    if (guardianRes.status !== 201 || !guardianRes.body?.[0]?.id) {
      return { ok: false, status: guardianRes.status, ms: performance.now() - t0, matricule, step: "guardian", error: JSON.stringify(guardianRes.body).slice(0, 200) };
    }
    const guardianId = guardianRes.body[0].id;

    // 3. Créer inscription
    const enrollRes = await fetchJson("/enrollments", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        school_id: schoolId,
        student_id: studentId,
        guardian_id: guardianId,
        grade_level_id: gradeLevelId,
        academic_year_id: academicYearId,
        matricule,
        status: "pending",
      }),
    });
    const dt = performance.now() - t0;
    const errorText = enrollRes.status === 201 ? "" : JSON.stringify(enrollRes.body).slice(0, 200);
    return { ok: enrollRes.status === 201, status: enrollRes.status, ms: dt, matricule, step: "enrollment", error: errorText };
  } catch (err) {
    return { ok: false, status: 0, ms: performance.now() - t0, matricule, step: "exception", error: err.message };
  }
}

function percentiles(sorted, pcts) {
  const out = {};
  for (const p of pcts) {
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    out[`p${p}`] = Math.round(sorted[idx]);
  }
  return out;
}

const results = [];
let inFlight = 0;
let cursor = 0;

async function worker() {
  while (cursor < TOTAL) {
    const i = cursor++;
    const r = await enrollOnce(i);
    results.push(r);
    if (results.length % 50 === 0) {
      process.stderr.write(`  ${results.length}/${TOTAL} (${results.filter((x) => x.ok).length} ok)\r`);
    }
  }
}

const start = performance.now();
const workers = Array.from({ length: CONCURRENCY }, () => worker());
await Promise.all(workers);
const totalMs = performance.now() - start;

const ok = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const dupErrors = fail.filter((r) => r.error?.includes("duplicate") || r.error?.includes("unique")).length;

const report = {
  scenario: "enrollment_burst",
  school_id: schoolId,
  total: TOTAL,
  concurrency: CONCURRENCY,
  succeeded: ok.length,
  failed: fail.length,
  duplicate_rejected: dupErrors,
  total_duration_ms: Math.round(totalMs),
  throughput_rps: Math.round((TOTAL / totalMs) * 1000),
  latency: { ...percentiles(times, [50, 90, 95, 99]), min: Math.round(times[0]), max: Math.round(times[times.length - 1]) },
  errors: fail.slice(0, 5).map((r) => ({ status: r.status, msg: r.error })),
};

console.error(`\n[load-test] ${ok.length}/${TOTAL} ok, ${fail.length} echecs (${dupErrors} doublons refuses)`);
console.log(JSON.stringify(report, null, 2));
process.exit(ok.length === TOTAL ? 0 : dupErrors === fail.length ? 0 : 1);
