import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import {
  fillBarClass,
  fillStatusLabel,
  summarizeFillStatus,
} from "@/lib/classes-intelligence/scoring";
import AssignTeacherForm from "../assign-teacher-form";
import HomeroomForm from "../homeroom-form";
import UnassignButton from "../unassign-button";
import CapacityForm from "../capacity-form";

export const revalidate = 0;

type TeacherOption = { id: string; full_name: string };

function profileName(profiles: unknown): string | null {
  if (!profiles) return null;
  const row = Array.isArray(profiles) ? profiles[0] : profiles;
  if (row && typeof row === "object" && "full_name" in row) {
    const name = (row as { full_name?: unknown }).full_name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect(`/auth?returnTo=/dashboard/admin/classes/${id}`);
  }
  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    redirect("/dashboard/parent");
  }

  const { data: section } = await supabase
    .from("sections")
    .select("id, name, capacity, seats_taken, homeroom_teacher_id, level_id, levels(id, name, establishment_id)")
    .eq("id", id)
    .maybeSingle();

  if (!section) return notFound();

  const level = section.levels as unknown as {
    id: string;
    name: string;
    establishment_id: string;
  } | null;
  if (!level || level.establishment_id !== profile.establishment_id) return notFound();

  const [{ data: students }, { data: assignments }, { data: teachers }, { data: siblingSections }, { data: roster }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, birthdate, parent_phone")
        .eq("section_id", id)
        .order("full_name"),
      supabase
        .from("teacher_assignments")
        .select("id, teacher_id, subject, profiles(id, full_name)")
        .eq("section_id", id)
        .order("subject"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("establishment_id", profile.establishment_id)
        .eq("role", "professeur")
        .order("full_name"),
      supabase
        .from("sections")
        .select("id, name")
        .eq("level_id", section.level_id)
        .order("name"),
      supabase.from("class_section_rosters").select("*").eq("section_id", id).maybeSingle(),
    ]);

  const teacherOptions: TeacherOption[] = teachers ?? [];
  const studentCount = students?.length ?? roster?.student_count ?? 0;
  const fillRate = section.capacity > 0 ? Math.round((studentCount / section.capacity) * 100) : 0;
  const status = summarizeFillStatus(fillRate);
  const homeroom = (assignments ?? []).find((a) => a.teacher_id === section.homeroom_teacher_id);
  const homeroomName =
    roster?.homeroom_teacher_name ??
    profileName(homeroom?.profiles) ??
    teacherOptions.find((t) => t.id === section.homeroom_teacher_id)?.full_name ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/admin/classes"
          className="text-sm text-slate-500 hover:text-navy inline-flex items-center min-h-11"
        >
          Retour aux classes
        </Link>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{level.name}</p>
            <h1 className="text-2xl font-bold text-navy">{section.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {homeroomName ? `Titulaire : ${homeroomName}` : "Pas de professeur principal"}
            </p>
          </div>
          <Link
            href={`/dashboard/professeur/classe/${id}`}
            className="btn-secondary min-h-11 text-sm"
          >
            Vue pédagogique
          </Link>
        </div>
      </div>

      {(siblingSections?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
          {siblingSections!.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/admin/classes/${s.id}`}
              className={`px-3 py-2 rounded-xl text-sm font-medium min-h-11 inline-flex items-center ${
                s.id === id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-slate-500">Effectif réel</p>
          <p className="text-2xl font-bold text-navy mt-1 tabular-nums">
            {studentCount} / {section.capacity}
          </p>
          <p className="text-xs text-slate-400 mt-1">{fillStatusLabel(status)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Places libres</p>
          <p className="text-2xl font-bold text-navy mt-1 tabular-nums">
            {Math.max(0, section.capacity - studentCount)}
          </p>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${fillBarClass(status)}`}
              style={{ width: `${Math.min(100, fillRate)}%` }}
            />
          </div>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Professeurs</p>
          <p className="text-2xl font-bold text-navy mt-1 tabular-nums">{assignments?.length ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">matières affectées</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Compteur places</p>
          <p className="text-2xl font-bold text-navy mt-1 tabular-nums">{section.seats_taken}</p>
          {roster?.seats_mismatch ? (
            <p className="text-xs text-amber-700 mt-1">Différent de l&apos;effectif</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Aligné avec les élèves</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Professeur principal</h2>
        <HomeroomForm
          key={section.homeroom_teacher_id ?? "none"}
          sectionId={id}
          teachers={teacherOptions}
          currentTeacherId={section.homeroom_teacher_id}
        />
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Professionnels de la classe</h2>
        {assignments && assignments.length > 0 ? (
          <ul className="divide-y divide-slate-100 mb-4">
            {assignments.map((a) => {
              const name = profileName(a.profiles) ?? "Professeur";
              return (
                <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{name}</p>
                    <p className="text-xs text-slate-500">{a.subject}</p>
                  </div>
                  <UnassignButton assignmentId={a.id} sectionId={id} label={`${name} (${a.subject})`} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 mb-4">Aucun professeur affecté à cette classe.</p>
        )}
        <AssignTeacherForm sectionId={id} teachers={teacherOptions} />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-3">Élèves ({studentCount})</h2>
        {students && students.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Naissance</th>
                <th className="py-2">Téléphone parent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium">
                    <Link
                      href={`/dashboard/admin/eleves/${s.id}?from=classe&section=${id}`}
                      className="text-navy hover:underline min-h-11 inline-flex items-center"
                    >
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500">
                    {s.birthdate ? new Date(s.birthdate).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="py-2.5 text-slate-500">{s.parent_phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Aucun élève inscrit dans cette classe.</p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Capacité</h2>
        <CapacityForm key={section.capacity} sectionId={id} capacity={section.capacity} />
      </div>
    </div>
  );
}
