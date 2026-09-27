import Link from "next/link"
import type { ReactNode } from "react"

export const LEGAL_VERSION = "1.0"
export const LEGAL_EFFECTIVE_DATE = "21 septembre 2026"

const links = [
  ["Mentions légales", "/legal"],
  ["CGU / CGS", "/legal/conditions"],
  ["Confidentialité", "/legal/confidentialite"],
  ["Tarifs & facturation", "/legal/tarifs"],
  ["Sécurité & données", "/legal/securite"],
]

export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-10 border-b pb-8">
          <Link href="/" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">
            ← Schooly
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {intro && <p className="mt-3 max-w-3xl text-muted-foreground">{intro}</p>}
          <p className="mt-4 text-xs text-muted-foreground">
            Version {LEGAL_VERSION} · Entrée en vigueur : {LEGAL_EFFECTIVE_DATE}
          </p>
        </header>

        <article className="prose prose-slate max-w-none prose-headings:tracking-tight prose-a:text-primary">
          {children}
        </article>

        <nav aria-label="Documents juridiques" className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t pt-6 text-sm">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="text-muted-foreground hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
        </nav>

        <footer className="mt-8 border-t pt-6 text-sm text-muted-foreground">
          <p><strong>Refontiq</strong> · Exploitant et propriétaire de Schooly</p>
          <p>Abidjan, Côte d’Ivoire · refontiq@gmail.com · +225 01 00 37 29 00</p>
        </footer>
      </div>
    </main>
  )
}
