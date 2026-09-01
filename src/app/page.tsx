import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      {/* Hero */}
      <div className="max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-navy mb-4 leading-tight">
          Gérez votre établissement
          <br />
          <span className="text-brand">en toute simplicité</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-8">
          Schooly simplifie la gestion scolaire : inscriptions, suivi des
          présences, notes des élèves et communication avec les parents — tout
          en un seul endroit.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {user ? (
            <Link
              href="/dashboard/admin"
              className="btn-primary text-base px-6 py-3"
            >
              Accéder au tableau de bord
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="btn-primary text-base px-6 py-3"
              >
                Commencer gratuitement
              </Link>
              <Link
                href="/auth"
                className="btn-secondary text-base px-6 py-3"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-4xl text-left">
        <FeatureCard
          icon="📋"
          title="Inscriptions en ligne"
          description="Les parents réservent une place et finalisent l'inscription depuis leur téléphone."
        />
        <FeatureCard
          icon="📊"
          title="Suivi des présences"
          description="Les professeurs marquent les présences et le parent reçoit un résumé hebdomadaire."
        />
        <FeatureCard
          icon="📝"
          title="Notes & bulletins"
          description="Saisie des évaluations et suivi des résultats par les parents en temps réel."
        />
        <FeatureCard
          icon="🔐"
          title="Espaces sécurisés"
          description="Un espace admin pour l'établissement, un espace parent pour le suivi familial."
        />
        <FeatureCard
          icon="📱"
          title="QR Code"
          description="Chaque réservation génère un QR code pour la finalisation sur place au secrétariat."
        />
        <FeatureCard
          icon="💬"
          title="Notifications"
          description="Récapitulatifs et alertes envoyés directement sur WhatsApp."
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <span className="text-2xl mb-3 block">{icon}</span>
      <h3 className="font-semibold text-navy mb-1">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}
