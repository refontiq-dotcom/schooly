import { getSessionProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import InviteStaffForm from "./invite-form";

export const revalidate = 0;

const ROLE_LABEL: Record<string, string> = {
  professeur: "Professeur",
  secretariat: "Secrétariat",
  censeur: "Censeur",
  admin: "Administrateur",
};

export default async function EquipePage() {
  const { supabase, profile } = await getSessionProfile();

  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    redirect("/dashboard/parent");
  }

  const { data: invitations } = await supabase
    .from("staff_invitations")
    .select("id, email, role, token, accepted_at, expires_at, created_at")
    .eq("establishment_id", profile.establishment_id)
    .order("created_at", { ascending: false });

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, phone")
    .eq("establishment_id", profile.establishment_id)
    .order("role");

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Équipe & invitations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Les rôles professeur, secrétariat, censeur et administrateur ne
          s&apos;obtiennent que par invitation. Envoyez un lien à l&apos;adresse
          email du collaborateur.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Inviter un collaborateur</h2>
        <InviteStaffForm />
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-4">Personnel rattaché</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Nom</th>
              <th className="py-2">Email</th>
              <th className="py-2">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {staff?.map((member) => (
              <tr key={member.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium">{member.full_name}</td>
                <td className="py-2 text-slate-500">{member.email ?? "—"}</td>
                <td className="py-2">{ROLE_LABEL[member.role] ?? member.role}</td>
              </tr>
            ))}
            {(!staff || staff.length === 0) && (
              <tr>
                <td colSpan={3} className="py-4 text-slate-400">Aucun membre</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-4">Invitations</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Email</th>
              <th className="py-2">Rôle</th>
              <th className="py-2">Statut</th>
              <th className="py-2">Lien</th>
            </tr>
          </thead>
          <tbody>
            {invitations?.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const status = inv.accepted_at
                ? "Acceptée"
                : expired
                  ? "Expirée"
                  : "En attente";
              const link = `${siteUrl}/auth/invitation?token=${inv.token}`;
              return (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{inv.email}</td>
                  <td className="py-2">{ROLE_LABEL[inv.role] ?? inv.role}</td>
                  <td className="py-2">{status}</td>
                  <td className="py-2">
                    {!inv.accepted_at && !expired ? (
                      <code className="text-xs break-all text-slate-500">{link}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {(!invitations || invitations.length === 0) && (
              <tr>
                <td colSpan={4} className="py-4 text-slate-400">Aucune invitation</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
