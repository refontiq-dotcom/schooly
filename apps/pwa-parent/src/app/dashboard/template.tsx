import { DashboardPageTransition } from "@/components/dashboard-page-transition"

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <DashboardPageTransition>{children}</DashboardPageTransition>
}
