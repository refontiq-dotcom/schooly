import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dashboardHomeForRole } from "@/lib/auth/roles";
import type { UserRole, SchoolType } from "@/types";
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ICONS } from "@/types";

export const revalidate = 0;

const schoolTypes: Array<{
  type: SchoolType;
  accent: string;
  levels: string[];
  description: string;
}> = [
  { type: "primaire", accent: "from-emerald-500 to-teal-500", levels: ["Maternelle", "CP1", "CP2", "CE1", "CE2", "CM1", "CM2"], description: "Un accompagnement bienveillant pour les premiers apprentissages, du CP à la fin du primaire." },
  { type: "college", accent: "from-amber-400 to-orange-500", levels: ["6ème", "5ème", "4ème", "3ème"], description: "Découvrez les matières fondamentales et développez l'esprit critique." },
  { type: "lycee", accent: "from-blue-600 to-indigo-600", levels: ["Seconde", "Première", "Terminale"], description: "Préparation au baccalauréat avec un suivi personnalisé et des filières diversifiées." },
  { type: "professionnel", accent: "from-violet-500 to-fuchsia-500", levels: ["1ère année", "2ème année", "3ème année"], description: "Formations techniques et professionnelles : BEP, CAP, Bac Pro, BTS et alternance." },
  { type: "islamique", accent: "from-teal-500 to-emerald-600", levels: ["Coran", "Arabe", "Fiqh", "Hadith", "Sira"], description: "Enseignement coranique, langue arabe, sciences islamiques et formation religieuse." },
];

const features = [
  ["students", "Gestion des élèves", "Centralisez les informations et le suivi de tous vos élèves."],
  ["teachers", "Gestion des enseignants", "Gérez les enseignants, matières, affectations et classes."],
  ["grades", "Notes & bulletins", "Saisissez les notes et générez les bulletins plus facilement."],
  ["attendance", "Présences & absences", "Suivez les présences et repérez rapidement les absences."],
  ["messages", "Communication", "Communiquez simplement avec les parents et les élèves."],
  ["calendar", "Emplois du temps", "Créez et consultez les emplois du temps en un seul endroit."],
] as const;

const spaces = [
  ["admin", "Administration", "Gérez votre établissement, vos équipes, vos classes et vos rapports."],
  ["teacher", "Enseignants", "Suivez vos classes, présences, notes et élèves à risque."],
  ["student", "Élèves", "Consultez notes, emploi du temps, informations et annonces."],
  ["parent", "Parents", "Suivez la scolarité de votre enfant et échangez avec l'établissement."],
] as const;

export default async function HomePage() {
  let user = null;
  let dashboardHref = "/auth";
  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    user = currentUser;
    if (currentUser) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).maybeSingle();
      dashboardHref = dashboardHomeForRole((profile?.role as UserRole | undefined) ?? "parent");
    }
  } catch { /* Supabase peut être indisponible pendant le rendu local. */ }

  const primaryHref = user ? dashboardHref : "/auth";

  return (
    <div className="space-y-0">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#063b91] text-white shadow-2xl shadow-blue-950/15">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_45%,rgba(34,211,238,.45),transparent_25%),radial-gradient(circle_at_15%_85%,rgba(59,130,246,.35),transparent_32%)]" />
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[55px] border-cyan-300/10" />
        <div className="absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid min-h-[590px] items-center gap-8 px-6 py-12 sm:px-10 lg:grid-cols-[.92fr_1.08fr] lg:px-14 lg:py-14">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold tracking-wide text-cyan-100">PLATEFORME DE GESTION SCOLAIRE</span>
            <h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-[4.35rem]">Gérez votre établissement<span className="block text-amber-400">simplement et efficacement.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-blue-50/85 sm:text-lg">Schooly centralise les inscriptions, présences, notes, communications et le suivi des élèves dans une seule plateforme.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber-500 px-6 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400">{user ? "Mon espace" : "Commencer gratuitement"}<ArrowIcon /></Link>
              <Link href="#fonctionnalites" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/35 bg-white/5 px-6 font-semibold text-white hover:bg-white/10">Découvrir Schooly</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-blue-100/80"><span>✓ Simple à utiliser</span><span>✓ Sécurisé</span><span>✓ Pensé pour les écoles</span></div>
          </div>
          <HeroVisual />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1440 100%22 preserveAspectRatio=%22none%22%3E%3Cpath d=%22M0 65C240 5 420 5 650 48c250 47 430 47 790-25v77H0Z%22 fill=%22%23ffffff%22/%3E%3C/svg%3E')] bg-cover bg-bottom" />
      </section>

      <section className="relative z-10 -mt-7 px-3 sm:px-6"><div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-900/10 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 lg:p-4"><StatCard icon="🎓" value="98%" label="Taux de réussite" /><StatCard icon="📚" value="6+" label="Niveaux scolaires" /><StatCard icon="👨‍🏫" value="15:1" label="Ratio élèves/maître" /><StatCard icon="🏆" value="30+" label="Activités extras" /><StatCard icon="👨‍👩‍👧‍👦" value="500+" label="Élèves inscrits" /></div></section>

      <section id="etablissements" className="section-shell"><SectionHeading eyebrow="POUR CHAQUE ÉTABLISSEMENT" title={<>Une solution <span className="text-blue-700">adaptée</span> à votre école</>} description="Schooly s'adapte à votre type d'établissement avec des niveaux et fonctionnalités sur mesure." /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{schoolTypes.map((item, index) => <SchoolTypeCard key={item.type} {...item} featured={index === 0} />)}</div></section>

      <section className="bg-slate-50 py-20 sm:py-24"><div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[.82fr_1.18fr] lg:px-8"><div><span className="section-eyebrow">TOUT AU MÊME ENDROIT</span><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Tout ce dont votre établissement a besoin.</h2><p className="mt-5 max-w-lg leading-7 text-slate-600">Schooly réunit les outils indispensables pour simplifier votre gestion scolaire et améliorer la collaboration entre tous les acteurs.</p><Link href="#fonctionnalites" className="mt-7 inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-3 font-bold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800">Découvrir les fonctionnalités<ArrowIcon /></Link></div><DashboardMockup /></div></section>

      <section id="fonctionnalites" className="section-shell"><SectionHeading eyebrow="UNE PLATEFORME COMPLÈTE" title={<>Des fonctionnalités pensées pour <span className="text-blue-700">votre quotidien</span></>} description="Moins de tâches dispersées, plus de temps pour l'essentiel : accompagner les élèves." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([icon, title, description]) => <FeatureCard key={title} icon={icon} title={title} description={description} />)}</div></section>

      <section id="espaces" className="bg-white py-20 sm:py-24"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><SectionHeading eyebrow="NOS ESPACES SCHOOLY" title={<>Chaque acteur a son <span className="text-blue-700">espace</span></>} description="Une expérience adaptée à l'administration, aux enseignants, aux élèves et aux parents." /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{spaces.map(([role, title, description]) => <SpaceCard key={role} role={role} title={title} description={description} />)}</div></div></section>

      <section className="overflow-hidden bg-[#063b91] py-20 text-white sm:py-24"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><span className="text-xs font-black tracking-[.22em] text-cyan-200">ILS UTILISENT SCHOOLY</span><h2 className="mt-4 text-3xl font-black sm:text-4xl">Une gestion scolaire plus simple au quotidien.</h2><p className="mt-4 text-blue-100/80">Une expérience conçue pour rapprocher l'établissement, les enseignants, les élèves et les parents.</p></div><div className="mt-10 grid gap-5 md:grid-cols-3"><Testimonial quote="Schooly nous aide à centraliser les informations et à mieux suivre nos élèves." name="Direction d'établissement" role="Administration" /><Testimonial quote="Les présences et les notes sont beaucoup plus simples à suivre au quotidien." name="Équipe pédagogique" role="Enseignants" /><Testimonial quote="Les parents disposent enfin d'une vue claire sur la scolarité de leur enfant." name="Communauté scolaire" role="Parents" /></div></div></section>

      <section className="relative overflow-hidden bg-slate-50 py-16 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-blue-700 to-cyan-500 px-6 py-12 text-center text-white shadow-2xl shadow-blue-900/15 sm:px-10 lg:flex lg:items-center lg:justify-between lg:text-left"><div className="relative z-10"><p className="text-sm font-bold text-cyan-100">PRÊT À PASSER À L'ÉTAPE SUIVANTE ?</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Simplifiez la gestion de votre établissement.</h2><p className="mt-3 max-w-2xl text-blue-50/85">Rejoignez les établissements qui veulent une gestion plus claire, plus moderne et mieux connectée.</p></div><Link href={primaryHref} className="relative z-10 mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-bold text-blue-800 shadow-xl lg:mt-0">{user ? "Accéder à mon espace" : "Commencer gratuitement"}<ArrowIcon /></Link><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[45px] border-white/10" /></div></div></section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: React.ReactNode; description: string }) { return <div className="mx-auto mb-12 max-w-2xl text-center"><span className="section-eyebrow">{eyebrow}</span><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h2><p className="mt-4 leading-7 text-slate-600">{description}</p></div>; }
function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) { return <div className="rounded-2xl border border-slate-100 bg-white px-3 py-4 text-center"><span className="text-2xl">{icon}</span><p className="mt-1 text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">{label}</p></div>; }
function SchoolTypeCard({ type, accent, levels, description, featured }: { type: SchoolType; accent: string; levels: string[]; description: string; featured?: boolean }) { return <article className={`group rounded-3xl border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${featured ? "border-blue-200 shadow-blue-900/5" : "border-slate-100"}`}><div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-xl text-white shadow-lg`}>{SCHOOL_TYPE_ICONS[type]}</div><h3 className="text-lg font-black text-slate-900">{SCHOOL_TYPE_LABELS[type]}</h3><p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-500">{description}</p><div className="mt-4 flex flex-wrap gap-1.5">{levels.map((level) => <span key={level} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{level}</span>)}</div></article>; }
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) { return <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><IconBubble name={icon} /><h3 className="mt-5 font-black text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></article>; }
function SpaceCard({ role, title, description }: { role: string; title: string; description: string }) { return <article className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 shadow-sm"><div className="relative flex h-36 items-end overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500 p-5"><div className="absolute -right-6 -top-8 h-28 w-28 rounded-full border-[20px] border-white/10" /><div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">{role === "admin" ? "🏫" : role === "teacher" ? "👨‍🏫" : role === "student" ? "🎓" : "👨‍👩‍👧"}</div></div><div className="p-5"><h3 className="font-black text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div></article>; }
function Testimonial({ quote, name, role }: { quote: string; name: string; role: string }) { return <article className="rounded-3xl border border-white/10 bg-white p-6 text-slate-800 shadow-xl"><div className="text-2xl text-blue-700">“</div><p className="mt-2 text-sm leading-6">{quote}</p><div className="mt-6 border-t border-slate-100 pt-4"><p className="font-black">{name}</p><p className="text-xs text-slate-500">{role}</p></div></article>; }
function IconBubble({ name }: { name: string }) { const icons: Record<string, string> = { students: "👥", teachers: "👨‍🏫", grades: "📝", attendance: "✓", messages: "💬", calendar: "📅" }; return <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-700">{icons[name] ?? "✦"}</div>; }
function HeroVisual() { const floating = [["📝", "Notes", "left-2 top-20"], ["✓", "Présences", "right-1 top-16"], ["💬", "Messages", "left-0 bottom-20"], ["📅", "Emploi du temps", "right-0 bottom-16"], ["📊", "Statistiques", "right-12 top-1/2"]]; return <div className="relative mx-auto h-[390px] w-full max-w-[590px]"><div className="absolute inset-8 rounded-full bg-cyan-300/20 blur-2xl" /><div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[18px] border-cyan-200/50 bg-gradient-to-br from-blue-500/70 to-indigo-900/80 shadow-[0_0_80px_rgba(34,211,238,.25)] sm:h-[350px] sm:w-[350px]" /><div className="absolute left-1/2 top-[43%] z-10 flex w-[245px] -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:w-[285px]"><div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-white/95 shadow-2xl sm:h-48 sm:w-48"><div className="text-7xl sm:text-8xl">👨🏾‍💼</div></div><div className="-mt-4 rounded-2xl bg-white px-6 py-4 text-center shadow-2xl"><div className="text-xs font-bold text-slate-400">TABLEAU DE BORD</div><div className="mt-1 text-sm font-black text-slate-900">Schooly</div></div></div><div className="absolute bottom-6 left-1/2 h-8 w-72 -translate-x-1/2 rounded-full bg-blue-950/30 blur-xl" />{floating.map(([emoji, label, position]) => <div key={label} className={`absolute z-20 hidden items-center gap-2 rounded-full border border-white/30 bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur sm:flex ${position}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-sm">{emoji}</span>{label}</div>)}</div>; }
function DashboardMockup() { return <div className="relative"><div className="absolute -inset-5 rounded-[2.5rem] bg-blue-600/10 blur-2xl" /><div className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"><div className="flex h-12 items-center justify-between border-b border-slate-100 px-4"><div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /></div><div className="h-2 w-28 rounded-full bg-slate-100" /><div className="h-7 w-7 rounded-full bg-blue-100" /></div><div className="grid min-h-[350px] grid-cols-[88px_1fr]"><div className="space-y-3 bg-[#062f75] p-3"><div className="mx-auto h-7 w-7 rounded-lg bg-white/20" />{[1,2,3,4,5,6].map((item) => <div key={item} className={`mx-auto h-8 w-8 rounded-lg ${item === 1 ? "bg-cyan-400/70" : "bg-white/10"}`} />)}</div><div className="bg-slate-50 p-5"><div className="flex items-end justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vue d'ensemble</div><div className="mt-1 text-xl font-black text-slate-900">Bonjour, Administration</div></div><div className="hidden h-8 w-20 rounded-lg bg-blue-100 sm:block" /></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Élèves","528","👥"],["Classes","24","🏫"],["Présences","92%","✓"],["Paiements","84%","₣"]].map(([label,value,icon]) => <div key={label} className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-xs">{icon}</div><div className="mt-2 text-lg font-black text-slate-900">{value}</div><div className="text-[10px] text-slate-400">{label}</div></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs font-bold text-slate-500">Évolution des inscriptions</div><div className="mt-5 flex h-32 items-end gap-2">{[38,48,42,62,56,76,70,88,82,96].map((height,index) => <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-700 to-cyan-400" style={{height: `${height}%`}} />)}</div></div><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs font-bold text-slate-500">Répartition</div><div className="mx-auto mt-5 flex h-28 w-28 items-center justify-center rounded-full border-[18px] border-cyan-400 border-r-violet-400 border-b-amber-400"><span className="text-xs font-black text-slate-700">100%</span></div></div></div></div></div></div></div>; }
function ArrowIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></svg>; }
