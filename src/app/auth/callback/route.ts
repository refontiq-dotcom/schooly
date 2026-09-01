import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role") || "parent";
  const next = role === "admin" ? "/dashboard/admin" : "/dashboard/parent";

  // If Supabase is not configured, redirect to auth page
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}/auth?error=Configuration+manquante`);
  }

  if (code) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch (err) {
      console.error("OAuth callback error:", err);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=Erreur+de+connexion+OAuth`);
}
