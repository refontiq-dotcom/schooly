import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { dashboardHomeForRole, safeReturnPath } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeReturnPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=Erreur+de+connexion+OAuth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=Erreur+de+connexion+OAuth`);
  }

  const { data: profile } = await supabase.rpc("ensure_own_profile");
  const role = (profile?.role as UserRole | undefined) ?? "parent";
  const destination = next || dashboardHomeForRole(role);

  return NextResponse.redirect(`${origin}${destination}`);
}
