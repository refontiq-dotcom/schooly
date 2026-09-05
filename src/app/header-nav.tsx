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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      loggedIn = true;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      home = dashboardHomeForRole((profile?.role as UserRole | undefined) ?? "parent");
    }
  } catch { /* Supabase non configuré. */ }

  return (
    <>
      <div className="hidden items-center gap-7 lg:flex">
        <Link href="/" className="nav-link nav-link-active">Accueil</Link>
        <Link href="#fonctionnalites" className="nav-link">Fonctionnalités</Link>
        <Link href="#etablissements" className="nav-link">Établissements</Link>
        <Link href="#espaces" className="nav-link">Nos espaces</Link>
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        {loggedIn ? <><Link href={home} className="nav-outline">Mon espace</Link><form action={signOut}><button type="submit" className="nav-muted">Déconnexion</button></form></> : <><Link href="/auth" className="nav-outline">Connexion</Link><Link href="/auth" className="nav-cta">Créer un compte</Link></>}
      </div>
      <details className="relative sm:hidden">
        <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"><span className="sr-only">Ouvrir le menu</span>☰</summary>
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-2xl"><div className="grid gap-1"><Link href="/" className="mobile-nav-link">Accueil</Link><Link href="#fonctionnalites" className="mobile-nav-link">Fonctionnalités</Link><Link href="#etablissements" className="mobile-nav-link">Établissements</Link><Link href="#espaces" className="mobile-nav-link">Nos espaces</Link><div className="my-2 h-px bg-slate-100" />{loggedIn ? <><Link href={home} className="mobile-nav-link font-bold text-blue-700">Mon espace</Link><form action={signOut}><button type="submit" className="mobile-nav-link w-full text-left">Déconnexion</button></form></> : <><Link href="/auth" className="mobile-nav-link">Connexion</Link><Link href="/auth" className="mobile-nav-cta">Créer un compte</Link></>}</div></div>
      </details>
    </>
  );
}
