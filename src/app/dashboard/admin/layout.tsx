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
        .select("id, name, logo_url")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  return (
    <AdminLayoutClient
      logoUrl={establishment?.logo_url ?? null}
      establishmentName={establishment?.name ?? ""}
    >
      {children}
    </AdminLayoutClient>
  );
}
