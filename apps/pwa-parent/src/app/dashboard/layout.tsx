import { redirect } from "next/navigation"
import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { createClient } from "@/utils/supabase/server"
import { signOut } from "./actions"
import { ServiceWorkerRegister } from "@/components/service-worker-register"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <ServiceWorkerRegister />

      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-4 w-4 text-primary" />
            </span>
            <span className="font-semibold">Schooly Parent</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        Schooly — Portail Parent v0.1 · Paiement Mobile Money en attente d&apos;intégration
      </footer>
    </div>
  )
}
