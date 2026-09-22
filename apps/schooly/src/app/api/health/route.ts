import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Health check pour monitoring (uptime, statut DB).
 * Pas d'auth requise — ne renvoie aucune donnée sensible.
 */
export async function GET() {
  const start = Date.now();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Test DB : lecture simple
    const { error } = await supabase.from("schools").select("id").limit(1);

    const dbLatency = Date.now() - start;

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || "1.2.0",
          db: "disconnected",
          error: error.message,
        },
        { status: 503 }
      );
    }

    // Métriques outbox (best effort : ne doit jamais faire échouer le health).
    // backlog > 100 ou plus vieux message > 1h ⇒ worker ou provider en panne.
    let outboxBacklog: number | null = null;
    let outboxOldestPendingAt: string | null = null;
    try {
      const { count } = await supabase
        .from("notification_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null);
      outboxBacklog = count ?? 0;

      const { data: oldest } = await supabase
        .from("notification_outbox")
        .select("scheduled_at")
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true })
        .limit(1);
      outboxOldestPendingAt = oldest?.[0]?.scheduled_at ?? null;
    } catch {
      // Outbox indisponible : health reste vert, métriques à null.
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.2.0",
      db: "connected",
      db_latency_ms: dbLatency,
      uptime_seconds: Math.floor(process.uptime()),
      outbox_backlog: outboxBacklog,
      outbox_oldest_pending_at: outboxOldestPendingAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.2.0",
        error: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
