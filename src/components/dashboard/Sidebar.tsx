"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  ChevronDown,
  Settings,
  LogOut,
  Plus,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type SidebarNavSection = {
  title: string;
  items: SidebarNavItem[];
};

export interface SidebarProps {
  logoUrl: string | null;
  establishmentName: string;
  groupName: string | null;
  branches: { id: string; name: string; city: string; branch_name: string | null }[];
  currentBranchId: string | null;
  sections: SidebarNavSection[];
  userName: string;
  userRole: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  logoUrl,
  establishmentName,
  groupName,
  branches,
  currentBranchId,
  sections,
  userName,
  userRole,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const hasGroup = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

  // Ferme le volet mobile au changement de page
  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm bg-black/60 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-surface border-r border-subtle transition-all duration-200 ease-in-out lg:static lg:translate-x-0 ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Branding */}
        <div className={`flex items-center gap-3 px-5 h-16 shrink-0 ${collapsed ? "justify-center px-0" : ""}`}>
          <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="Schooly — accueil">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-accent-active flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-accent-primary" />
              </div>
            )}
            {!collapsed && (
              <>
                <span className="text-[15px] font-semibold tracking-tight text-text truncate">
                  {establishmentName || "Schooly"}
                </span>
                <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-accent-active text-accent-text px-2 py-0.5 text-[10px] font-semibold">
                  <Sparkles className="w-3 h-3 gemini-sparkle" /> AI
                </span>
              </>
            )}
          </Link>
        </div>

        {/* Saisie rapide */}
        <div className={`px-3 pb-2 ${collapsed ? "px-2 flex justify-center" : ""}`}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("schooly:quick-entry"))}
            className={`inline-flex items-center justify-center gap-2 rounded-full bg-accent-primary text-[#062e43] text-sm font-semibold h-10 transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${
              collapsed ? "w-10" : "w-full px-4"
            }`}
            title="Saisie rapide"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Saisie rapide</span>}
          </button>
        </div>

        {/* Sélecteur de succursale (multi-établissements) */}
        {hasGroup && !collapsed && (
          <div className="px-3 pb-2">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">
              {groupName}
            </p>
            <button
              type="button"
              onClick={() => setBranchOpen((v) => !v)}
              aria-expanded={branchOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-hover hover:bg-subtle transition-all duration-200 text-left"
            >
              <Layers className="w-4 h-4 text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {currentBranch?.branch_name || currentBranch?.name || establishmentName}
                </p>
                <p className="text-xs text-muted truncate">
                  {currentBranch?.city} · {branches.length} succursale{branches.length > 1 ? "s" : ""}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${branchOpen ? "rotate-180" : ""}`} />
            </button>
            {branchOpen && (
              <div className="mt-1 rounded-2xl border border-subtle bg-surface overflow-hidden shadow-xl shadow-black/30">
                {branches.map((b) => (
                  <Link
                    key={b.id}
                    href="/dashboard/admin"
                    onClick={() => setBranchOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm transition-all duration-200 ${
                      b.id === currentBranchId
                        ? "bg-accent-active text-accent-text"
                        : "text-muted hover:bg-hover hover:text-text"
                    }`}
                  >
                    <span className="truncate">{b.branch_name || b.name}</span>
                    <span className={`ml-auto shrink-0 text-xs ${b.id === currentBranchId ? "text-accent-text/70" : "text-muted"}`}>
                      {b.city}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4" aria-label="Navigation administrateur">
          {sections.map((section, si) => (
            <div key={section.title || si}>
              {!collapsed && section.title && (
                <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard/admin" && pathname.startsWith(`${item.href}/`));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-accent-active text-accent-text"
                          : "text-muted hover:bg-hover hover:text-text"
                      } ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Carte profil ancrée en bas */}
        <div className={`shrink-0 p-3 border-t border-subtle ${collapsed ? "px-2" : ""}`}>
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-hover px-3 py-2.5">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-accent-active flex items-center justify-center text-accent-text font-semibold text-sm shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{userName}</p>
                <p className="text-xs text-muted truncate">{userRole}</p>
              </div>
            </div>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
            <Link
              href="#"
              title={collapsed ? "Paramètres" : undefined}
              className={`flex items-center gap-3 rounded-full px-3 py-2 text-[13px] text-muted hover:bg-hover hover:text-text transition-all duration-200 ${
                collapsed ? "justify-center px-0" : "flex-1"
              }`}
            >
              <Settings className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>Paramètres</span>}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                title="Déconnexion"
                className={`flex items-center gap-3 rounded-full px-3 py-2 text-[13px] text-muted hover:bg-hover hover:text-text transition-all duration-200 ${
                  collapsed ? "justify-center px-0" : "flex-1"
                }`}
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            </form>
          </div>
        </div>

        {/* Poignée de repli */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-[70px] hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-subtle bg-hover text-muted hover:text-text hover:bg-subtle transition-all duration-200 shadow-lg shadow-black/40"
        >
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  );
}
