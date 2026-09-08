import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dashboardHomeForRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types";
import SignOutButton from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Supabase non configuré</h1>
        <p className="max-w-md text-muted">
          Renseignez <code className="rounded bg-subtle/10 px-1">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
          <code className="rounded bg-subtle/10 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans{" "}
          <code className="rounded bg-subtle/10 px-1">.env.local</code> puis relancez le serveur.
        </p>
        <Link href="/" className="text-brand underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted">Vous n&apos;êtes pas connecté.</p>
        <Link
          href="/auth"
          className="rounded-lg bg-navy px-6 py-3 font-medium text-white transition-colors hover:bg-black"
        >
          Se connecter
        </Link>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole | undefined) ?? "parent";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div>
        <h1 className="text-3xl font-bold">
          Bonjour {profile?.full_name ?? user.email}
        </h1>
        <p className="mt-2 text-muted">
          Rôle : <span className="font-medium text-navy">{role}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          Votre espace : <code className="rounded bg-subtle/10 px-1">{dashboardHomeForRole(role)}</code>
        </p>
      </div>
      <SignOutButton />
    </main>
  );
}
