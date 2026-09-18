"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronLeft, LogOut, Sparkles } from "lucide-react"
import { NAV_BY_ROLE, type NavItem } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type SidebarProps = {
  role: string
  schoolName: string
  userName: string
}

export function Sidebar({ role, schoolName, userName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const navItems: NavItem[] = NAV_BY_ROLE[role] ?? []

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    direction: "Direction",
    compta: "Comptabilité",
    caisse: "Caisse",
    professeur: "Enseignant",
    surveillance: "Surveillance",
  }

  return (
    <aside
      className={cn(
        "schooly-sidebar flex flex-col h-screen border-r transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 min-h-[72px]">
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-base font-semibold tracking-tight text-white truncate">{schoolName}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/55"><Sparkles className="h-3 w-3 text-primary" /> Schooly</span>
          </div>
        )}
        {collapsed && (
          <img src="/schooly_logo_vector.svg" alt="Schooly" className="h-8 w-auto mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white", !collapsed && "ml-auto")}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
          />
        </Button>
      </div>

      {/* Badge rôle */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <Badge variant="secondary" className="w-full justify-center border border-white/10 bg-white/8 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/75">
            {roleLabels[role] ?? role}
          </Badge>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                "hover:bg-white/10 hover:text-white hover:translate-x-0.5",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_8px_18px_oklch(0.53_0.17_35_/_0.23)]"
                  : "text-white/65",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Pied de page utilisateur */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="px-2 pb-2">
            <p className="text-xs font-medium text-white truncate">{userName}</p>
            <p className="mt-0.5 text-[11px] text-white/50 capitalize">{roleLabels[role]}</p>
          </div>
        )}
        <form action="/api/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            className={cn(
              "w-full text-white/60 hover:bg-white/10 hover:text-primary",
              collapsed ? "justify-center px-0" : "justify-start gap-2"
            )}
            size="sm"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Déconnexion"}
          </Button>
        </form>
      </div>
    </aside>
  )
}
