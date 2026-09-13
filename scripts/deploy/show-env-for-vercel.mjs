#!/usr/bin/env node
/**
 * Affiche les variables d'environnement à copier dans Vercel.
 * Usage : node scripts/deploy/show-env-for-vercel.mjs
 *
 * Copiez chaque ligne dans Vercel → Settings → Environment Variables
 * pour Production + Preview.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", "..", ".env.local");

const WANT = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_ADMIN_URL",
  "WAVE_MERCHANT_ID",
  "WAVE_WEBHOOK_SECRET",
  "TROUVETOU_API_KEY",
  "METRICS_PUSH_SECRET",
  "CONTROL_CENTER_URL",
  "SENTRY_DSN",
];

const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

console.log("=== Variables à copier dans Vercel (Production + Preview) ===\n");
for (const key of WANT) {
  const val = env[key];
  if (val === undefined) {
    console.log(`${key}=<MANQUANT-DANS-.env.local>`);
  } else if (val === "") {
    console.log(`${key}=<VIDE>`);
  } else {
    const display = val.length > 40 ? val.slice(0, 12) + "..." + val.slice(-6) : val;
    console.log(`${key}=${display}`);
  }
}

console.log("\n=== Vérifications ===");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
console.log("  Clé anon JWT valide :", anon.startsWith("eyJhbGciOiJIUzI1NiIs") ? "✅" : "❌");
console.log("  URL Supabase présente :", env.NEXT_PUBLIC_SUPABASE_URL?.includes(".supabase.co") ? "✅" : "❌");
console.log("  Service role key présente :", env.SUPABASE_SERVICE_ROLE_KEY ? "✅" : "❌");
