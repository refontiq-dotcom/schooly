import Link from "next/link";
import { IconBackpack, IconBed, IconChat, IconFile, IconHome, IconWallet } from "@/components/icons";
import { getSessionProfile } from "@/lib/auth/session";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getSessionProfile();

  let hasInternat = false;
  if (user && supabase) {
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("parent_id", user.id);
    const studentIds = (students ?? []).map((s) => s.id);
    if (studentIds.length > 0) {
      const { count } = await supabase
        .from("internat_assignments")
        .select("id", { count: "exact", head: true })
        .in("student_id", studentIds)
        .eq("status", "actif");
      hasInternat = Boolean(count && count > 0);
    }
  }

  const items = [
    { href: "/dashboard/parent", label: "Suivi", icon: IconHome },
    { href: "/dashboard/parent/rentree", label: "Rentrée", icon: IconBackpack },
    { href: "/dashboard/parent/paiements", label: "Paiements", icon: IconWallet },
    { href: "/dashboard/parent/documents", label: "Documents", icon: IconFile },
    { href: "/dashboard/parent/messages", label: "Messages", icon: IconChat },
    ...(hasInternat
      ? [{ href: "/dashboard/parent/internat", label: "Internat", icon: IconBed }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Espace parent">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-amber-300 hover:text-amber-700 transition-colors whitespace-nowrap"
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
