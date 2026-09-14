import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { dashboardHomeForRole, safeReturnPath } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const next = safeReturnPath(searchParams.get("next"));

  // OAuth / PKCE error params (Supabase redirect with error + error_description)
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const errorDesc =
      searchParams.get("error_description") || "Erreur de connexion OAuth";
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(errorDesc)}`,
    );
  }

  const supabase = await createClient();

  // Email confirmation flow (token_hash) — Supabase env. older token-based links
  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (verifyError) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent("Erreur de confirmation d'email")}`,
      );
    }
  } else if (code) {
    // OAuth or PKCE (email confirmation with code)
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent("Erreur de connexion OAuth")}`,
      );
    }
  } else {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent("Paramètres de connexion manquants")}`,
    );
  }

  const { data: profile, error: profileError } = await supabase.rpc(
    "ensure_own_profile",
  );
  if (profileError) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(profileError.message)}`,
    );
  }

  const role = (profile?.role as UserRole | undefined) ?? "parent";
  const destination = next || dashboardHomeForRole(role);

  return NextResponse.redirect(`${origin}${destination}`);
}
