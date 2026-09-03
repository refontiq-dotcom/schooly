import { getSessionProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { EstablishmentEditForm, TrouvetouAdForm, TrouvetouPublicationToggle } from "../_ops-forms";

export const revalidate = 0;

export default async function TrouvetouAdminPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/admin/trouvetou");

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name, city, address, description, school_type, website_url, cover_image_url, tour_360_url, latitude, longitude, reservation_fee_amount, reservation_hold_hours, published_to_trouvetou")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const { data: ads } = establishment
    ? await supabase
        .from("trouvetou_ads")
        .select("id, title, description, image_url, target_url, starts_at, ends_at, active")
        .eq("establishment_id", establishment.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Partenaire</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">Trouvetou</h1>
        <p className="mt-1 text-sm text-slate-500">Publiez votre école dans la catégorie Écoles et gérez vos campagnes.</p>
      </div>

      {!establishment ? (
        <div className="card text-slate-500">Aucun établissement rattaché à ce compte.</div>
      ) : (
        <>
          <section className="card">
            <TrouvetouPublicationToggle published={establishment.published_to_trouvetou} />
            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-sm text-slate-600 sm:grid-cols-3">
              <div><span className="block text-xs text-slate-400">Établissement</span>{establishment.name}</div>
              <div><span className="block text-xs text-slate-400">Catégorie</span>Écoles</div>
              <div><span className="block text-xs text-slate-400">Localisation</span>{establishment.city}</div>
            </div>
          </section>

          <section className="card">
            <h2 className="font-semibold text-slate-800">Modifier la fiche établissement</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Ces informations seront visibles sur Schooly et Trouvetou.</p>
            <EstablishmentEditForm establishment={establishment} />
          </section>

          <section className="card">
            <h2 className="font-semibold text-slate-800">Créer une publicité</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Ajoutez une annonce visible sur la fiche de votre école dans Trouvetou.</p>
            <TrouvetouAdForm />
          </section>

          <section className="card">
            <h2 className="mb-4 font-semibold text-slate-800">Publicités créées</h2>
            <div className="space-y-3">
              {(ads ?? []).map((ad) => (
                <div key={ad.id} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div><p className="font-medium text-slate-800">{ad.title}</p><p className="text-sm text-slate-500">{ad.description || "Aucun message"}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${ad.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{ad.active ? "Active" : "Inactive"}</span>
                </div>
              ))}
              {(!ads || ads.length === 0) && <p className="text-sm text-slate-400">Aucune publicité créée.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}