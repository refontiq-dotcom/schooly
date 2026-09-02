import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Session = {
  supabase: SupabaseClient | null;
  user: { id: string; email?: string } | null;
  profile: Profile | null;
};

export async function getSessionProfile(): Promise<Session> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { supabase, user: null, profile: null };
    }

    const { data: ensured } = await supabase.rpc("ensure_own_profile");
    const profile = (ensured as Profile | null) ?? null;

    if (profile) {
      return { supabase, user, profile };
    }

    const { data: fallback } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return { supabase, user, profile: (fallback as Profile | null) ?? null };
  } catch {
    return { supabase: null, user: null, profile: null };
  }
}

export async function requireSessionProfile(returnTo = "/dashboard/parent") {
  const session = await getSessionProfile();
  if (!session.user || !session.supabase) {
    redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session as {
    supabase: NonNullable<Session["supabase"]>;
    user: NonNullable<Session["user"]>;
    profile: Profile | null;
  };
}
