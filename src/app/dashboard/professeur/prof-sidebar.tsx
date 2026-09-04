"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard/professeur", label: "Vue d'ensemble", emoji: "📊" },
  { href: "/dashboard/professeur/emploi-du-temps", label: "Emploi du temps", emoji: "📅" },
  { href: "/dashboard/professeur/presences", label: "Présences", emoji: "✅" },
  { href: "/dashboard/professeur/notes", label: "Notes & bulletins", emoji: "📝" },
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

  function isActive(href: string) {
    if (href === "/dashboard/professeur") {
      return pathname === "/dashboard/professeur";
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden lg:flex lg:w-72 bg-gradient-to-b from-[#0E2D52] to-[#112D5E] text-white flex-col">
      {/* Header logo */}
      <div className="p-5 border-b border-white/10">
        <Link href="/dashboard/professeur" className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={establishmentName} className="w-9 h-9 rounded-xl object-cover shadow-lg" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#F25A2E] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-orange-500/30">
              S
            </div>
          )}
          <div>
            <p className="font-bold text-sm leading-tight tracking-wide">SCHOOLY</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Espace professeur</p>
          </div>
        </Link>
      </div>

      {/* Prof profile card */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-blue-500/20">
            {fullName?.charAt(0) ?? "P"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{fullName}</p>
            <p className="text-[11px] text-white/40 truncate">{establishmentName}</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold mb-2">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-white/15 text-white shadow-lg shadow-black/10"
                  : "text-white/60 hover:bg-white/8 hover:text-white"
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F25A2E] shadow-lg shadow-orange-500/50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Classes assignées */}
      {assignments && assignments.length > 0 && (
        <div className="border-t border-white/10 px-3 py-4">
          <p className="px-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold mb-2">
            Mes classes
          </p>
          <div className="space-y-1">
            {assignments.map((a) => {
              const levelName = a.sections?.levels?.name ?? "";
              const sectionName = a.sections?.name ?? "";
              return (
                <Link
                  key={a.section_id}
                  href={`/dashboard/professeur/classe/${a.section_id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                    pathname === `/dashboard/professeur/classe/${a.section_id}`
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:bg-white/8 hover:text-white/80"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
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
      <div className="p-3 border-t border-white/10">
        <Link
          href="/auth"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-white/30 hover:text-red-400 hover:bg-white/5 transition-all"
        >
          🚪 Déconnexion
        </Link>
      </div>
    </aside>
  );
}
