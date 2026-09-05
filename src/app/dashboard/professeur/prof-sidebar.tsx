"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  NotebookPen,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { href: "/dashboard/professeur", label: "Vue d'ensemble", icon: BarChart3 },
  { href: "/dashboard/professeur/emploi-du-temps", label: "Emploi du temps", icon: CalendarDays },
  { href: "/dashboard/professeur/presences", label: "Présences", icon: ClipboardCheck },
  { href: "/dashboard/professeur/notes", label: "Notes & bulletins", icon: NotebookPen },
];

interface SectionAssignment {
  section_id: string;
  subject: string;
  sections: {
    name: string;
    levels: { name: string } | null;
  } | null;
}

interface ProfSidebarProps {
  fullName: string;
  establishmentName: string;
  logoUrl: string | null;
  assignments: SectionAssignment[];
}

export default function ProfSidebar({
  fullName,
  establishmentName,
  logoUrl,
  assignments,
}: ProfSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard/professeur") {
      return pathname === "/dashboard/professeur";
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Volet mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-sm bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-surface border-r border-subtle flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header logo */}
        <div className="p-5 border-b border-subtle">
          <Link href="/dashboard/professeur" className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={establishmentName} className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-accent-active flex items-center justify-center">
                <span className="text-accent-text font-black text-sm">S</span>
              </div>
            )}
            <div>
              <p className="font-bold text-sm leading-tight tracking-wide text-text">SCHOOLY</p>
              <p className="text-[10px] text-muted uppercase tracking-widest">Espace professeur</p>
            </div>
          </Link>
        </div>

        {/* Prof profile card */}
        <div className="px-4 py-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-accent-active flex items-center justify-center text-accent-text font-bold text-base shrink-0">
              {fullName?.charAt(0) ?? "P"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-text">{fullName}</p>
              <p className="text-[11px] text-muted truncate">{establishmentName}</p>
            </div>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] uppercase tracking-widest text-muted font-semibold mb-2">
            Navigation
          </p>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-accent-active text-accent-text"
                    : "text-muted hover:bg-hover hover:text-text"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Classes assignées */}
        {assignments && assignments.length > 0 && (
          <div className="border-t border-subtle px-3 py-4">
            <p className="px-3 text-[10px] uppercase tracking-widest text-muted font-semibold mb-2">
              Mes classes
            </p>
            <div className="space-y-1">
              {assignments.map((a) => {
                const levelName = a.sections?.levels?.name ?? "";
                const sectionName = a.sections?.name ?? "";
                const href = `/dashboard/professeur/classe/${a.section_id}`;
                const active = pathname === href;
                return (
                  <Link
                    key={a.section_id}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs transition-all duration-200 ${
                      active
                        ? "bg-accent-active text-accent-text"
                        : "text-muted hover:bg-hover hover:text-text"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-accent-primary shrink-0" />
                    <span className="truncate">
                      {levelName} {sectionName} · {a.subject}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-subtle">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 px-3 py-2.5 rounded-full text-xs text-muted hover:text-text hover:bg-hover transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Bouton menu mobile */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-subtle text-text shadow-lg shadow-black/40 lg:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
    </>
  );
}
