"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthMode = "login" | "register";
export type UserRole = "admin" | "parent";

export async function signUp(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as UserRole;

  if (!email || !password) {
    return "Email et mot de passe requis.";
  }

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
  const role = formData.get("role") as UserRole;

  if (!email || !password) {
    return "Email et mot de passe requis.";
  }

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
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
