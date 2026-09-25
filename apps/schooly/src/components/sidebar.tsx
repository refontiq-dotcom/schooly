"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
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
  const reduceMotion = useReducedMotion()

  const activeHref = navItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const roleLabels: Record<string, string> = {
    direction: "Direction",
    secretariat: "Secrétariat",
    compta: "Comptabilité",
    caisse: "Caisse",
    professeur: "Enseignant",
    surveillance: "Surveillance",
  }

  return (
    <aside
      className={cn(
        "schooly-sidebar flex h-full shrink-0 flex-col overflow-hidden rounded-2xl border transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex min-h-[72px] items-center justify-between border-b border-white/10 p-4">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: reduceMotion ? 0 : .18 }}
              className="flex min-w-0 flex-col"
            >
              <span className="truncate text-base font-semibold tracking-tight text-white">{schoolName}</span>
              <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/55">
                <Sparkles className="h-3 w-3 text-primary" /> Schooly
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <Image src="/schooly_logo_vector.svg" alt="Schooly" width={182} height={32} unoptimized className="mx-auto h-8 w-auto" />
        )}

        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white", !collapsed && "ml-auto")}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
        </Button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-1 pt-3">
          <Badge
            variant="secondary"
            className="w-full justify-center border border-white/10 bg-white/8 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/75"
          >
            {roleLabels[role] ?? role}
          </Badge>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const isActive = activeHref === item.href
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative isolate flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                "hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
                isActive ? "text-primary-foreground" : "text-white/65",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="schooly-sidebar-active"
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-xl bg-primary shadow-[0_8px_18px_oklch(0.53_0.17_35_/_0.23)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: .7 }}
                />
              )}
              <item.icon className="relative z-10 h-4 w-4 shrink-0" />
              {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="px-2 pb-2">
            <p className="truncate text-xs font-medium text-white">{userName}</p>
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
