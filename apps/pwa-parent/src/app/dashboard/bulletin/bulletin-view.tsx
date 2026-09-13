"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { getBulletinData, type BulletinData } from "../actions"
import { Button } from "@/components/ui/button"
import { Loader2, Printer } from "lucide-react"
import { BulletinPdfButton } from "./bulletin-pdf-button"

const DECISION_LABELS: Record<string, string> = {
  admitted: "Admis",
  repeated: "Redouble",
  excluded: "Exclu",
  pending: "En attente du conseil",
}

function appreciation(moyenne: number | null) {
  if (moyenne === null) return "—"
  if (moyenne >= 16) return "Très bien"
  if (moyenne >= 14) return "Bien"
  if (moyenne >= 12) return "Assez bien"
  if (moyenne >= 10) return "Passable"
  return "Insuffisant"
}

export function BulletinView({ enrollmentId }: { enrollmentId: string }) {
  const [data, setData] = useState<BulletinData | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!enrollmentId) {
      setErrorCode("NO_ID")
      return
    }
    startTransition(async () => {
      const result = await getBulletinData(enrollmentId)
      if (result.ok) setData(result.data)
      else setErrorCode(result.code)
    })
  }, [enrollmentId])

  if (errorCode) {
    return (
      <div className="rounded-lg bg-card p-8 text-center text-sm text-muted-foreground">
        {errorCode === "NOT_YOUR_CHILD"
          ? "Ce bulletin n'est pas accessible depuis votre compte."
          : errorCode === "NO_ID"
            ? "Aucun enfant sélectionné. Retournez au tableau de bord et choisissez un enfant."
            : "Bulletin indisponible pour le moment."}
        <div className="mt-4">
                    <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Retour au tableau de bord</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!data || isPending) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Préparation du bulletin…
      </div>
    )
  }

  const { child, schoolCity, subjectAverages, generalAverage, decision, observations, councilAverage } = data

  return (
    <div className="space-y-4">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="flex items-center justify-between print:hidden">
                <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">← Retour</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Imprimer
          </Button>
          <BulletinPdfButton data={data} />
        </div>
      </div>

      {/* Document imprimable */}
      <div className="rounded-lg border bg-white p-6 text-black print:rounded-none print:border-0 print:p-0">
        <header className="border-b-2 border-black/20 pb-3 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            {child.schoolName}
            {schoolCity ? ` — ${schoolCity}` : ""}
          </h1>
          <p className="text-xs text-black/60">Bulletin de notes — {child.yearLabel}</p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="text-black/60">Élève :</span>{" "}
            <strong>
              {child.studentName}
              {child.matricule ? ` (${child.matricule})` : ""}
            </strong>
          </p>
          <p>
            <span className="text-black/60">Classe :</span> <strong>{child.className ?? "—"}</strong>
          </p>
          <p>
            <span className="text-black/60">Niveau :</span> {child.gradeLevel}
          </p>
          <p>
            <span className="text-black/60">Édité le :</span>{" "}
            {new Date().toLocaleDateString("fr-FR")}
          </p>
        </section>

        <h2 className="mt-5 text-sm font-bold uppercase">Synthèse par matière</h2>
        <table className="mt-1 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/30 text-left text-xs uppercase text-black/60">
              <th className="py-1">Matière</th>
              <th className="py-1 text-center">Moy. /20</th>
              <th className="py-1 text-center">Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {subjectAverages.map((s) => (
              <tr key={s.subject} className="border-b border-black/10">
                <td className="py-1.5">{s.subject}</td>
                <td className="py-1.5 text-center font-semibold">
                  {s.average === null ? "—" : s.average.toFixed(2)}
                </td>
                <td className="py-1.5 text-center">{appreciation(s.average)}</td>
              </tr>
            ))}
            {subjectAverages.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-center text-black/50">
                  Aucune note saisie pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between rounded-md bg-amber-50 px-4 py-2 ring-1 ring-amber-200">
          <span className="text-sm font-bold">Moyenne générale</span>
          <span className="text-lg font-bold text-amber-700">
            {generalAverage === null ? "—" : `${generalAverage.toFixed(2)} / 20`}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            <span className="text-black/60">Décision du conseil :</span>{" "}
            <strong>{DECISION_LABELS[decision] ?? decision}</strong>
          </p>
          {councilAverage !== null && (
            <p>
              <span className="text-black/60">Moyenne du conseil :</span>{" "}
              <strong>{councilAverage.toFixed(2)} / 20</strong>
            </p>
          )}
        </div>

        {observations && (
          <section className="mt-4">
            <h2 className="text-sm font-bold uppercase">Observations</h2>
            <p className="mt-1 whitespace-pre-wrap rounded-md bg-black/[0.03] p-3 text-sm">
              {observations}
            </p>
          </section>
        )}

        <footer className="mt-6 flex items-end justify-between border-t border-black/20 pt-2 text-[10px] text-black/50">
          <span>Document généré par Schooly — vérifiable auprès du secrétariat.</span>
          <span>
            Édité le {new Date().toLocaleDateString("fr-FR")} ·{" "}
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </footer>
      </div>
    </div>
  )
}


