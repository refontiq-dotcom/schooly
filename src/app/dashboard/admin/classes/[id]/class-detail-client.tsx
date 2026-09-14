"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignTeacher,
  removeStudent,
  removeTeacherAssignment,
  transferStudent,
  updateSection,
} from "@/lib/classes/actions";

type Teacher = { id: string; full_name: string };

type Assignment = {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
};

type Student = {
  id: string;
  fullName: string;
  parentPhone: string | null;
  birthdate: string | null;
  attendanceRate: number | null;
  average: number | null;
  feesDue: number;
  feesPaid: number;
};

type OtherSection = { id: string; label: string; remaining: number };

type SectionInfo = {
  id: string;
  name: string;
  capacity: number;
  seatsTaken: number;
  homeroomTeacherId: string | null;
  levelName: string;
};

export default function ClassDetailClient({
  section,
  teachers,
  assignments,
  students,
  classAverage,
  otherSections,
}: {
  section: SectionInfo;
  teachers: Teacher[];
  assignments: Assignment[];
  students: Student[];
  classAverage: number | null;
  otherSections: OtherSection[];
}) {
  const router = useRouter();

  const [settingsError, settingsAction, settingsPending] = useActionState(
    updateSection,
    null
  );
  const lastSettings = useRef(false);
  useEffect(() => {
    if (lastSettings.current && !settingsPending && !settingsError) router.refresh();
    lastSettings.current = settingsPending;
  }, [settingsPending, settingsError, router]);

  const [assignError, assignAction, assignPending] = useActionState(
    assignTeacher,
    null
  );
  const lastAssign = useRef(false);
  useEffect(() => {
    if (lastAssign.current && !assignPending && !assignError) router.refresh();
    lastAssign.current = assignPending;
  }, [assignPending, assignError, router]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<string | null>) {
    setBusyId(key);
    setActionError(null);
    const error = await fn();
    setBusyId(null);
    if (error) setActionError(error);
    else router.refresh();
  }

  const fillRate =
    section.capacity > 0
      ? Math.round((section.seatsTaken / section.capacity) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm text-slate-500">{section.levelName}</p>
          <h1 className="text-2xl font-bold text-navy">{section.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {section.seatsTaken} / {section.capacity} élèves
            {classAverage !== null && <> · Moyenne de classe : {classAverage}/20</>}
          </p>
        </div>
        <div className="w-40">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                fillRate >= 100
                  ? "bg-red-500"
                  : fillRate >= 90
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, fillRate)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 text-right">{fillRate}% rempli</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Paramètres de la classe</h2>
          <form action={settingsAction} className="space-y-3">
            <input type="hidden" name="section_id" value={section.id} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500" htmlFor="section-name">Nom</label>
                <input
                  id="section-name"
                  name="name"
                  required
                  defaultValue={section.name}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500" htmlFor="section-capacity">Capacité</label>
                <input
                  id="section-capacity"
                  name="capacity"
                  type="number"
                  min={section.seatsTaken || 1}
                  required
                  defaultValue={section.capacity}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500" htmlFor="section-homeroom">Professeur titulaire</label>
              <select
                id="section-homeroom"
                name="homeroom_teacher_id"
                defaultValue={section.homeroomTeacherId ?? ""}
                className="input"
              >
                <option value="">— Aucun —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            {settingsError && <p className="text-sm text-red-600" role="alert">{settingsError}</p>}
            <button type="submit" disabled={settingsPending} className="btn-primary min-h-11">
              {settingsPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Professeurs affectés</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">Aucun professeur affecté.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.teacherName}</p>
                    <p className="text-xs text-slate-500">{a.subject}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === `remove-assignment-${a.id}`}
                    onClick={() =>
                      run(`remove-assignment-${a.id}`, () => removeTeacherAssignment(a.id))
                    }
                    className="btn-secondary text-xs min-h-9 px-3"
                  >
                    {busyId === `remove-assignment-${a.id}` ? "…" : "Retirer"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form action={assignAction} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <input type="hidden" name="section_id" value={section.id} />
            <div>
              <label className="text-xs text-slate-500" htmlFor="assign-teacher">Professeur</label>
              <select id="assign-teacher" name="teacher_id" required className="input">
                <option value="" disabled>Sélectionner</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500" htmlFor="assign-subject">Matière</label>
              <input
                id="assign-subject"
                name="subject"
                required
                placeholder="Mathématiques"
                className="input"
              />
            </div>
            <button type="submit" disabled={assignPending} className="btn-primary min-h-11">
              {assignPending ? "…" : "Affecter"}
            </button>
          </form>
          {assignError && <p className="text-sm text-red-600 mt-2" role="alert">{assignError}</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">
          Élèves ({students.length})
        </h2>
        {actionError && (
          <p className="text-sm text-red-600 mb-3" role="alert">{actionError}</p>
        )}
        {students.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun élève inscrit dans cette section.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Élève</th>
                  <th className="py-2">Téléphone parent</th>
                  <th className="py-2">Présence (30j)</th>
                  <th className="py-2">Moyenne</th>
                  <th className="py-2">Frais</th>
                  <th className="py-2">Transférer</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    otherSections={otherSections}
                    busy={busyId === `student-${s.id}`}
                    onTransfer={(targetId) =>
                      run(`student-${s.id}`, () => {
                        const fd = new FormData();
                        fd.set("student_id", s.id);
                        fd.set("target_section_id", targetId);
                        return transferStudent(null, fd);
                      })
                    }
                    onRemove={() =>
                      run(`student-${s.id}`, () => removeStudent(s.id, section.id))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentRow({
  student,
  otherSections,
  busy,
  onTransfer,
  onRemove,
}: {
  student: Student;
  otherSections: OtherSection[];
  busy: boolean;
  onTransfer: (targetSectionId: string) => void;
  onRemove: () => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const available = otherSections.filter((s) => s.remaining > 0);

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 font-medium text-slate-800">{student.fullName}</td>
      <td className="py-2 text-slate-500">{student.parentPhone ?? "—"}</td>
      <td className="py-2">
        {student.attendanceRate === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span
            className={
              student.attendanceRate >= 90
                ? "text-emerald-600"
                : student.attendanceRate >= 75
                  ? "text-amber-600"
                  : "text-red-600"
            }
          >
            {student.attendanceRate}%
          </span>
        )}
      </td>
      <td className="py-2">
        {student.average === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span
            className={
              student.average >= 12
                ? "text-emerald-600"
                : student.average >= 10
                  ? "text-amber-600"
                  : "text-red-600"
            }
          >
            {student.average}/20
          </span>
        )}
      </td>
      <td className="py-2 text-slate-500 tabular-nums">
        {student.feesPaid} / {student.feesDue} FCFA
      </td>
      <td className="py-2">
        {available.length > 0 ? (
          <div className="flex items-center gap-1">
            <select
              aria-label={`Transférer ${student.fullName}`}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="input w-40 text-xs"
            >
              <option value="" disabled>Vers…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.remaining})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!targetId || busy}
              onClick={() => onTransfer(targetId)}
              className="btn-secondary text-xs min-h-9 px-2"
            >
              →
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Aucune place ailleurs</span>
        )}
      </td>
      <td className="py-2 text-right">
        {confirmingRemove ? (
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmingRemove(false);
                onRemove();
              }}
              className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-200"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingRemove(true)}
            className="text-[10px] font-semibold text-red-500 hover:text-red-700"
          >
            Retirer
          </button>
        )}
      </td>
    </tr>
  );
}
