import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { verifyReceipt } from "@/app/dashboard/finance/actions"
import { CheckCircle2, XCircle, QrCode, School } from "lucide-react"
import Image from "next/image"

interface Props {
  params: Promise<{ code: string }>
}

export default async function VerifyReceiptPage({ params }: Props) {
  const { code } = await params
  const { data, error } = await verifyReceipt(code)

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Reçu introuvable</h1>
            <p className="text-sm text-muted-foreground">
              Ce code de vérification n'existe pas ou a été supprimé.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const payment = (data as any).payments
  const school = (data as any).schools

  return (
    <div className="min-h-screen bg-muted/40 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src="/schooly_logo_vector.svg" alt="Schooly" className="h-10 w-auto" />
          </div>
          <h1 className="text-2xl font-bold">Vérification de reçu</h1>
          <p className="text-sm text-muted-foreground">
            {school?.name} — {school?.city}
          </p>
        </div>

        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Reçu valide et authentique
                </h2>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Ce reçu a été émis par {school?.name} et n'a pas été modifié.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détails du paiement</CardTitle>
            <CardDescription>Reçu n° {(data as any).receipt_number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Élève</p>
                <p className="font-medium">
                  {payment?.enrollments?.students?.last_name} {payment?.enrollments?.students?.first_name}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Matricule</p>
                <p className="font-mono font-medium">{payment?.enrollments?.matricule || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tuteur</p>
                <p className="font-medium">{payment?.enrollments?.guardians?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">
                  {payment?.received_at ? new Date(payment.received_at).toLocaleString("fr-FR") : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Mode</p>
                <p className="font-medium capitalize">
                  {payment?.payment_method === "mobile_money" ? "Mobile Money" : payment?.payment_method || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Référence</p>
                <p className="font-medium">{payment?.reference || "—"}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-muted-foreground text-sm">Montant payé</p>
              <p className="text-3xl font-bold font-mono">
                {payment?.amount?.toLocaleString("fr-FR")} FCFA
              </p>
            </div>

            <div className="flex items-center justify-center pt-4 border-t">
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">QR Code de vérification</p>
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent((data as any).qr_code_data)}`}
                  alt="QR Code"
                  width={150}
                  height={150}
                  className="mx-auto"
                />
                <p className="text-xs font-mono text-muted-foreground">
                  {(data as any).verification_code}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-center text-muted-foreground">
              Cette page est générée automatiquement par Schooly. Pour toute contestation, contactez l'établissement.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
