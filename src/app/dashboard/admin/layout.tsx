import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import AdminLayoutClient from "./layout-client";

export default async function AdminLayoutServer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/admin");
  }

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name, logo_url, group_id, branch_name, city")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  // Fetch group info if the establishment belongs to a group
  let groupName: string | null = null;
  let branches: { id: string; name: string; city: string; branch_name: string | null }[] = [];

  if (establishment?.group_id) {
    const { data: group } = await supabase
      .from("school_groups")
      .select("id, name")
      .eq("id", establishment.group_id)
      .maybeSingle();

    groupName = (group as { name: string } | null)?.name ?? null;

    // Fetch all branches in the same group
    const { data: branchData } = await supabase
      .from("establishments")
      .select("id, name, city, branch_name")
      .eq("group_id", establishment.group_id)
      .order("name");

    branches = (branchData as { id: string; name: string; city: string; branch_name: string | null }[]) ?? [];
  }

  return (
    <AdminLayoutClient
      logoUrl={(establishment as { logo_url: string | null } | null)?.logo_url ?? null}
      establishmentName={(establishment as { name: string } | null)?.name ?? ""}
      groupName={groupName}
      branches={branches}
      currentBranchId={(establishment as { id: string } | null)?.id ?? null}
    >
      {children}
    </AdminLayoutClient>
  );
}
