#!/usr/bin/env node
/**
 * @refontiq/billing — sync-config.mjs
 *
 * Synchronise la configuration billing du produit Schooly depuis les
 * variables d'environnement vers la table `billing_configs` (Supabase).
 *
 * Source : `.env.local` à la racine du monorepo schooly
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (connexion DB)
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_ADMIN_URL
 *   WAVE_MERCHANT_ID, WAVE_WEBHOOK_SECRET
 *
 * Usage : `npm run billing:sync` (depuis la racine du repo)
 *
 * Règles :
 * - Idempotent : upsert sur `product_id = 'schooly'`.
 * - Ne persiste JAMAIS un placeholder : si WAVE_WEBHOOK_SECRET vaut
 *   "votre_wave_webhook_secret" (ou vide), la colonne existante est conservée.
 * - Les secrets restent dans `.env.local` (jamais commités).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
// scripts/ est dans packages/billing/scripts → racine repo = ../../..
const REPO_ROOT = resolve(here, "..", "..", "..");

const PLACEHOLDERS = new Set(["", "votre_wave_webhook_secret", "changeme", "xxx"]);

function loadDotEnvLocal() {
  const env = {};
  for (const file of [resolve(REPO_ROOT, ".env.local")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
      env[key] = process.env[key] ?? value;
    }
  }
  return env;
}

const env = loadDotEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[billing:sync] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY sont requis (.env.local)."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing, error: readError } = await supabase
  .from("billing_configs")
  .select("*")
  .eq("product_id", "schooly")
  .maybeSingle();

if (readError) {
  console.error("[billing:sync] Lecture billing_configs impossible :", readError.message);
  process.exit(1);
}

const pick = (value, fallback) => {
  const v = (value ?? "").trim();
  if (PLACEHOLDERS.has(v)) return fallback;
  return v;
};

const payload = {
  product_id: "schooly",
  name: "Schooly",
  mode: "event_based",
  currency: "XOF",
  event_amount: 1000,
  event_types: ["enrollment_confirmed"],
  wave_merchant_id: pick(env.WAVE_MERCHANT_ID, existing?.wave_merchant_id ?? "M_ci_RImDyQYI8ccj"),
  wave_webhook_secret: pick(env.WAVE_WEBHOOK_SECRET, existing?.wave_webhook_secret ?? null),
  telegram_bot_token: pick(env.TELEGRAM_BOT_TOKEN, existing?.telegram_bot_token ?? null),
  telegram_chat_id: pick(env.TELEGRAM_CHAT_ID, existing?.telegram_chat_id ?? null),
  telegram_admin_url: pick(
    env.TELEGRAM_ADMIN_URL,
    existing?.telegram_admin_url ?? "https://admin.schooly.ci/billing"
  ),
  is_active: true,
  updated_at: new Date().toISOString(),
};

const missing = ["telegram_bot_token", "telegram_chat_id"].filter((k) => !payload[k]);
if (missing.length > 0) {
  console.error(
    `[billing:sync] Secrets Telegram manquants (ni .env.local ni DB) : ${missing.join(", ")}. ` +
      "Renseignez TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID dans .env.local."
  );
  process.exit(1);
}

const { data, error } = await supabase
  .from("billing_configs")
  .upsert(payload, { onConflict: "product_id" })
  .select("product_id, name, mode, currency, event_amount, wave_merchant_id, telegram_chat_id, telegram_admin_url, is_active")
  .single();

if (error) {
  console.error("[billing:sync] Upsert impossible :", error.message);
  process.exit(1);
}

const masked = { ...data, telegram_chat_id: data.telegram_chat_id ? "***" : null };
console.log("[billing:sync] billing_configs['schooly'] synchronisée :");
console.log(JSON.stringify(masked, null, 2));
console.log(
  `[billing:sync] webhook Wave : ${payload.wave_webhook_secret ? "configuré" : "non configuré (en attente API Wave)"}`
);
