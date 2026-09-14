import Link from "next/link";
import Image from "next/image";
import HeaderNav from "../header-nav";
import logo from "../../../schooly_logo_vector.svg";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="bg-white/60 backdrop-blur-sm border-b border-slate-200/50">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="Schooly, accueil" className="shrink-0">
            <Image
              src={logo}
              alt="Schooly"
              priority
              className="h-auto w-[150px] sm:w-[180px]"
            />
          </Link>
          <HeaderNav />
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200/50 py-6 text-center text-xs text-slate-400">
        Copyright Schooly {new Date().getFullYear()} &middot; Tous droits réservés
      </footer>
    </>
  );
}
