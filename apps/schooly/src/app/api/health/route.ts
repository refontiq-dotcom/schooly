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
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.2.0",
      db: "connected",
      db_latency_ms: dbLatency,
      uptime_seconds: Math.floor(process.uptime()),
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
