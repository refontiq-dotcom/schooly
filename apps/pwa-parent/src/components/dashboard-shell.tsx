"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Gauge,
  GraduationCap,
  Headphones,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  WalletCards,
  X,
} from "lucide-react"
import { signOut } from "@/app/dashboard/actions"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Investissements", href: "/dashboard", icon: BarChart3 },
  { label: "Caisse", href: "/dashboard", icon: CircleDollarSign },
  { label: "Wallet", href: "/dashboard", icon: WalletCards },
  { label: "Notes", href: "/dashboard/bulletin", icon: GraduationCap },
  { label: "Réglages", href: "/dashboard", icon: Settings },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem("schooly-dashboard-theme")
    setDark(saved ? saved === "dark" : true)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.dataset.dashboardTheme = dark ? "dark" : "light"
    window.localStorage.setItem("schooly-dashboard-theme", dark ? "dark" : "light")
  }, [dark, mounted])

  const themeClass = dark ? "dashboard-dark" : "dashboard-light"

  return (
    <div className={`schooly-dashboard-shell ${themeClass}`}>
      <div className="dashboard-orbit dashboard-orbit-one" />
      <div className="dashboard-orbit dashboard-orbit-two" />

      <button
        type="button"
        className="dashboard-mobile-menu"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
      >
        {mobileOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="dashboard-mobile-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`dashboard-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="dashboard-brand">
          <span className="dashboard-brand-mark"><GraduationCap size={18} /></span>
          {!collapsed && (
            <span className="dashboard-brand-copy">
              <strong>Schooly</strong>
              <small>NEED GROUP</small>
            </span>
          )}
        </div>

        <nav className="dashboard-nav" aria-label="Navigation principale">
          {navItems.map(({ label, href, icon: Icon }, index) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`dashboard-nav-item ${index === 0 ? "is-active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={15} strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        <div className="dashboard-sidebar-bottom">
          {!collapsed && (
            <Link href="/dashboard/moratorium" className="dashboard-support-card">
              <span className="dashboard-support-icon"><Headphones size={14} /></span>
              <span><strong>Besoin d'aide ?</strong><small>Contacter Schooly</small></span>
            </Link>
          )}
          <form action={signOut}>
            <button className="dashboard-logout" type="submit" title="Déconnexion">
              <LogOut size={14} />
              {!collapsed && <span>Déconnexion</span>}
            </button>
          </form>
        </div>
      </aside>

      <div className={`dashboard-main ${collapsed ? "sidebar-collapsed" : ""}`}>
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button
              type="button"
              className="dashboard-icon-button desktop-only"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <div className="dashboard-select-pill"><span>FCFA</span><ChevronDown size={12} /></div>
            <div className="dashboard-select-pill"><span>FR</span><ChevronDown size={12} /></div>
          </div>

          <div className="dashboard-topbar-right">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={() => setDark((value) => !value)}
              aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
            >
              <span className="theme-icon-swap">{dark ? <Sun size={15} /> : <Moon size={15} />}</span>
            </button>
            <button type="button" className="dashboard-icon-button" aria-label="Notifications">
              <CreditCard size={15} />
            </button>
            <div className="dashboard-user-pill">
              <span className="dashboard-user-name">Portail Parent</span>
              <span className="dashboard-avatar"><GraduationCap size={13} /></span>
            </div>
          </div>
        </header>

        <main className="dashboard-content">{children}</main>

        <footer className="dashboard-footer">
          Schooly — Portail Parent v0.1 · Paiement Mobile Money en attente d&apos;intégration
        </footer>
      </div>
    </div>
  )
}
