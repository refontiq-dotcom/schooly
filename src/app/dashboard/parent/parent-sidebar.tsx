"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "@/lib/auth/actions";

type Student = {
  id: string;
  full_name: string;
  section_name?: string;
  level_name?: string;
};

type Establishment = {
  id: string;
  name: string;
  city: string;
  students: Student[];
};

type Props = {
  establishments: Establishment[];
  selectedEstablishmentId: string | null;
  logoUrl: string | null;
};

function SidebarIcon({
  name,
  className = "w-5 h-5",
}: {
  name: string;
  className?: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    backpack: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 8V7a4 4 0 018 0v1M5 8.25A2.25 2.25 0 017.25 6h9.5A2.25 2.25 0 0119 8.25v9.5A2.25 2.25 0 0116.75 20h-9.5A2.25 2.25 0 015 17.75v-9.5zM9 13h6" />
      </svg>
    ),
    wallet: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    ),
    file: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    chat: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    logout: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
      </svg>
    ),
    school: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    chevronDown: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    ),
    child: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    menu: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    ),
    close: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };
  return <>{icons[name] ?? null}</>;
}

const navItems = [
  { href: "/dashboard/parent", label: "Suivi", icon: "home", exact: true },
  { href: "/dashboard/parent/rentree", label: "Rentrée", icon: "backpack", exact: false },
  { href: "/dashboard/parent/paiements", label: "Paiements", icon: "wallet", exact: false },
  { href: "/dashboard/parent/documents", label: "Documents", icon: "file", exact: false },
  { href: "/dashboard/parent/messages", label: "Messages", icon: "chat", exact: false },
];

/**
 * Build a href preserving current estab + student query params,
 * optionally overriding one or both.
 */
function buildHref(
  pathname: string,
  searchParams: URLSearchParams,
  overrides: { estab?: string; student?: string }
) {
  const params = new URLSearchParams(searchParams.toString());
  if (overrides.estab !== undefined) params.set("estab", overrides.estab);
  if (overrides.student !== undefined) params.set("student", overrides.student);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function ParentSidebar({
  establishments,
  selectedEstablishmentId,
  logoUrl,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [estabOpen, setEstabOpen] = useState(false);

  const selectedEstab = establishments.find(
    (e) => e.id === selectedEstablishmentId
  );
  const currentChildren = selectedEstab?.students ?? [];
  const selectedStudentId = searchParams.get("student");

  /** Build sidebar nav links that preserve ?estab=… */
  function navHref(href: string) {
    return buildHref(href, searchParams, {});
  }

  /** Switch establishment (keep same page, change estab) */
  function switchEstabHref(estabId: string) {
    return buildHref(pathname, searchParams, { estab: estabId });
  }

  /** Select a child (keep same page, change student) */
  function switchChildHref(studentId: string) {
    return buildHref(pathname, searchParams, { student: studentId });
  }

  return (
    <>
      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-6">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Schooly" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
            )}
            <span className="text-lg font-bold text-slate-800 tracking-tight">Schooly</span>
          </Link>
        </div>

        {/* Establishment Selector */}
        {establishments.length > 0 && (
          <div className="px-3 mb-2">
            <button
              type="button"
              onClick={() => setEstabOpen(!estabOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <SidebarIcon name="school" className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {selectedEstab?.name ?? "Sélectionner"}
                </p>
                {selectedEstab && (
                  <p className="text-xs text-slate-400 truncate">
                    {selectedEstab.city} · {selectedEstab.students.length} enfant
                    {selectedEstab.students.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <SidebarIcon
                name="chevronDown"
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                  estabOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {estabOpen && (
              <div className="mt-1 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden">
                {establishments.map((estab) => (
                  <Link
                    key={estab.id}
                    href={switchEstabHref(estab.id)}
                    onClick={() => setEstabOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                      estab.id === selectedEstablishmentId
                        ? "bg-amber-50 text-amber-800"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{estab.name}</span>
                    <span className="text-xs text-slate-400 ml-auto shrink-0">
                      {estab.students.length}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Children tabs (multiple) — large visual cards */}
        {currentChildren.length > 1 && (
          <div className="px-3 mb-2">
            <p className="px-3 text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
              👧 Mes enfants
            </p>
            <div className="space-y-1.5">
              {currentChildren.map((child) => {
                const active = child.id === selectedStudentId;
                return (
                  <Link
                    key={child.id}
                    href={switchChildHref(child.id)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm transition-all min-h-[56px] ${
                      active
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                      {child.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{child.full_name}</p>
                      {child.level_name && (
                        <p className="text-xs text-slate-400 truncate">
                          {child.level_name}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Single child card */}
        {currentChildren.length === 1 && (
          <div className="px-4 py-3 mx-3 mb-2 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {currentChildren[0].full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {currentChildren[0].full_name}
                </p>
                {currentChildren[0].level_name && (
                  <p className="text-xs text-slate-500">
                    {currentChildren[0].level_name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Nav — large touch targets for accessibility */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Navigation parent">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const emoji = item.icon === "home" ? "🏠" : item.icon === "backpack" ? "🎒" : item.icon === "wallet" ? "💰" : item.icon === "file" ? "📄" : "💬";
            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all min-h-[52px] ${
                  active
                    ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className="text-xl shrink-0" aria-hidden="true">{emoji}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out — large touch target */}
        <div className="px-3 py-3 border-t border-slate-100">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors min-h-[52px]"
            >
              <span className="text-xl">🚪</span>
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <SidebarIcon name={mobileOpen ? "close" : "menu"} className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          {/* Mobile establishment selector */}
          {establishments.length > 1 && (
            <div className="sm:hidden">
              <select
                className="text-sm border border-slate-200 rounded-lg px-2 py-1"
                defaultValue={selectedEstablishmentId ?? ""}
                onChange={(e) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("estab", e.target.value);
                  window.location.search = params.toString();
                }}
              >
                {establishments.map((estab) => (
                  <option key={estab.id} value={estab.id}>
                    {estab.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* Page content – rendered by child pages */}
      </div>
    </>
  );
}
