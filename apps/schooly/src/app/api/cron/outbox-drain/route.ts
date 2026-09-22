import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeCiPhone,
  renderOutboxMessage,
  retryDelayMs,
  type OutboxPayload,
} from "@/lib/outbox-templates";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

type OutboxRow = {
  id: string;
  school_id: string;
  recipient_phone: string | null;
  channel: string;
  template_key: string;
  payload: OutboxPayload;
  attempts: number;
  max_attempts: number;
};

const BATCH_SIZE = Math.min(
  Math.max(Number(process.env.OUTBOX_BATCH_SIZE ?? "25") || 25, 1),
  100
);

/**
 * GET /api/cron/outbox-drain
 *
 * Worker de la file `notification_outbox` (P2-1).
 *
 * Mode local (sans provider WhatsApp — l'API viendra plus tard) : pour
 * chaque ligne `pending` due, la route CALCULE le rendu (template + payload)
 * et le stocke en aperçu dans `error_message` (préfixe `PREVIEW`), puis la
 * passe en `failed` avec `attempts = max_attempts` (état terminal `preview`,
 * jamais replanifiée). Aucun SMS/WhatsApp n'est envoyé, aucun statut `sent`
 * n'est posé : le dashboard affiche le contenu exact qui partira le jour J.
 *
 * Quand le provider arrivera : remplacer le bloc PREVIEW par l'appel
 * WhatsApp Cloud API (déjà prête : `normalizeCiPhone` + rendu), `sent` +
 * `sent_at` en succès, retry `scheduled_at = now + 5min·2^attempts` sinon.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ error: "Configuration Supabase incomplète" }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Claim : lignes whatsapp dues, verrouillées contre les doubles exécutions
  // concurrentes (2 instances Vercel qui se chevauchent). Le filtre canal
  // dans le claim évite la starvation : des relances sms/email (moratoriums)
  // ne consomment jamais le batch du worker WhatsApp.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_outbox_batch", {
    p_limit: BATCH_SIZE,
    p_channel: "whatsapp",
  });
  if (claimError) {
    console.error("[outbox-drain] claim impossible :", claimError);
    return NextResponse.json({ error: "Claim outbox impossible" }, { status: 500 });
  }

  const rows = (claimed ?? []) as OutboxRow[];
  let previewed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    // Canaux non-whatsapp : ignorés sans erreur (pas de `failed` artificiel).
    if (row.channel !== "whatsapp") {
      skipped += 1;
      continue;
    }

    const message = renderOutboxMessage(row.template_key, row.payload ?? {});
    if (!message) {
      await supabase
        .from("notification_outbox")
        .update({
          status: "failed",
          attempts: row.max_attempts,
          error_message: `Template inconnu : ${row.template_key}`,
        })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    const phone = normalizeCiPhone(row.recipient_phone);
    if (!phone) {
      await supabase
        .from("notification_outbox")
        .update({
          status: "failed",
          attempts: row.max_attempts,
          error_message: "Numéro destinataire inexploitable — aucune tentative.",
        })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    // MODE LOCAL : aperçu stocké, état terminal `failed/preview`.
    // Le retry n'a aucun sens sans provider (réessayer ne fera pas
    // apparaître WhatsApp) → attempts = max pour ne jamais replanifier.
    // `retryDelayMs` servira au worker réel (provider) — cf. tests.
    void retryDelayMs;
    await supabase
      .from("notification_outbox")
      .update({
        status: "failed",
        attempts: row.max_attempts,
        error_message: `PREVIEW (provider WhatsApp non configuré) → ${phone} : ${message}`,
      })
      .eq("id", row.id);
    previewed += 1;
  }

  return NextResponse.json({
    ok: true,
    mode: "preview",
    claimed: rows.length,
    previewed,
    failed,
    skipped,
  });
}
