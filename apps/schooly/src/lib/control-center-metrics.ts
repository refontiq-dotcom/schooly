import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

// ============================================================================
// Envoi des métriques de Schooly vers le Control Center — contrat v1.
// Référence : docs/contracts/metrics-push-v1.md (dépôt refontiq-control-center).
//
// Modèle de revenu de Schooly (décision du propriétaire) : 1 000 F PAR ÉLÈVE, une fois
// par année scolaire, à l'inscription confirmée. Ce n'est PAS un revenu récurrent : on
// n'envoie donc AUCUN « mrr » (champ absent = valeur précédente conservée côté récepteur).
//
// Argent réellement reçu = factures PAYÉES (platform_invoices.paid_amount), et non le statut
// des lignes du grand livre : mark_fees_collected ne met à jour les lignes que si leur
// period_label correspond, or il n'est jamais renseigné (voir docs de la PR).
// ============================================================================

export type PushStage = "config" | "collect" | "send" | "rejected";
export type Issue = { path: string; message: string };

export class ControlCenterPushError extends Error {
  readonly stage: PushStage;
  readonly code: string;
  readonly upstreamStatus?: number;
  readonly upstreamCode?: string;
  readonly issues?: Issue[];
  readonly missing?: string[];
  readonly attempts?: number;
  constructor(
    stage: PushStage,
    code: string,
    message: string,
    extra: { upstreamStatus?: number; upstreamCode?: string; issues?: Issue[]; missing?: string[]; attempts?: number } = {}
  ) {
    super(message);
    this.name = "ControlCenterPushError";
    this.stage = stage;
    this.code = code;
    Object.assign(this, extra);
  }
}

// Sous-ensemble minimal du client Supabase, pour pouvoir le simuler en test.
export type SupabaseLike = { from: (table: string) => any };

type Deps = {
  supabase: SupabaseLike;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  runId?: () => string;
};

const PAGE_SIZE = 1000; // plafond de lignes par réponse imposé par Supabase
const MAX_PAGES = 500; // garde-fou : 500 000 lignes
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function hasValidBearer(header: string | null, expected: string | undefined): boolean {
  const secret = expected?.trim();
  if (!secret || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return Boolean(match) && safeEqual(match![1].trim(), secret);
}

export function currentEnvironment(): "production" | "preview" | "development" {
  const v = process.env.VERCEL_ENV;
  if (v === "production" || v === "preview" || v === "development") return v;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/** Vérifie TOUTE la configuration d'abord et nomme les variables manquantes (jamais leur valeur). */
export function readConfig(): { supabaseUrl: string; supabaseKey: string; baseUrl: string; secret: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const url = process.env.CONTROL_CENTER_URL?.trim();
  const secret = process.env.METRICS_PUSH_SECRET?.trim();
  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !supabaseKey && "SUPABASE_SECRET_KEY",
    !url && "CONTROL_CENTER_URL",
    !secret && "METRICS_PUSH_SECRET",
  ].filter(Boolean) as string[];
  if (missing.length) {
    throw new ControlCenterPushError("config", "configuration_missing", `Variable(s) d'environnement manquante(s) : ${missing.join(", ")}`, { missing });
  }
  let parsed: URL;
  try {
    parsed = new URL(url as string);
  } catch {
    throw new ControlCenterPushError("config", "invalid_url", "CONTROL_CENTER_URL n'est pas une URL valide", { missing: ["CONTROL_CENTER_URL"] });
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new ControlCenterPushError("config", "insecure_url", "CONTROL_CENTER_URL doit être en https", { missing: ["CONTROL_CENTER_URL"] });
  }
  return {
    supabaseUrl: supabaseUrl as string,
    supabaseKey: supabaseKey as string,
    baseUrl: parsed.origin + parsed.pathname.replace(/\/$/, ""),
    secret: secret as string,
  };
}

/** Lit TOUTES les lignes par pages de 1000 : sans cela Supabase tronquerait en silence. */
async function fetchAll<T>(table: string, build: (page: { from: number; to: number }) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await build({ from: page * PAGE_SIZE, to: page * PAGE_SIZE + PAGE_SIZE - 1 });
    if (error) throw new ControlCenterPushError("collect", "source_unavailable", `Lecture de la source impossible (${table}) — code ${(error as { code?: string }).code ?? "inconnu"}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new ControlCenterPushError("collect", "too_many_rows", `Trop de lignes à lire (${table}) : plus de ${MAX_PAGES * PAGE_SIZE}`);
}

async function countRows(supabase: SupabaseLike, table: string, apply: (q: any) => any): Promise<number> {
  const { count, error } = await apply(supabase.from(table).select("id", { count: "exact", head: true }));
  if (error) throw new ControlCenterPushError("collect", "source_unavailable", `Lecture de la source impossible (${table}) — code ${(error as { code?: string }).code ?? "inconnu"}`);
  return count ?? 0;
}

const sum = (rows: Array<Record<string, unknown>>, key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

export async function collect(supabase: SupabaseLike) {
  const [ledger, invoices, schools, enrTotal, enrPending, enrConfirmed, enrActive] = await Promise.all([
    fetchAll<{ amount: number; status: string; tenant_id: string }>("platform_fee_ledger", ({ from, to }) =>
      supabase.from("platform_fee_ledger").select("amount,status,tenant_id").eq("product_id", "schooly").order("id").range(from, to)
    ),
    fetchAll<{ status: string; total_due: number; paid_amount: number | null; tenant_id: string }>("platform_invoices", ({ from, to }) =>
      supabase.from("platform_invoices").select("status,total_due,paid_amount,tenant_id").eq("product_id", "schooly").order("id").range(from, to)
    ),
    countRows(supabase, "schools", (q) => q.is("deleted_at", null)),
    countRows(supabase, "enrollments", (q) => q.is("deleted_at", null)),
    countRows(supabase, "enrollments", (q) => q.is("deleted_at", null).eq("status", "pending")),
    countRows(supabase, "enrollments", (q) => q.is("deleted_at", null).eq("status", "confirmed")),
    countRows(supabase, "enrollments", (q) => q.is("deleted_at", null).eq("status", "active")),
  ]);

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const open = invoices.filter((i) => i.status === "pending" || i.status === "overdue");
  const generated = sum(ledger, "amount");
  const collected = sum(paidInvoices, "paid_amount");
  const billedTenants = new Set(ledger.map((r) => r.tenant_id));

  return {
    fraisGeneres: generated,
    fraisEncaisses: collected,
    // jamais négatif : si une facture encaissée dépasse les frais enregistrés, on n'invente pas de « crédit »
    fraisAEncaisser: Math.max(0, generated - collected),
    facturesOuvertesMontant: sum(open, "total_due"),
    facturesEnRetard: invoices.filter((i) => i.status === "overdue").length,
    inscriptionsFacturables: ledger.length,
    inscriptionsTotal: enrTotal,
    inscriptionsEnAttente: enrPending,
    inscriptionsConfirmees: enrConfirmed,
    inscriptionsActives: enrActive,
    ecoles: schools,
    clientsFactures: billedTenants.size,
  };
}
export type SourceMetrics = Awaited<ReturnType<typeof collect>>;

export function buildPayload(src: SourceMetrics, meta: { collectedAt: Date; runId: string; environment: ReturnType<typeof currentEnvironment> }) {
  const accounts = src.clientsFactures || src.ecoles;
  return {
    contract_version: 1 as const,
    projet: "schooly" as const,
    nom: "Schooly",
    environment: meta.environment,
    collected_at: meta.collectedAt.toISOString(),
    run_id: meta.runId,
    statut_sante: accounts ? (src.clientsFactures ? ("healthy" as const) : ("warning" as const)) : ("unknown" as const),
    // PAS de « mrr » : revenu par inscription, non récurrent (voir en-tête).
    comptes_actifs: accounts,
    details: {
      frais_generes: src.fraisGeneres,
      frais_encaisses: src.fraisEncaisses,
      frais_a_encaisser: src.fraisAEncaisser,
      factures_ouvertes_montant: src.facturesOuvertesMontant,
      factures_en_retard: src.facturesEnRetard,
      inscriptions_facturables: src.inscriptionsFacturables,
      inscriptions_total: src.inscriptionsTotal,
      inscriptions_en_attente: src.inscriptionsEnAttente,
      inscriptions_confirmees: src.inscriptionsConfirmees,
      inscriptions_actives: src.inscriptionsActives,
      ecoles: src.ecoles,
      clients_factures: src.clientsFactures,
    },
    // Ancien champ, conservé pour un récepteur qui n'aurait pas encore le contrat v1.
    timestamp: meta.collectedAt.toISOString(),
  };
}
export type MetricsPayload = ReturnType<typeof buildPayload>;

const clean = (v: unknown, max = 200) => String(v ?? "").replace(/\s+/g, " ").slice(0, max);

export async function pushControlCenterMetrics(deps: Deps & { baseUrl: string; secret: string }) {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const doFetch = deps.fetchImpl ?? fetch;

  const src = await collect(deps.supabase);
  const payload = buildPayload(src, { collectedAt: now(), runId: (deps.runId ?? randomUUID)(), environment: currentEnvironment() });
  const body = JSON.stringify(payload); // MÊME corps à chaque tentative → relance idempotente

  let last: ControlCenterPushError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await doFetch(`${deps.baseUrl}/api/metrics/push`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${deps.secret}` },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timeout = (error as Error)?.name === "TimeoutError" || (error as Error)?.name === "AbortError";
      last = new ControlCenterPushError("send", timeout ? "timeout" : "network_error", timeout ? `Aucune réponse du Control Center en ${REQUEST_TIMEOUT_MS / 1000} s` : "Control Center injoignable", { attempts: attempt });
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      continue;
    }
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { payload, result, attempts: attempt };

    const upstreamCode = typeof result.code === "string" ? result.code : `http_${response.status}`;
    const issues = Array.isArray(result.issues)
      ? (result.issues as Issue[]).slice(0, 10).map((i) => ({ path: clean(i.path, 80), message: clean(i.message, 120) }))
      : undefined;
    const rejected = new ControlCenterPushError("rejected", "control_center_rejected", `Control Center a refusé l'envoi : HTTP ${response.status} (${upstreamCode})`, {
      upstreamStatus: response.status,
      upstreamCode,
      issues,
      attempts: attempt,
    });
    const transient = response.status === 429 || response.status >= 500;
    if (!transient || attempt === MAX_ATTEMPTS) throw rejected;
    last = rejected;
    await sleep(RETRY_DELAY_MS);
  }
  throw last as ControlCenterPushError;
}

export function describePushFailure(error: unknown): { status: number; body: Record<string, unknown> } {
  if (!(error instanceof ControlCenterPushError)) {
    return { status: 500, body: { ok: false, stage: "unknown", code: "internal_error", message: "Erreur interne inattendue" } };
  }
  const status = error.stage === "config" ? 503 : error.stage === "collect" ? 500 : error.stage === "send" ? (error.code === "timeout" ? 504 : 502) : 502;
  return {
    status,
    body: {
      ok: false,
      stage: error.stage,
      code: error.code,
      message: error.message,
      ...(error.missing && { missing: error.missing }),
      ...(error.upstreamStatus !== undefined && { upstream_status: error.upstreamStatus, upstream_code: error.upstreamCode }),
      ...(error.issues && { issues: error.issues }),
      ...(error.attempts !== undefined && { attempts: error.attempts }),
    },
  };
}
