import Link from "next/link";
import Image from "next/image";
import HeaderNav from "../header-nav";
import logo from "../../../schooly_logo_vector.svg";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Schooly, accueil" className="shrink-0"><Image src={logo} alt="Schooly" priority className="h-auto w-[122px] sm:w-[145px]" /></Link>
          <HeaderNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200 bg-[#071f49] py-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2"><Image src={logo} alt="Schooly" className="h-auto w-[135px] brightness-0 invert" /><p className="mt-4 max-w-md text-sm leading-6 text-blue-100/70">La plateforme de gestion scolaire pensée pour simplifier le quotidien des établissements, enseignants, élèves et parents.</p></div>
          <div><h3 className="font-bold">Produit</h3><div className="mt-3 grid gap-2 text-sm text-blue-100/70"><Link href="#fonctionnalites">Fonctionnalités</Link><Link href="#etablissements">Établissements</Link><Link href="#espaces">Nos espaces</Link></div></div>
          <div><h3 className="font-bold">Ressources</h3><div className="mt-3 grid gap-2 text-sm text-blue-100/70"><Link href="/auth">Connexion</Link><Link href="/auth">Créer un compte</Link><span>Confidentialité</span></div></div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 px-4 pt-5 text-xs text-blue-100/50 sm:px-6 lg:px-8">© {new Date().getFullYear()} Schooly · Tous droits réservés.</div>
      </footer>
    </>
  );
}
