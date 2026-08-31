import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schooly — Trouvez et réservez une place scolaire",
  description:
    "Recherchez un établissement scolaire, consultez les places disponibles en temps réel et réservez en ligne.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-navy">
              Trouve<span className="text-brand">tou</span>{" "}
              <span className="text-slate-400 font-normal text-sm align-middle">
                | Schooly
              </span>
            </a>
            <nav className="text-sm text-slate-600 flex gap-5">
              <a href="/" className="hover:text-brand">Rechercher</a>
              <a href="/dashboard/admin" className="hover:text-brand">Espace établissement</a>
              <a href="/dashboard/parent" className="hover:text-brand">Espace parent</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-slate-200 py-8 text-center text-sm text-slate-500">
          Schooly — un module Trouvetou · Refontiq, Abidjan
        </footer>
      </body>
    </html>
  );
}
