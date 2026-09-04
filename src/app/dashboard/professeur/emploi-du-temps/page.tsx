import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00",
];

const SUBJECT_COLORS: Record<string, string> = {
  mathématiques: "bg-blue-100 border-blue-300 text-blue-800",
  maths: "bg-blue-100 border-blue-300 text-blue-800",
  français: "bg-emerald-100 border-emerald-300 text-emerald-800",
  physique: "bg-violet-100 border-violet-300 text-violet-800",
  chimie: "bg-violet-100 border-violet-300 text-violet-800",
  histoire: "bg-amber-100 border-amber-300 text-amber-800",
  géographie: "bg-amber-100 border-amber-300 text-amber-800",
  anglais: "bg-rose-100 border-rose-300 text-rose-800",
  sport: "bg-orange-100 border-orange-300 text-orange-800",
  eps: "bg-orange-100 border-orange-300 text-orange-800",
  informatique: "bg-cyan-100 border-cyan-300 text-cyan-800",
};

const DEFAULT_SUBJECT_COLOR = "bg-slate-100 border-slate-300 text-slate-700";

function getSubjectColor(subject: string): string {
  const key = subject.toLowerCase().trim();
  return SUBJECT_COLORS[key] ?? DEFAULT_SUBJECT_COLOR;
}

function timeToIndex(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 7) * 2 + (m >= 30 ? 1 : 0);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default async function EmploiDuTempsPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur/emploi-du-temps");
  }

  let query = supabase
    .from("schedule_slots")
    .select(
      "id, day_of_week, start_time, end_time, subject, room, section_id, teacher_id, sections(name, levels(name))"
    )
    .order("day_of_week")
    .order("start_time");

  if (profile?.role === "professeur") {
    query = query.eq("teacher_id", profile.id);
  } else if (profile?.establishment_id) {
    query = query.eq("establishment_id", profile.establishment_id);
  }

  const { data: slots } = await query;

  const now = new Date();
  const currentDay = (now.getDay() + 6) % 7; // 0=lundi
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const todaySlots = (slots ?? []).filter((s) => s.day_of_week === currentDay);
  const nextSlot = todaySlots.find((s) => s.end_time > currentTime);
  const isCurrentSlot = (s: { start_time: string; end_time: string; day_of_week: number }) =>
    s.day_of_week === currentDay && s.start_time <= currentTime && s.end_time > currentTime;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#0E2D52] to-[#1A4580] rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-3xl mb-2">📅</p>
          <h1 className="text-2xl lg:text-3xl font-bold">Emploi du temps</h1>
          <p className="text-sm opacity-80 mt-1">
            {DAYS[currentDay]} — {now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {nextSlot && (
            <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-xs opacity-60 mb-1">Prochain cours</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📖</span>
                <div>
                  <p className="text-lg font-bold">{nextSlot.subject}</p>
                  <p className="text-sm opacity-80">
                    {nextSlot.start_time?.slice(0, 5)} — {nextSlot.end_time?.slice(0, 5)}
                    {(nextSlot.sections as unknown as { name: string })?.name &&
                      ` · ${(nextSlot.sections as unknown as { name: string }).name}`}
                    {nextSlot.room && ` · Salle ${nextSlot.room}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aujourd'hui - liste */}
      {todaySlots.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-navy text-sm uppercase tracking-wide">Aujourd&apos;hui</h2>
          {todaySlots.map((slot) => {
            const active = isCurrentSlot(slot);
            return (
              <div
                key={slot.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  active
                    ? "bg-blue-50 border-blue-300 shadow-sm ring-2 ring-blue-200"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`text-center min-w-[3.5rem] ${active ? "text-blue-600" : "text-slate-400"}`}>
                  <p className="text-xs font-medium">{slot.start_time?.slice(0, 5)}</p>
                  <p className="text-[10px]">↓</p>
                  <p className="text-xs font-medium">{slot.end_time?.slice(0, 5)}</p>
                </div>
                <div className={`h-10 w-1 rounded-full ${active ? "bg-blue-500" : "bg-slate-200"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy text-sm">{slot.subject}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {(slot.sections as unknown as { levels?: { name: string } | null; name: string })?.levels?.name ?? ""}{" "}
                    {(slot.sections as unknown as { name: string })?.name}
                    {slot.room && ` · ${slot.room}`}
                  </p>
                </div>
                {active && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold animate-pulse">
                    EN COURS
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grille semaine complète */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-navy">Semaine complète</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="w-16 p-2 text-xs text-slate-400 font-medium" />
                {DAYS.map((day, i) => (
                  <th
                    key={day}
                    className={`p-2 text-xs font-semibold ${
                      i === currentDay ? "text-blue-600 bg-blue-50" : "text-slate-500"
                    }`}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour} className="border-b border-slate-50">
                  <td className="p-1 text-[10px] text-slate-400 text-right pr-2 tabular-nums">{hour}</td>
                  {DAYS.map((_, dayIdx) => {
                    const slot = (slots ?? []).find(
                      (s) =>
                        s.day_of_week === dayIdx &&
                        timeToMinutes(s.start_time) <= timeToMinutes(hour) &&
                        timeToMinutes(hour) < timeToMinutes(s.end_time) &&
                        // Only show slot at its start row
                        timeToMinutes(s.start_time) === timeToMinutes(hour)
                    );
                    const slotSpan = slot
                      ? Math.ceil(
                          (timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time)) / 30
                        )
                      : 0;

                    if (slot && slotSpan > 0) {
                      return (
                        <td
                          key={dayIdx}
                          rowSpan={slotSpan}
                          className={`p-0.5 align-top`}
                        >
                          <div
                            className={`rounded-lg border p-1.5 text-[11px] leading-tight h-full ${getSubjectColor(slot.subject)}`}
                          >
                            <p className="font-semibold truncate">{slot.subject}</p>
                            <p className="opacity-70 truncate">
                              {slot.start_time?.slice(0, 5)}-{slot.end_time?.slice(0, 5)}
                            </p>
                            {(slot.sections as unknown as { name: string })?.name && (
                              <p className="opacity-60 truncate">
                                {(slot.sections as unknown as { name: string }).name}
                              </p>
                            )}
                            {slot.room && <p className="opacity-60">📍 {slot.room}</p>}
                          </div>
                        </td>
                      );
                    }

                    // Skip cells that are covered by a rowSpan
                    const isCovered = (slots ?? []).some(
                      (s) =>
                        s.day_of_week === dayIdx &&
                        timeToMinutes(s.start_time) < timeToMinutes(hour) &&
                        timeToMinutes(hour) < timeToMinutes(s.end_time)
                    );
                    if (isCovered) return null;

                    return <td key={dayIdx} className="p-0.5" />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende couleurs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SUBJECT_COLORS)
          .slice(0, 6)
          .map(([subject, color]) => (
            <span
              key={subject}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${color}`}
            >
              {subject}
            </span>
          ))}
      </div>
    </div>
  );
}
