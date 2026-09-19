#!/usr/bin/env node
/**
 * @refontiq/billing — push-metrics.mjs
 *
 * Agrège les métriques Schooly depuis Supabase puis les pousse vers le
 * Refontiq Control Center : POST /api/metrics/push.
 *
 * Contrat envoyé :
 *   { projet, nom, mrr, comptes_actifs, statut_sante }
 *
 * Secrets/config :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, METRICS_PUSH_SECRET
 *   CONTROL_CENTER_URL
 *
 * Usage : npm run billing:metrics
 * Vérification locale : npm run billing:metrics -- --dry-run
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }

    if (!(k in process.env)) process.env[k] = v;
  }
}

loadDotEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const pushSecret = process.env.METRICS_PUSH_SECRET;
const ccBase = (process.env.CONTROL_CENTER_URL || "").replace(/\/$/, "");

if (!supabaseUrl || !secretKey) {
  console.error("[billing:metrics] Supabase non configuré (.env.local).");
  process.exit(1);
}

if (!pushSecret) {
  console.error("[billing:metrics] METRICS_PUSH_SECRET manquant.");
  process.exit(1);
}

if (!ccBase) {
  console.error("[billing:metrics] CONTROL_CENTER_URL manquant.");
  process.exit(1);
}

let parsedCcUrl;
try {
  parsedCcUrl = new URL(ccBase);
} catch {
  console.error("[billing:metrics] CONTROL_CENTER_URL invalide.");
  process.exit(1);
}

if (parsedCcUrl.protocol !== "https:" && parsedCcUrl.hostname !== "localhost") {
  console.error("[billing:metrics] CONTROL_CENTER_URL doit utiliser HTTPS en dehors du localhost.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: ledger, error } = await supabase
  .from("platform_fee_ledger")
  .select("amount, status, tenant_id")
  .eq("product_id", "schooly");

if (error) {
  console.error("[billing:metrics] Lecture ledger impossible :", error.message);
  process.exit(1);
}

const { count: schoolCount, error: schoolCountError } = await supabase
  .from("schools")
  .select("id", { count: "exact", head: true })
  .is("deleted_at", null);

if (schoolCountError) {
  console.error("[billing:metrics] Comptage écoles impossible :", schoolCountError.message);
  process.exit(1);
}

const { data: activeEnrollments, error: enrollmentsError } = await supabase
  .from("enrollments")
  .select("school_id")
  .is("deleted_at", null)
  .limit(10000);

if (enrollmentsError) {
  console.error("[billing:metrics] Lecture inscriptions impossible :", enrollmentsError.message);
  process.exit(1);
}

const activeEnrollmentRows = activeEnrollments || [];
const billableBase = activeEnrollmentRows.length;
const onboardedSchools = new Set(activeEnrollmentRows.map((e) => e.school_id)).size;
const activeSchools = onboardedSchools > 0 ? onboardedSchools : (schoolCount || 0);

const rows = ledger || [];
const collected = rows.filter((l) => l.status === "collected");
const mrr = collected.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
const billedTenants = new Set(rows.map((l) => l.tenant_id));

const payload = {
  projet: "schooly",
  nom: "Schooly",
  mrr,
  comptes_actifs: billedTenants.size > 0 ? billedTenants.size : activeSchools,
  statut_sante:
    billedTenants.size > 0
      ? "healthy"
      : activeSchools > 0
        ? "warning"
        : "unknown",
};

console.log(
  `[billing:metrics] Contexte: ${schoolCount || 0} école(s), ${billableBase} inscription(s) active(s), ${rows.length} ligne(s) ledger.`
);

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[billing:metrics] DRY-RUN (pas de push) :", JSON.stringify(payload));
  process.exit(0);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const res = await fetch(`${ccBase}/api/metrics/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pushSecret}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[billing:metrics] Push refusé (${res.status}) :`, body);
    process.exit(1);
  }

  console.log("[billing:metrics] Push OK :", JSON.stringify(payload));
} catch (error) {
  const message = error?.name === "AbortError" ? "timeout après 10s" : error?.message;
  console.error("[billing:metrics] Push impossible :", message);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
