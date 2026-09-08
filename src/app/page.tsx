import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          School<span className="text-brand">y</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          SaaS de gestion d&apos;établissements scolaires : classes, élèves,
          paiements, documents et communication avec les parents.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/auth"
            className="rounded-lg bg-navy px-6 py-3 font-medium text-white transition-colors hover:bg-black"
          >
            Se connecter
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-navy/20 px-6 py-3 font-medium transition-colors hover:border-navy"
          >
            Tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}
