"use server";

import { redirect } from "next/navigation";

export type AuthMode = "login" | "register";
export type UserRole = "admin" | "parent";

function isSupabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function signUp(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as UserRole) || "parent";

  if (!email || !password) {
    return "Email et mot de passe requis.";
  }

  if (!isSupabaseConfigured()) {
    return "Supabase n'est pas configuré. Ajoutez les variables d'environnement NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
    },
  });

  if (error) {
    return error.message;
  }

  redirect(role === "admin" ? "/dashboard/admin" : "/dashboard/parent");
}

export async function signIn(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as UserRole) || "parent";

  if (!email || !password) {
    return "Email et mot de passe requis.";
  }

  if (!isSupabaseConfigured()) {
    return "Supabase n'est pas configuré. Ajoutez les variables d'environnement NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return error.message;
  }

  redirect(role === "admin" ? "/dashboard/admin" : "/dashboard/parent");
}

export async function signInWithGoogle(role: UserRole) {
  if (!isSupabaseConfigured()) {
    redirect("/auth?error=Supabase+non+configur%C3%A9");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?role=${role}`,
    },
  });

  if (error) {
    redirect("/auth?error=" + encodeURIComponent(error.message));
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
