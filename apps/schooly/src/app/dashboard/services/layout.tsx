"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bus, UtensilsCrossed, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/dashboard/services/transport", label: "Transport", icon: Bus },
  { href: "/dashboard/services/cantine", label: "Cantine", icon: UtensilsCrossed },
  { href: "/dashboard/services/internat", label: "Internat", icon: Building2 },
]

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Services complémentaires</h1>
        <p className="text-muted-foreground mt-1">
          Gestion du transport scolaire, de la cantine et de l'internat.
        </p>
      </div>

      {/* Onglets de navigation */}
      <nav className="flex items-center gap-1 border-b">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
