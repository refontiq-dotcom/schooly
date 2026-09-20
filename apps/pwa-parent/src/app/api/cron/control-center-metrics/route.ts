import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const cc = process.env.CONTROL_CENTER_URL?.replace(/\/$/, "");
  const pushSecret = process.env.METRICS_PUSH_SECRET?.trim();
  if (!url || !key || !cc || !pushSecret) {
    return NextResponse.json({ error: "Configuration metrics incomplète" }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [
    { data: ledger, error: ledgerError },
    { count: schoolCount, error: schoolError },
    { data: enrollments, error: enrollmentError },
  ] = await Promise.all([
    supabase.from("platform_fee_ledger").select("amount,status,tenant_id").eq("product_id", "schooly"),
    supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("enrollments").select("school_id").is("deleted_at", null).limit(10000),
  ]);

  if (ledgerError || schoolError || enrollmentError) {
    console.error("[schooly metrics cron]", { ledgerError, schoolError, enrollmentError });
    return NextResponse.json({ error: "Lecture Schooly impossible" }, { status: 500 });
  }

  const rows = ledger ?? [];
  const activeEnrollmentRows = enrollments ?? [];
  const activeSchools = new Set(activeEnrollmentRows.map((row) => row.school_id)).size || schoolCount || 0;
  const collected = rows.filter((row) => row.status === "collected");
  const mrr = collected.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const billedTenants = new Set(rows.map((row) => row.tenant_id));

  const payload = {
    projet: "schooly",
    nom: "Schooly",
    mrr,
    comptes_actifs: billedTenants.size || activeSchools,
    statut_sante: billedTenants.size || activeSchools ? (billedTenants.size ? "healthy" : "warning") : "unknown",
    details: {
      ecoles: schoolCount || 0,
      inscriptions_actives: activeEnrollmentRows.length,
      etablissements_actifs: activeSchools,
      clients_factures: billedTenants.size,
      lignes_ledger: rows.length,
      revenus_collectes: mrr,
    },
  };

  const response = await fetch(`${cc}/api/metrics/push`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${pushSecret}` },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: "Control Center rejected metrics", details: result }, { status: 502 });

  return NextResponse.json({ ok: true, payload });
}
