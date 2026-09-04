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

export async function signInParent(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const phone = String(formData.get("phone") ?? "").trim();
  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "") || null);

  if (!phone) {
    return "Veuillez saisir votre numéro de téléphone.";
  }

  const supabase = await createClient();

  // 1. Check if phone exists in students table (parent_phone)
  const { data: studentMatch } = await supabase
    .from("students")
    .select("id")
    .ilike("parent_phone", phone)
    .limit(1)
    .maybeSingle();

  // 2. Check if phone exists in profiles table (parent role)
  let parentName = "Parent";
  let phoneFound = !!studentMatch;

  if (!phoneFound) {
    const { data: profileMatch } = await supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("phone", phone)
      .eq("role", "parent")
      .maybeSingle();

    if (profileMatch) {
      phoneFound = true;
      parentName = profileMatch.full_name || "Parent";
    }
  }

  if (!phoneFound) {
    return "Ce numéro n'est pas associé à un élève inscrit. Veuillez contacter votre établissement.";
  }

  // 3. Construct a deterministic email for this phone
  const authEmail = `${phone}@schooly.parent`;
  const defaultPassword = "Schooly2024!";

  // 4. Try to sign in — if user doesn't exist, create account first
  let { error } = await supabase.auth.signInWithOtp({
    email: authEmail,
    options: {
      emailRedirectTo: `${PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    // User doesn't exist yet — create account via admin client
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const admin = await createAdminClient();

      await admin.auth.admin.createUser({
        email: authEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { full_name: parentName, phone, role: "parent" },
      });
    } catch {
      // Account may already exist — proceed to send OTP anyway
    }

    // Retry sending the magic link
    const retry = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: `${PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (retry.error) {
      return "Impossible d'envoyer le lien de connexion. Veuillez réessayer.";
    }
  }

  // 5. Success — inform the user
  return `__SUCCESS__Lien de connexion envoyé ! Vérifiez votre boîte mail et cliquez sur le lien pour accéder à votre espace parent.`;
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
  const schoolType = String(formData.get("school_type") ?? "") as import("@/types").SchoolType | "";
  const publishToTrouvetou = String(formData.get("publish_to_trouvetou") ?? "") === "on";

  if (!name || !city) {
    return "Le nom et la ville de l'établissement sont requis.";
  }

  if (!schoolType) {
    return "Veuillez sélectionner un type d'établissement.";
  }

  const validTypes = ["primaire", "college", "lycee", "professionnel", "islamique"];
  if (!validTypes.includes(schoolType)) {
    return "Type d'établissement invalide.";
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
    p_school_type: schoolType,
  });

  if (error) {
    return error.message;
  }

  if (publishToTrouvetou) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("establishment_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.establishment_id) return "Établissement créé, mais publication Trouvetou impossible.";

    const { error: publicationError } = await supabase
      .from("establishments")
      .update({ published_to_trouvetou: true })
      .eq("id", profile.establishment_id);
    if (publicationError) return publicationError.message;
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
