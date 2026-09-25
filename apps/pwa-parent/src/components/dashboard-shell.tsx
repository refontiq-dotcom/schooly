"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
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
]

const settingsItems = ["Profil", "Sécurité", "Notifications"]
const currencyOptions = ["FCFA", "EUR", "USD"]
const languageOptions = ["FR", "EN"]
const PREFERENCE_EVENT = "schooly-dashboard-preference-change"

type PreferenceKey =
  | "schooly-dashboard-theme"
  | "schooly-dashboard-currency"
  | "schooly-dashboard-language"

function subscribePreference(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key?.startsWith("schooly-dashboard-")) onStoreChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(PREFERENCE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(PREFERENCE_EVENT, onStoreChange)
  }
}

function readPreference(key: PreferenceKey, fallback: string) {
  if (typeof window === "undefined") return fallback
  return window.localStorage.getItem(key) ?? fallback
}

function writePreference(key: PreferenceKey, value: string) {
  try {
    window.localStorage.setItem(key, value)
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
  } catch {
    // Le shell reste utilisable si le stockage est indisponible.
  }
}

function usePreference(key: PreferenceKey, fallback: string) {
  return useSyncExternalStore(
    useCallback((onStoreChange) => subscribePreference(onStoreChange), []),
    useCallback(() => readPreference(key, fallback), [key, fallback]),
    () => fallback,
  )
}

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
  const theme = usePreference("schooly-dashboard-theme", "dark")
  const dark = theme === "dark"
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<"currency" | "language" | null>(null)
  const currency = usePreference("schooly-dashboard-currency", "FCFA")
  const language = usePreference("schooly-dashboard-language", "FR")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeSetting, setActiveSetting] = useState<string | null>(null)
  const [navigationDirection, setNavigationDirection] = useState<"forward" | "backward" | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.dashboardTheme = dark ? "dark" : "light"
  }, [dark])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false)
        setOpenDropdown(null)
        setSettingsOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMobileOpen(false)
      setOpenDropdown(null)
      setSettingsOpen(false)
      setNavigationDirection(null)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [pathname])

  useEffect(() => {
    const onNavigation = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: "forward" | "backward" }>
      const nextDirection = customEvent.detail?.direction
      if (nextDirection !== "forward" && nextDirection !== "backward") return
      setNavigationDirection(nextDirection)
    }

    window.addEventListener("schooly-dashboard-navigation", onNavigation)
    return () => window.removeEventListener("schooly-dashboard-navigation", onNavigation)
  }, [])

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
  const navigationClass = navigationDirection ? `dashboard-nav-transition-${navigationDirection}` : ""

  return (
    <div className={`schooly-dashboard-shell ${themeClass} ${navigationClass}`}>
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

          <div className={`dashboard-settings-menu ${settingsOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className={`dashboard-nav-item dashboard-settings-trigger ${settingsOpen ? "is-open" : ""}`}
              onClick={() => setSettingsOpen((value) => !value)}
              title={collapsed ? "Réglages" : undefined}
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
            >
              <Settings size={15} strokeWidth={1.8} />
              <span className={`dashboard-nav-label ${collapsed ? "is-hidden" : ""}`}>Réglages</span>
              {!collapsed && <ChevronRight className="dashboard-settings-chevron" size={14} />}
            </button>

            <div
              className="dashboard-settings-submenu"
              role="menu"
              aria-hidden={!settingsOpen}
            >
              <div className="dashboard-settings-submenu-inner">
                {settingsItems.map((item) => {
                  const selected = activeSetting === item
                  return (
                    <button
                      key={item}
                      type="button"
                      role="menuitem"
                      tabIndex={settingsOpen && !collapsed ? 0 : -1}
                      aria-current={selected ? "page" : undefined}
                      className={`dashboard-settings-subitem ${selected ? "is-selected" : ""}`}
                      onClick={() => setActiveSetting(item)}
                    >
                      <span>{item}</span>
                      <span className="dashboard-settings-subitem-indicator" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link href="/dashboard/moratorium" className={`dashboard-support-card ${collapsed ? "is-hidden" : ""}`}>
            <span className="dashboard-support-icon"><Headphones size={14} /></span>
            <span><strong>Besoin d&apos;aide ?</strong><small>Contacter Schooly</small></span>
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
                  writePreference("schooly-dashboard-currency", value)
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
                  writePreference("schooly-dashboard-language", value)
                  setOpenDropdown(null)
                }}
              />
            </div>
          </div>

          <div className="dashboard-topbar-right">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={() => writePreference("schooly-dashboard-theme", dark ? "light" : "dark")}
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
