import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null as Profile | null };
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
}
