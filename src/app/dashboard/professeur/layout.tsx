import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

const NAV_ITEMS = [
  { href: "/dashboard/professeur", label: "📊 Vue d'ensemble", emoji: "📊" },
  { href: "/dashboard/professeur/emploi-du-temps", label: "📅 Emploi du temps", emoji: "📅" },
  { href: "/dashboard/professeur/presences", label: "✅ Présences", emoji: "✅" },
  { href: "/dashboard/professeur/notes", label: "📝 Notes & bulletins", emoji: "📝" },
];

export default async function ProfesseurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur");
  }

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const { data: assignments } = profile?.role === "professeur"
    ? await supabase
        .from("teacher_assignments")
        .select("section_id, subject, sections(id, name, levels(name))")
        .eq("teacher_id", profile.id)
    : { data: null };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:w-72 bg-white border-r border-slate-200 flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <Link href="/dashboard/professeur" className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <div>
              <p className="font-bold text-navy text-sm leading-tight">Schooly</p>
              <p className="text-xs text-slate-400">Espace professeur</p>
            </div>
          </Link>
        </div>

        {/* Prof info */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.charAt(0) ?? "P"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy truncate">
                {profile?.full_name}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {establishment?.name ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-navy transition-colors"
            >
              <span className="text-lg">{item.emoji}</span>
              {item.label.replace(item.emoji + " ", "")}
            </Link>
          ))}
        </nav>

        {/* Classes assignées */}
        {assignments && assignments.length > 0 && (
          <div className="border-t border-slate-100 p-3">
            <p className="px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Mes classes
            </p>
            <div className="space-y-1">
              {assignments.map((a) => (
                <Link
                  key={a.section_id}
                  href={`/dashboard/professeur/classe/${a.section_id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="truncate">
                    {(a.sections as unknown as { levels?: { name: string } | null; name: string })?.levels?.name ?? ""}{" "}
                    {(a.sections as unknown as { name: string })?.name} — {a.subject}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-slate-100">
          <Link
            href="/auth"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            🚪 Déconnexion
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
