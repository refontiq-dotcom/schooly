"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dashboardHomeForRole, safeReturnPath } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function signUp(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "") || null);

  if (!email || !password) {
    return "Email et mot de passe requis.";
  }
  if (!isValidEmail(email)) {
    return "Adresse email invalide.";
  }
  if (password.length < 6) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${PUBLIC_SITE_URL}/auth/callback`,
      data: {
        full_name: fullName || undefined,
        phone: phone || undefined,
      },
    },
  });

  if (error) {
    return error.message;
  }

  if (!data.user) {
    return "Une erreur est survenue lors de la création du compte. Veuillez réessayer.";
  }

  if (!data.session) {
    return "Compte créé. Vérifiez votre email pour confirmer l'inscription, puis reconnectez-vous.";
  }

  const { data: profile, error: profileError } = await supabase.rpc("ensure_own_profile");
  if (profileError) {
    return profileError.message;
  }
  const role = (profile?.role as UserRole | undefined) ?? "parent";
  redirect(returnTo || dashboardHomeForRole(role));
}

export async function signIn(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "") || null);

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

  const { data: profile, error: profileError } = await supabase.rpc("ensure_own_profile");
  if (profileError) {
    return profileError.message;
  }
  const role = (profile?.role as UserRole | undefined) ?? "parent";
  redirect(returnTo || dashboardHomeForRole(role));
}

export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${PUBLIC_SITE_URL}/auth/callback`,
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

export async function createEstablishment(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name || !city) {
    return "Le nom et la ville de l'établissement sont requis.";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?returnTo=/onboarding/etablissement");
  }

  const { error } = await supabase.rpc("create_establishment_as_admin", {
    p_name: name,
    p_city: city,
    p_address: address || null,
    p_description: description || null,
  });

  if (error) {
    return error.message;
  }

  redirect("/dashboard/admin");
}

export async function inviteStaff(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!email || !isValidEmail(email)) {
    return "Adresse email invalide.";
  }

  const allowed: UserRole[] = ["professeur", "secretariat", "censeur", "admin"];
  if (!allowed.includes(role)) {
    return "Rôle d'invitation invalide.";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "Non authentifié.";
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    return "Seul un administrateur rattaché à un établissement peut inviter du personnel.";
  }

  const { data: existing } = await supabase
    .from("staff_invitations")
    .select("id, accepted_at, expires_at")
    .eq("establishment_id", profile.establishment_id)
    .ilike("email", email)
    .is("accepted_at", null)
    .maybeSingle();

  if (existing && new Date(existing.expires_at) > new Date()) {
    return "Une invitation est déjà en cours pour cet email.";
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    const { error } = await supabase
      .from("staff_invitations")
      .update({
        role,
        token: crypto.randomUUID(),
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .eq("id", existing.id);
    if (error) return error.message;
  } else {
    const { error } = await supabase.from("staff_invitations").insert({
      establishment_id: profile.establishment_id,
      email,
      role,
      invited_by: user.id,
      expires_at: expiresAt,
    });
    if (error) {
      if (error.code === "23505") {
        return "Une invitation est déjà en cours pour cet email.";
      }
      return error.message;
    }
  }

  revalidatePath("/dashboard/admin/equipe");
  return null;
}

export async function acceptInvitation(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return "Jeton d'invitation manquant.";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?returnTo=/auth/invitation?token=${encodeURIComponent(token)}`);
  }

  const { data: profile, error } = await supabase.rpc("accept_staff_invitation", {
    p_token: token,
  });

  if (error) {
    return error.message;
  }

  const role = (profile?.role as UserRole | undefined) ?? "parent";
  redirect(dashboardHomeForRole(role));
}
