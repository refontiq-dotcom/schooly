import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import ClassDetailClient from "./class-detail-client";

export const revalidate = 0;

type Teacher = { id: string; full_name: string };

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  subject: string;
  profiles: { full_name: string } | null;
};

type StudentRow = {
  id: string;
  full_name: string;
  parent_phone: string | null;
  birthdate: string | null;
};

type StudentFeeRow = { student_id: string; amount: number; amount_paid: number };

/** Jalon de la fenêtre de présence analysée (30 jours). */
function attendanceCutoff(): string {
  return new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
}

export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, profile } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/admin/classes");
  if (profile?.role !== "admin" || !profile.establishment_id) {
    return <div className="card text-slate-500">Action réservée à l&apos;administrateur.</div>;
  }

  // Section + niveau
  const { data: section } = await supabase
    .from("sections")
    .select("*, levels(name, establishment_id)")
    .eq("id", id)
    .maybeSingle() as { data: (Record<string, unknown> & {
      id: string; name: string; capacity: number; seats_taken: number;
      homeroom_teacher_id: string | null;
      levels: { name: string; establishment_id: string } | null;
    }) | null };

  if (!section || section.levels?.establishment_id !== profile.establishment_id) {
    notFound();
  }

  const cutoffDate = attendanceCutoff();

  const [
    teachersRes,
    assignmentsRes,
    studentsRes,
    feesRes,
    attendanceRes,
    gradesRes,
    siblingSectionsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("establishment_id", profile.establishment_id)
      .eq("role", "professeur")
      .order("full_name"),
    supabase
      .from("teacher_assignments")
      .select("id, teacher_id, subject, profiles(full_name)")
      .eq("section_id", id),
    supabase
      .from("students")
      .select("id, full_name, parent_phone, birthdate")
      .eq("section_id", id)
      .order("full_name"),
    supabase
      .from("student_fees")
      .select("student_id, amount, amount_paid")
      .in(
        "student_id",
        (await supabase.from("students").select("id").eq("section_id", id)).data?.map((s) => s.id) ?? ["00000000-0000-0000-0000-000000000000"]
      ),
    supabase
      .from("attendance_records")
      .select("student_id, present")
      .in(
        "student_id",
        (await supabase.from("students").select("id").eq("section_id", id)).data?.map((s) => s.id) ?? ["00000000-0000-0000-0000-000000000000"]
      )
      .gte("session_date", cutoffDate),
    supabase
      .from("grades")
      .select("student_id, score, max_score")
      .in(
        "student_id",
        (await supabase.from("students").select("id").eq("section_id", id)).data?.map((s) => s.id) ?? ["00000000-0000-0000-0000-000000000000"],
      ),
    supabase
      .from("sections")
      .select("id, name, capacity, seats_taken, levels!inner(name, establishment_id)")
      .eq("levels.establishment_id", profile.establishment_id)
      .order("name"),
  ]);

  const teachers = (teachersRes.data ?? []) as Teacher[];
  const assignments = (assignmentsRes.data ?? []) as unknown as TeacherAssignment[];
  const students = (studentsRes.data ?? []) as StudentRow[];
  const fees = (feesRes.data ?? []) as StudentFeeRow[];
  const attendance = (attendanceRes.data ?? []) as { student_id: string; present: boolean }[];
  const grades = (gradesRes.data ?? []) as { student_id: string; score: number; max_score: number }[];
  const siblingSections = (siblingSectionsRes.data ?? []) as unknown as {
    id: string; name: string; capacity: number; seats_taken: number;
    levels: { name: string }[];
  }[];

  // Stats par élève
  const studentIds = new Set(students.map((s) => s.id));
  const attendanceRate = new Map<string, number>();
  const attByStudent = new Map<string, { total: number; present: number }>();
  for (const a of attendance) {
    if (!studentIds.has(a.student_id)) continue;
    const entry = attByStudent.get(a.student_id) ?? { total: 0, present: 0 };
    entry.total += 1;
    if (a.present) entry.present += 1;
    attByStudent.set(a.student_id, entry);
  }
  for (const [sid, e] of attByStudent) {
    attendanceRate.set(sid, e.total > 0 ? Math.round((e.present / e.total) * 100) : 100);
  }

  const avgByStudent = new Map<string, number>();
  const gradesByStudent = new Map<string, { sum: number; count: number }>();
  for (const g of grades) {
    if (!studentIds.has(g.student_id) || g.max_score <= 0) continue;
    const entry = gradesByStudent.get(g.student_id) ?? { sum: 0, count: 0 };
    entry.sum += (g.score / g.max_score) * 20;
    entry.count += 1;
    gradesByStudent.set(g.student_id, entry);
  }
  for (const [sid, e] of gradesByStudent) {
    avgByStudent.set(sid, Math.round((e.sum / e.count) * 10) / 10);
  }

  // Frais par élève
  const balanceByStudent = new Map<string, { due: number; paid: number }>();
  for (const f of fees) {
    if (!studentIds.has(f.student_id)) continue;
    const e = balanceByStudent.get(f.student_id) ?? { due: 0, paid: 0 };
    e.due += f.amount;
    e.paid += f.amount_paid;
    balanceByStudent.set(f.student_id, e);
  }

  const classAverage =
    avgByStudent.size > 0
      ? Math.round(
          (Array.from(avgByStudent.values()).reduce((a, b) => a + b, 0) / avgByStudent.size) * 10
        ) / 10
      : null;

  return (
    <ClassDetailClient
      section={{
        id: section.id,
        name: section.name,
        capacity: section.capacity,
        seatsTaken: section.seats_taken,
        homeroomTeacherId: section.homeroom_teacher_id,
        levelName: section.levels?.name ?? "",
      }}
      teachers={teachers}
      assignments={assignments.map((a) => ({
        id: a.id,
        teacherId: a.teacher_id,
        teacherName: a.profiles?.full_name ?? "?",
        subject: a.subject,
      }))}
      students={students.map((s) => ({
        id: s.id,
        fullName: s.full_name,
        parentPhone: s.parent_phone,
        birthdate: s.birthdate,
        attendanceRate: attendanceRate.get(s.id) ?? null,
        average: avgByStudent.get(s.id) ?? null,
        feesDue: balanceByStudent.get(s.id)?.due ?? 0,
        feesPaid: balanceByStudent.get(s.id)?.paid ?? 0,
      }))}
      classAverage={classAverage}
      otherSections={siblingSections
        .filter((s) => s.id !== section.id && s.capacity - s.seats_taken > 0)
        .map((s) => ({
          id: s.id,
          label: `${s.levels[0]?.name ?? "?"} · ${s.name}`,
          remaining: s.capacity - s.seats_taken,
        }))}
    />
  );
}
