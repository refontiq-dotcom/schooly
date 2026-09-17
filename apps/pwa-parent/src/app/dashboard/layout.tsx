import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { DashboardShell } from "@/components/dashboard-shell"

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
    <>
      <ServiceWorkerRegister />
      <DashboardShell>{children}</DashboardShell>
    </>
  )
}
