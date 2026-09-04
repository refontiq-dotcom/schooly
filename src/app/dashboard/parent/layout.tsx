import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { findParentStudents, groupByEstablishment, resolveEstablishmentId } from "@/lib/parent/context";
import ParentSidebar from "./parent-sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace parent — Schooly",
};

export default async function ParentLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: Promise<{ estab?: string; student?: string }>;
}) {
  const { supabase, user } = await getSessionProfile();

  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/parent");
  }

  const params = await searchParams;
  const students = await findParentStudents(supabase, user.id);
  const groups = groupByEstablishment(students);
  const selectedEstabId = resolveEstablishmentId(groups, params.estab ?? null);

  // Find the selected student within the selected establishment
  const selectedGroup = groups.find((g) => g.establishment.id === selectedEstabId);
  const currentStudents = selectedGroup?.students ?? [];
  const selectedStudentId = params.student ?? currentStudents[0]?.id ?? null;

  // Serialize for client component
  const establishments = groups.map((g) => ({
    id: g.establishment.id,
    name: g.establishment.name,
    city: g.establishment.city,
    students: g.students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      section_name: s.sections?.name,
      level_name: s.sections?.levels?.name,
    })),
  }));

  return (
    <div className="flex h-screen gap-0">
      <ParentSidebar
        establishments={establishments}
        selectedEstablishmentId={selectedEstabId}
      />
      <main className="flex-1 overflow-y-auto">
        {/* Inject student/establishment context into children via search params is handled by the pages reading searchParams */}
        {children}
      </main>
    </div>
  );
}
