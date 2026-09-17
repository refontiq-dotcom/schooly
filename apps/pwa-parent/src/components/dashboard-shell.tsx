"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  BarChart3,
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

const currencyOptions = ["FCFA", "EUR", "USD"]
const languageOptions = ["FR", "EN"]

function DashboardDropdown({
  label,
  options,
  value,
  open,
  onToggle,
  onSelect,
}: {
  label: string
  options: string[]
  value: string
  open: boolean
  onToggle: () => void
  onSelect: (value: string) => void
}) {
  return (
    <div className="dashboard-dropdown">
      <button
        type="button"
        className={`dashboard-select-pill ${open ? "is-open" : ""}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span>{value}</span>
        <ChevronDown className="dashboard-select-chevron" size={12} />
      </button>

      <div
        className={`dashboard-dropdown-menu ${open ? "is-open" : ""}`}
        role="listbox"
        aria-label={label}
        aria-hidden={!open}
      >
        <div className="dashboard-dropdown-menu-inner">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              tabIndex={open ? 0 : -1}
              className={`dashboard-dropdown-option ${option === value ? "is-selected" : ""}`}
              onClick={() => onSelect(option)}
            >
              <span>{option}</span>
              <span className="dashboard-dropdown-check" aria-hidden="true">✓</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dark, setDark] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<"currency" | "language" | null>(null)
  const [currency, setCurrency] = useState("FCFA")
  const [language, setLanguage] = useState("FR")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem("schooly-dashboard-theme")
    setDark(saved ? saved === "dark" : true)
    setCurrency(window.localStorage.getItem("schooly-dashboard-currency") || "FCFA")
    setLanguage(window.localStorage.getItem("schooly-dashboard-language") || "FR")
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.dataset.dashboardTheme = dark ? "dark" : "light"
    window.localStorage.setItem("schooly-dashboard-theme", dark ? "dark" : "light")
  }, [dark, mounted])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem("schooly-dashboard-currency", currency)
    window.localStorage.setItem("schooly-dashboard-language", language)
  }, [currency, language, mounted])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false)
        setOpenDropdown(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setOpenDropdown(null)
  }, [pathname])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  const themeClass = dark ? "dashboard-dark" : "dashboard-light"

  return (
    <div className={`schooly-dashboard-shell ${themeClass}`}>
      <div className="dashboard-orbit dashboard-orbit-one" />
      <div className="dashboard-orbit dashboard-orbit-two" />

      <button
        type="button"
        className={`dashboard-mobile-menu ${mobileOpen ? "is-open" : ""}`}
        onClick={() => setMobileOpen((value) => !value)}
        aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={mobileOpen}
      >
        <span className="dashboard-menu-icon dashboard-menu-icon-menu"><Menu size={19} /></span>
        <span className="dashboard-menu-icon dashboard-menu-icon-close"><X size={19} /></span>
      </button>

      <button
        type="button"
        className={`dashboard-mobile-backdrop ${mobileOpen ? "is-visible" : ""}`}
        aria-label="Fermer le menu"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`dashboard-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="dashboard-brand">
          <span className="dashboard-brand-mark"><GraduationCap size={18} /></span>
          <span className={`dashboard-brand-copy ${collapsed ? "is-hidden" : ""}`}>
            <strong>Schooly</strong>
            <small>NEED GROUP</small>
          </span>
        </div>

        <nav className="dashboard-nav" aria-label="Navigation principale">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`dashboard-nav-item ${isActive ? "is-active" : ""}`}
                title={collapsed ? label : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={15} strokeWidth={1.8} />
                <span className={`dashboard-nav-label ${collapsed ? "is-hidden" : ""}`}>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link href="/dashboard/moratorium" className={`dashboard-support-card ${collapsed ? "is-hidden" : ""}`}>
            <span className="dashboard-support-icon"><Headphones size={14} /></span>
            <span><strong>Besoin d'aide ?</strong><small>Contacter Schooly</small></span>
          </Link>
          <form action={signOut}>
            <button className="dashboard-logout" type="submit" title="Déconnexion">
              <LogOut size={14} />
              <span className={`dashboard-nav-label ${collapsed ? "is-hidden" : ""}`}>Déconnexion</span>
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
              aria-expanded={!collapsed}
            >
              <span className={`sidebar-toggle-icon ${collapsed ? "is-collapsed" : ""}`}>
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </span>
            </button>

            <div ref={dropdownRef} className="dashboard-dropdowns">
              <DashboardDropdown
                label="Devise"
                options={currencyOptions}
                value={currency}
                open={openDropdown === "currency"}
                onToggle={() => setOpenDropdown((current) => current === "currency" ? null : "currency")}
                onSelect={(value) => {
                  setCurrency(value)
                  setOpenDropdown(null)
                }}
              />
              <DashboardDropdown
                label="Langue"
                options={languageOptions}
                value={language}
                open={openDropdown === "language"}
                onToggle={() => setOpenDropdown((current) => current === "language" ? null : "language")}
                onSelect={(value) => {
                  setLanguage(value)
                  setOpenDropdown(null)
                }}
              />
            </div>
          </div>

          <div className="dashboard-topbar-right">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={() => setDark((value) => !value)}
              aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
              aria-pressed={!dark}
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
