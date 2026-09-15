"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronLeft, LogOut } from "lucide-react"
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
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 border-b border-border min-h-[64px]">
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-base font-semibold truncate">{schoolName}</span>
            <img src="/schooly_logo_vector.svg" alt="Schooly" className="h-4 w-auto mt-0.5 opacity-70" />
          </div>
        )}
        {collapsed && (
          <img src="/schooly_logo_vector.svg" alt="Schooly" className="h-8 w-auto mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0", !collapsed && "ml-auto")}
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
          <Badge variant="secondary" className="text-xs w-full justify-center py-1">
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground",
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
      <div className="border-t border-border p-3">
        {!collapsed && (
          <div className="px-2 pb-2">
            <p className="text-xs font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize">{roleLabels[role]}</p>
          </div>
        )}
        <form action="/api/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            className={cn(
              "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
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
