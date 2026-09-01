import type { Metadata } from "next";
import Link from "next/link";
import HeaderNav from "./header-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schooly",
  description:
    "Inscriptions en ligne, suivi des présences, notes et communication avec les parents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        <header className="bg-white/60 backdrop-blur-sm border-b border-slate-200/50">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-800 tracking-tight">
              Schooly
            </Link>
            <HeaderNav />
          </div>
        </header>
        <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200/50 py-6 text-center text-xs text-slate-400">
          Copyright Schooly {new Date().getFullYear()} &middot; Tous droits réservés
        </footer>
      </body>
    </html>
  );
}
