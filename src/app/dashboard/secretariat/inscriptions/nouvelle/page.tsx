import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { PhysicalEnrollmentForm } from "./form";

export const revalidate = 0;

export default async function NewPhysicalEnrollmentPage() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/secretariat/inscriptions/nouvelle");
  if (!profile || !["admin", "secretariat", "censeur"].includes(profile.role) || !profile.establishment_id) redirect("/dashboard");

  const [{ data: levels }, { data: modalities }] = await Promise.all([
    supabase.from("levels").select("id,name,rank").eq("establishment_id", profile.establishment_id).order("rank"),
    supabase.from("inscription_modalities").select("modality,name,required_documents").eq("establishment_id", profile.establishment_id).eq("is_active", true).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/secretariat/inscriptions" className="text-sm text-slate-500 hover:text-blue-600">← Inscriptions</Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">Nouvelle inscription au guichet</h1>
        <p className="mt-1 text-sm text-slate-500">Saisissez les informations de l'élève et du parent/tuteur. Les documents sont uniquement cochés comme fournis.</p>
      </div>
      <PhysicalEnrollmentForm levels={levels ?? []} modalities={modalities ?? []} />
    </div>
  );
}
