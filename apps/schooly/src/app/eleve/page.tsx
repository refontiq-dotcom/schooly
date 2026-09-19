import { createClient } from "@supabase/supabase-js"
import { BookOpen, GraduationCap, Lock, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getStudentEnrollmentId, lockStudentPortal } from "./actions"
import { QrUnlockForm } from "./qr-unlock-form"
import { FadeIn, GeminiBackdrop, GradientText } from "@/components/gemini"
import type { ReactNode } from "react"

export const dynamic = "force-dynamic"

/** Conteneur du portail : décor Gemini + contenu centré par-dessus. */
function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <GeminiBackdrop />
      <div className="relative z-10 w-full max-w-2xl">{children}</div>
    </div>
  )
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

type EnrollmentInfo = {
  id: string
  class_id: string | null
  students: { first_name: string; last_name: string } | null
  classes: { name: string } | null
  academic_years: { label: string } | null
  schools: { name: string } | null
}

export default async function ElevePortalPage() {
  const enrollmentId = await getStudentEnrollmentId()

  // ————— Non déverrouillé : formulaire code QR —————
  if (!enrollmentId) {
    return (
      <PortalShell>
        <FadeIn>
          <div className="mx-auto max-w-md">
            <QrUnlockForm />
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Session valable 8 h, révocable par la vie scolaire.
            </p>
          </div>
        </FadeIn>
      </PortalShell>
    )
  }

  const db = admin()

  // ————— Vérifie que le QR est toujours actif + infos inscription —————
  const { data: qrRow } = await db
    .from("student_qr_codes")
    .select("id, is_active, enrollment_id")
    .eq("enrollment_id", enrollmentId)
    .is("deleted_at", null)
    .limit(1)

  const qr = (qrRow ?? [])[0]
  if (!qr || !qr.is_active) {
    return (
      <PortalShell>
        <FadeIn>
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Accès révoqué</CardTitle>
                <CardDescription>
                  Votre code d&apos;accès a été désactivé. Contactez la vie scolaire.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={lockStudentPortal} className="text-center">
                  <Button variant="outline" type="submit">
                    <LogOut className="h-4 w-4" /> Réinitialiser
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      </PortalShell>
    )
  }

  const { data: enrRows } = await db
    .from("enrollments")
    .select(
      `id, class_id,
       students ( first_name, last_name ),
       classes ( name ),
       academic_years ( label ),
       schools ( name )`
    )
    .eq("id", enrollmentId)
    .is("deleted_at", null)
    .limit(1)

  const enrollment = (enrRows ?? [])[0] as unknown as EnrollmentInfo | undefined
  if (!enrollment) {
    return (
      <PortalShell>
        <FadeIn>
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Inscription introuvable</CardTitle>
                <CardDescription>Contactez le secrétariat de votre école.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </FadeIn>
      </PortalShell>
    )
  }

  // ————— Cahier de texte publié de la classe —————
  let homeworks: {
    id: string
    title: string
    description: string | null
    due_date: string
    subjects: { name: string } | null
  }[] = []
  if (enrollment.class_id) {
    const { data: hws } = await db
      .from("homeworks")
      .select("id, title, description, due_date, subjects ( name )")
      .eq("class_id", enrollment.class_id)
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(20)
    homeworks = (hws ?? []) as any
  }

  // ————— Notes + moyenne pondérée /20 —————
  const { data: gr } = await db
    .from("grade_entries")
    .select("id, label, grade_type, value, max_value, weight, comment, subjects ( name )")
    .eq("enrollment_id", enrollmentId)
    .is("period_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const grades = (gr ?? []).map((g) => ({
    id: g.id,
    label: g.label,
    value: Number(g.value),
    maxValue: Number(g.max_value),
    weight: Number(g.weight),
    subject: g.subjects?.[0]?.name ?? "—",
    comment: g.comment,
  }))

  let weightedSum = 0
  let totalWeight = 0
  for (const g of grades) {
    weightedSum += (g.value / g.maxValue) * 20 * g.weight
    totalWeight += g.weight
  }
  const average = totalWeight > 0 ? weightedSum / totalWeight : null

  // ————— Bulletin officiel publié (statut « sent » uniquement) —————
  type OfficialContent = {
    subjects: { name: string; coefficient: number; periods: { label: string; average: number | null }[] }[]
    annual: { average: number | null; decision: string; observations: string | null }
    rule: { scale: number }
  }
  const { data: rc } = await db
    .from("report_cards")
    .select("content, version, sent_at")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "sent")
    .is("deleted_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
  const reportCard = (rc ?? [])[0] as unknown as
    | { content: OfficialContent; version: number; sent_at: string }
    | undefined

  const studentName = enrollment.students
    ? `${enrollment.students.first_name} ${enrollment.students.last_name}`
    : "Élève"

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="relative min-h-screen">
      <GeminiBackdrop />
      <div className="relative z-10 mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* En-tête élève */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bonjour, <GradientText>{studentName}</GradientText>
            </h1>
            <p className="text-sm text-muted-foreground">
              {enrollment.schools?.name ?? "—"} · {enrollment.classes?.name ?? "—"} ·{" "}
              {enrollment.academic_years?.label ?? "—"}
            </p>
          </div>
          {average !== null && (
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-4">
                <GraduationCap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Moyenne générale</p>
                  <p className="text-xl font-bold text-primary">{average.toFixed(2)} / 20</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.15} className="space-y-6">
      {/* Cahier de texte */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="h-5 w-5 text-primary" /> Cahier de texte
        </h2>
        {homeworks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun devoir publié pour votre classe.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {homeworks.map((h) => (
              <Card key={h.id} className="py-4">
                <CardContent className="space-y-1 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{h.title}</p>
                    <Badge variant="secondary">{fmtDate(h.due_date)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{h.subjects?.name ?? "—"}</p>
                  {h.description && (
                    <p className="text-sm text-muted-foreground">{h.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-5 w-5 text-primary" /> Mes notes
        </h2>
        {grades.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucune note saisie pour le moment.
            </CardContent>
          </Card>
        ) : (
          <Card className="py-2">
            <CardContent className="divide-y px-4 py-0">
              {grades.map((g) => {
                const note = (g.value / g.maxValue) * 20
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{g.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.subject} · coef. {g.weight}
                        {g.comment ? ` · ${g.comment}` : ""}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-bold ${
                        note >= 10 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {g.value.toFixed(2)}/{g.maxValue}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Bulletin officiel publié */}
      {reportCard && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <GraduationCap className="h-5 w-5 text-primary" /> Bulletin officiel
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Résultats annuels — publiés le {new Date(reportCard.sent_at).toLocaleDateString("fr-FR")}
              </CardTitle>
              <CardDescription>Document officiel figé par l&apos;établissement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="divide-y">
                {reportCard.content.subjects.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 py-2">
                    <span>{s.name} <span className="text-muted-foreground">· coef. {s.coefficient}</span></span>
                    <span className="font-medium">
                      {s.periods.map((p) => `${p.label} : ${p.average === null ? "—" : p.average}`).join(" · ") || "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                <span className="font-semibold">Moyenne annuelle validée</span>
                <span className="font-bold">
                  {reportCard.content.annual.average === null
                    ? "—"
                    : `${reportCard.content.annual.average} / ${reportCard.content.rule.scale}`}
                </span>
              </div>
              <p>
                Décision :{" "}
                <strong>
                  {reportCard.content.annual.decision === "admitted"
                    ? "Admis(e)"
                    : reportCard.content.annual.decision === "repeated"
                      ? "Rédoublant(e)"
                      : reportCard.content.annual.decision === "excluded"
                        ? "Exclu(e)"
                        : "En attente"}
                </strong>
              </p>
              {reportCard.content.annual.observations && (
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{reportCard.content.annual.observations}</p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Verrouiller la session */}
      <form action={lockStudentPortal} className="flex justify-center">
        <Button variant="ghost" size="sm" type="submit">
          <LogOut className="h-4 w-4" /> Verrouiller ma session
        </Button>
      </form>
      </FadeIn>
      </div>
    </div>
  )
}


