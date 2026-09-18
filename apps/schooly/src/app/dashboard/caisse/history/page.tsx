import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPayments } from "@/app/dashboard/finance/actions"
import { CreditCard, Download } from "lucide-react"

export default async function CaisseHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!roleData?.school_id) redirect("/login")

  const { data: payments } = await getPayments(roleData.school_id)

  const total = (payments || []).reduce((sum: number, p: any) => sum + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historique des encaissements</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total : {total.toLocaleString("fr-FR")} FCFA · {(payments || []).length} transaction(s)
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Matricule</th>
                  <th className="text-left p-3 font-medium">Élève</th>
                  <th className="text-left p-3 font-medium">Tuteur</th>
                  <th className="text-left p-3 font-medium">Mode</th>
                  <th className="text-right p-3 font-medium">Montant</th>
                  <th className="text-right p-3 font-medium">Réf.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(payments || []).map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">
                      {new Date(p.received_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3 font-mono">{p.enrollments?.matricule || "—"}</td>
                    <td className="p-3">
                      {p.enrollments?.students?.last_name} {p.enrollments?.students?.first_name}
                    </td>
                    <td className="p-3">{p.enrollments?.guardians?.full_name || "—"}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className="capitalize">
                        {p.payment_method === "mobile_money" ? "Mobile Money" : p.payment_method}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {p.amount.toLocaleString("fr-FR")} FCFA
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{p.reference || "—"}</td>
                  </tr>
                ))}
                {(payments || []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Aucun encaissement enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
