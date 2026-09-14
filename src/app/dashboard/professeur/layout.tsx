import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import ProfSidebar from "./prof-sidebar";

export const revalidate = 0;

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
        .select("id, name, logo_url")
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
      <ProfSidebar
        fullName={profile?.full_name ?? "Professeur"}
        establishmentName={establishment?.name ?? ""}
        logoUrl={establishment?.logo_url ?? null}
        assignments={(assignments ?? []) as unknown as { section_id: string; subject: string; sections: { name: string; levels: { name: string } | null } | null }[]}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
