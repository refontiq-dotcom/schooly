import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { findParentStudents, groupByEstablishment } from "@/lib/parent/context";
import ParentSidebar from "./parent-sidebar";

export const revalidate = 0;

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/parent");
  }

  const students = await findParentStudents(supabase, user.id);
  const groups = groupByEstablishment(students);

  // Build sidebar data
  const establishments = groups.map((g) => ({
    id: g.establishment.id,
    name: g.establishment.name,
    city: g.establishment.city,
    students: g.students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      section_name: s.sections?.name ?? undefined,
      level_name: s.sections?.levels?.name ?? undefined,
    })),
  }));

  // Fetch logo for the first establishment (or could be any)
  let logoUrl: string | null = null;
  if (groups.length > 0) {
    const { data: estData } = await supabase
      .from("establishments")
      .select("logo_url")
      .eq("id", groups[0].establishment.id)
      .maybeSingle();
    logoUrl = (estData as { logo_url: string | null } | null)?.logo_url ?? null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <ParentSidebar
        establishments={establishments}
        selectedEstablishmentId={groups[0]?.establishment.id ?? null}
        logoUrl={logoUrl}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
