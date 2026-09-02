import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dashboardHomeForRole } from "@/lib/auth/roles";
import type { UserRole, SchoolType } from "@/types";
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ICONS } from "@/types";

export const revalidate = 0;

export default async function HomePage() {
  let user = null;
  let dashboardHref = "/auth";
  try {
    const supabase = await createClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
    if (u) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .maybeSingle();
      dashboardHref = dashboardHomeForRole((profile?.role as UserRole | undefined) ?? "parent");
    }
  } catch {
    // Supabase not configured
  }

  return (
    <div className="min-h-screen">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1B3A4B] via-[#1E4D5E] to-[#2A6B7C] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-amber-400 blur-3xl" />
          <div className="absolute bottom-10 right-20 w-60 h-60 rounded-full bg-amber-300 blur-3xl" />
        </div>
        <div className="relative flex flex-col lg:flex-row items-center gap-8 px-8 py-12 lg:py-16 lg:px-16">
          {/* Left content */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
              GÉREZ VOTRE
              <br />
              ÉTABLISSEMENT
              <br />
              <span className="text-amber-400">EN TOUTE SIMPLICITÉ</span>
            </h1>
            <p className="text-sm md:text-base text-slate-200 max-w-md mb-8 mx-auto lg:mx-0 leading-relaxed">
              Simplifiez les inscriptions, suivez les présences, gérez les notes
              et communiquez avec les parents — tout au même endroit.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href={user ? dashboardHref : "/auth"}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-full transition-colors"
              >
                {user ? "Mon Espace" : "Commencer"}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white/60 text-white font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Découvrir
              </Link>
            </div>
          </div>

          {/* Right illustration */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <HeroIllustration />
          </div>
        </div>

        {/* Wavy bottom edge */}
        <svg className="absolute bottom-0 left-0 w-full h-8 md:h-12" viewBox="0 0 1440 48" fill="none" preserveAspectRatio="none">
          <path d="M0 48h1440V16c-240 20-480 32-720 32S240 36 0 16v32z" fill="#F0F4F8" />
        </svg>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-[#F0F4F8] py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <StatCard icon="🎓" value="98%" label="Taux de réussite" />
            <StatCard icon="📚" value="6+" label="Niveaux scolaires" />
            <StatCard icon="👨‍🏫" value="15:1" label="Ratio élèves/maître" />
            <StatCard icon="🏆" value="30+" label="Activités extras" />
            <StatCard icon="👨‍👩‍👧‍👦" value="500+" label="Élèves inscrits" />
          </div>
        </div>
      </section>

      {/* ── Types d'établissements ── */}
      <section id="features" className="bg-[#F0F4F8] py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-3">
            POUR TOUS LES ÉTABLISSEMENTS
          </h2>
          <p className="text-sm text-slate-500 text-center mb-10 max-w-lg mx-auto">
            Schooly s'adapte à votre type d'établissement avec des niveaux et fonctionnalités sur mesure.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <SchoolTypeCard
              type="primaire"
              color="bg-emerald-500"
              levels={["Maternelle", "CP1", "CP2", "CE1", "CE2", "CM1", "CM2"]}
              description="Un accompagnement bienveillant pour les premiers apprentissages, du,cp à la fin du primaire."
            />
            <SchoolTypeCard
              type="college"
              color="bg-amber-500"
              levels={["6ème", "5ème", "4ème", "3ème"]}
              description="Découvrez les matières fondamentales et développez l'esprit critique."
            />
            <SchoolTypeCard
              type="lycee"
              color="bg-[#1B3A4B]"
              levels={["Seconde", "Première", "Terminale"]}
              description="Préparation au baccalauréat avec un suivi personnalisé et des filières diversifiées."
            />
            <SchoolTypeCard
              type="professionnel"
              color="bg-purple-500"
              levels={["1ère année", "2ème année", "3ème année"]}
              description="Formations techniques et professionnelles : BEP, CAP, Bac Pro, BTS et alternance."
            />
            <SchoolTypeCard
              type="islamique"
              color="bg-teal-600"
              levels={["Coran", "Arabe", "Fiqh", "Hadith", "Sira"]}
              description="Enseignement coranique, langue arabe, sciences islamiques et formation religieuse."
            />
          </div>
        </div>
      </section>

      {/* ── Campus / Fonctionnalités ── */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-10">
            NOS ESPACES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FacilityCard
              icon="💻"
              title="Gestion en Ligne"
              description="Inscriptions, réservations et suivi des paiements depuis votre téléphone."
            />
            <FacilityCard
              icon="📊"
              title="Suivi des Notes"
              description="Les professeurs saisissent les évaluations, les parents suivent en temps réel."
            />
            <FacilityCard
              icon="📱"
              title="Notifications WhatsApp"
              description="Récapitulatifs hebdomadaires de présence et de notes envoyés automatiquement."
            />
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="bg-gradient-to-r from-[#1B3A4B] to-[#2A6B7C] py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Prêt à simplifier votre gestion scolaire ?
          </h2>
          <p className="text-slate-200 mb-8 max-w-xl mx-auto">
            Rejoignez les établissements qui font déjà confiance à Schooly pour
            gérer leurs inscriptions, présences et communications.
          </p>
          <Link
            href={user ? "/dashboard/admin" : "/auth"}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-full transition-colors"
          >
            {user ? "Accéder au tableau de bord" : "Créer mon compte gratuit"}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-100">
      <span className="text-2xl block mb-1">{icon}</span>
      <p className="text-xl md:text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function SchoolTypeCard({
  type,
  color,
  levels,
  description,
}: {
  type: SchoolType;
  color: string;
  levels: string[];
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col items-start hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white text-xl`}>
          {SCHOOL_TYPE_ICONS[type]}
        </div>
        <div>
          <h3 className="font-bold text-slate-800">{SCHOOL_TYPE_LABELS[type]}</h3>
        </div>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed mb-3 flex-1">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {levels.map((level) => (
          <span
            key={level}
            className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
          >
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}

function FacilityCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
        <span className="text-5xl">{icon}</span>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg width="320" height="280" viewBox="0 0 320 280" fill="none" className="w-full max-w-[320px]">
      {/* Desk */}
      <rect x="40" y="180" width="240" height="12" rx="6" fill="#C4956A" opacity="0.6" />
      <rect x="60" y="192" width="8" height="60" rx="2" fill="#C4956A" opacity="0.4" />
      <rect x="252" y="192" width="8" height="60" rx="2" fill="#C4956A" opacity="0.4" />

      {/* Laptop */}
      <rect x="120" y="130" width="80" height="50" rx="4" fill="#E8A44A" opacity="0.9" />
      <rect x="125" y="135" width="70" height="38" rx="2" fill="white" opacity="0.9" />
      <rect x="100" y="180" width="120" height="6" rx="3" fill="#D69538" opacity="0.7" />

      {/* Screen content lines */}
      <rect x="132" y="145" width="40" height="3" rx="1" fill="#1B3A4B" opacity="0.3" />
      <rect x="132" y="152" width="55" height="3" rx="1" fill="#1B3A4B" opacity="0.2" />
      <rect x="132" y="159" width="35" height="3" rx="1" fill="#E8A44A" opacity="0.4" />

      {/* Person - Student 1 (left) */}
      <circle cx="80" cy="110" r="18" fill="#F5D0A9" />
      <circle cx="80" cy="105" r="12" fill="#3D3D3D" />
      <rect x="72" y="128" width="16" height="50" rx="4" fill="#E8A44A" />
      <rect x="64" y="140" width="8" height="30" rx="3" fill="#F5D0A9" />
      <rect x="88" y="135" width="20" height="6" rx="3" fill="#F5D0A9" />

      {/* Person - Student 2 (center) */}
      <circle cx="160" cy="90" r="20" fill="#F5D0A9" />
      <circle cx="160" cy="84" r="14" fill="#1B3A4B" />
      <rect x="148" y="110" width="24" height="55" rx="5" fill="white" />
      <rect x="148" y="130" width="24" height="5" rx="1" fill="#E8A44A" opacity="0.5" />
      <rect x="138" y="118" width="10" height="32" rx="4" fill="#F5D0A9" />
      <rect x="172" y="118" width="10" height="32" rx="4" fill="#F5D0A9" />

      {/* Person - Student 3 (right) */}
      <circle cx="240" cy="100" r="18" fill="#F5D0A9" />
      <circle cx="240" cy="95" r="12" fill="#5C3D2E" />
      <rect x="232" y="118" width="16" height="50" rx="4" fill="#2A6B7C" />
      <rect x="224" y="130" width="8" height="30" rx="3" fill="#F5D0A9" />
      <rect x="248" y="125" width="20" height="6" rx="3" fill="#F5D0A9" />

      {/* Books stack */}
      <rect x="30" y="165" width="30" height="8" rx="2" fill="#E8A44A" opacity="0.7" />
      <rect x="32" y="158" width="26" height="8" rx="2" fill="#2A6B7C" opacity="0.6" />
      <rect x="34" y="151" width="22" height="8" rx="2" fill="#D69538" opacity="0.5" />

      {/* Globe */}
      <circle cx="280" cy="155" r="18" fill="none" stroke="#2A6B7C" strokeWidth="2" opacity="0.5" />
      <ellipse cx="280" cy="155" rx="8" ry="18" fill="none" stroke="#2A6B7C" strokeWidth="1.5" opacity="0.3" />
      <line x1="262" y1="155" x2="298" y2="155" stroke="#2A6B7C" strokeWidth="1.5" opacity="0.3" />

      {/* Decorative dots */}
      <circle cx="20" cy="80" r="3" fill="#E8A44A" opacity="0.4" />
      <circle cx="300" cy="70" r="4" fill="#E8A44A" opacity="0.3" />
      <circle cx="15" cy="200" r="2" fill="#2A6B7C" opacity="0.3" />
      <circle cx="295" cy="200" r="3" fill="#2A6B7C" opacity="0.2" />
    </svg>
  );
}
