import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dashboardHomeForRole } from "@/lib/auth/roles";
import { signOut } from "@/lib/auth/actions";
import type { UserRole } from "@/types";

export default async function HeaderNav() {
  let home = "/auth";
  let loggedIn = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      loggedIn = true;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      home = dashboardHomeForRole((profile?.role as UserRole | undefined) ?? "parent");
    }
  } catch {
    // Supabase not configured
  }

  return (
    <nav className="text-sm text-slate-600 flex gap-5 items-center">
      <Link href="/" className="hover:text-amber-600 transition-colors">
        Accueil
      </Link>
      {loggedIn ? (
        <>
          <Link href={home} className="hover:text-amber-600 transition-colors">
            Mon espace
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-slate-500 hover:text-amber-600">
              Déconnexion
            </button>
          </form>
        </>
      ) : (
        <Link href="/auth" className="btn-primary text-sm py-2 px-4">
          Connexion
        </Link>
      )}
    </nav>
  );
}
