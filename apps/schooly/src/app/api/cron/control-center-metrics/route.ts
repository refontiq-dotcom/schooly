import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { describePushFailure, hasValidBearer, pushControlCenterMetrics, readConfig } from "@/lib/control-center-metrics";

export async function GET(req: Request) {
  if (!hasValidBearer(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Configuration d'abord : un défaut se voit tout de suite, sans lecture en base.
    const config = readConfig();
    const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { payload, result, attempts } = await pushControlCenterMetrics({
      supabase,
      baseUrl: config.baseUrl,
      secret: config.secret,
    });
    return NextResponse.json({
      ok: true,
      run_id: payload.run_id,
      collected_at: payload.collected_at,
      attempts,
      control_center: { status: result.status ?? null, schema: result.schema ?? null, warnings: result.warnings ?? [] },
      payload,
    });
  } catch (error) {
    const failure = describePushFailure(error);
    console.error("[schooly metrics cron]", { stage: failure.body.stage, code: failure.body.code, upstream_status: failure.body.upstream_status });
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

export const dynamic = "force-dynamic";
