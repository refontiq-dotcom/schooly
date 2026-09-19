#!/usr/bin/env node
/**
 * @refontiq/billing — push-metrics.mjs
 *
 * Agrege les metriques Schooly (mode event_based) depuis Supabase puis les
 * pousse vers le Control Center (POST /api/metrics/push, Bearer METRICS_PUSH_SECRET).
 *
 * Metriques envoyees (colonnes portfolio_metrics du Control Center) :
 *   projet='schooly', nom='Schooly',
 *   mrr = total collecte (platform_fee_ledger.status='collected', product schooly),
 *   comptes_actifs = nb d'etablissements (tenant_id distincts),
 *   statut_sante = healthy si >=1 ecole facturee, warning si portefeuille
*   sans facturation, sinon unknown.
 *
 * Config via .env.local (racine schooly) :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, METRICS_PUSH_SECRET
 *   CONTROL_CENTER_URL (defaut http://localhost:3000 — adapte en prod)
 *
 * Usage : `npm run billing:metrics`
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadDotEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const pushSecret = process.env.METRICS_PUSH_SECRET;
const ccBase = (process.env.CONTROL_CENTER_URL || "http://localhost:3000").replace(/\/$/, "");

if (!supabaseUrl || !serviceRoleKey) { console.error("[billing:metrics] Supabase non configure (.env.local)."); process.exit(1); }
if (!pushSecret) { console.error("[billing:metrics] METRICS_PUSH_SECRET manquant (.env.local)."); process.exit(1); }

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: ledger, error } = await supabase
  .from("platform_fee_ledger")
  .select("amount, status, tenant_id")
  .eq("product_id", "schooly");
if (error) { console.error("[billing:metrics] Lecture ledger impossible :", error.message); process.exit(1); }

// Historique de facturation Refontiq : frais dus (inscriptions confirmees).
// En l'absence d'inscriptions confirmees en base, on expose le portefeuille
// reel : nb d'ecoles onboardes et base facturable (inscriptions actives).
const { count: schoolCount } = await supabase
  .from("schools")
  .select("id", { count: "exact", head: true })
  .is("deleted_at", null);
const { data: activeEnrollments } = await supabase
  .from("enrollments")
  .select("school_id")
  .is("deleted_at", null)
  .limit(10000);
const billableBase = (activeEnrollments || []).length;
const onboardedSchools = new Set((activeEnrollments || []).map((e) => e.school_id)).size;
const activeSchools = onboardedSchools > 0 ? onboardedSchools : (schoolCount || 0);

const collected = (ledger || []).filter((l) => l.status === "collected");
const invoiced = (ledger || []).filter((l) => l.status !== "collected");
const mrr = collected.reduce((s, l) => s + (l.amount || 0), 0);
const billedTenants = new Set((ledger || []).map((l) => l.tenant_id));
const payload = {
  projet: "schooly",
  nom: "Schooly",
  mrr,
  comptes_actifs: billedTenants.size > 0 ? billedTenants.size : activeSchools,
  statut_sante: billedTenants.size > 0 ? "healthy" : activeSchools > 0 ? "warning" : "unknown",
};
console.log(`[billing:metrics] Contexte: ${schoolCount || 0} ecole(s), ${billableBase} inscription(s) active(s), ${(ledger || []).length} ligne(s) ledger.`);
if (mrr === 0 && invoiced.length === 0 && billableBase > 0) {
  console.log("[billing:metrics] Note: aucune ligne platform_fee_ledger — le record des evenements est branche sur la confirmation d'inscription (record_billable_event).");
}

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[billing:metrics] DRY-RUN (pas de push) :", JSON.stringify(payload));
  process.exit(0);
}

const res = await fetch(`${ccBase}/api/metrics/push`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${pushSecret}` },
  body: JSON.stringify(payload),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`[billing:metrics] Push refuse (${res.status}) :`, body); process.exit(1); }
console.log("[billing:metrics] Push OK :", JSON.stringify(payload));
