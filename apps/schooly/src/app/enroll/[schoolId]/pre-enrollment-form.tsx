"use client"

import { useState } from "react"
import { createPreEnrollment } from "@/app/dashboard/admissions/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { CheckCircle2, Clock, CreditCard, FileText, Package } from "lucide-react"

type GradeLevel = {
  id: string
  name: string
  level: number
  cycle: string
}

type ChecklistItem = {
  id: string
  nom: string
  montant_cash: number | null
  obligatoire: boolean
  ordre_affichage: number
}

type RequiredDocument = {
  id: string
  nom: string
  obligatoire: boolean
  applicable_to_level_id: string | null
}

type PaymentMethod = {
  id: string
  type: "especes" | "esperes" | "mobile_money" | "virement_bancaire" | "cheque"
  config_details: Record<string, unknown> | null
}

const PAYMENT_LABELS: Record<PaymentMethod["type"], string> = {
  especes: "Espèces (au guichet)",
  esperes: "Espèces (au guichet)",
  mobile_money: "Mobile Money",
  virement_bancaire: "Virement bancaire",
  cheque: "Chèque",
}

export default function PreEnrollmentForm({
  schoolId,
  gradeLevels,
  checklistItems,
  requiredDocuments,
  paymentMethods,
}: {
  schoolId: string
  gradeLevels: GradeLevel[]
  checklistItems: ChecklistItem[]
  requiredDocuments: RequiredDocument[]
  paymentMethods: PaymentMethod[]
}) {
  const [submitted, setSubmitted] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>("")
  const [acceptedChecklist, setAcceptedChecklist] = useState<Record<string, boolean>>({})
  const [providedDocuments, setProvidedDocuments] = useState<Record<string, boolean>>({})
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("")

  const selectedGrade = gradeLevels.find((level) => level.id === selectedGradeLevel)

  const applicableDocuments = requiredDocuments.filter(
    (doc) => !doc.applicable_to_level_id || doc.applicable_to_level_id === selectedGradeLevel
  )

  const requiredChecklistMissing = checklistItems.some(
    (item) => item.obligatoire && !acceptedChecklist[item.id]
  )
  const requiredDocumentsMissing = applicableDocuments.some(
    (doc) => doc.obligatoire && !providedDocuments[doc.id]
  )

  const formatFCFA = (amount: number | null) => {
    if (amount === null) return null
    return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
  }

  async function handleSubmit(formData: FormData) {
    if (requiredChecklistMissing || requiredDocumentsMissing) {
      toast.error("Cochez toutes les fournitures et pieces obligatoires.")
      return
    }
    formData.set(
      "acceptedChecklist",
      JSON.stringify(Object.keys(acceptedChecklist).filter((id) => acceptedChecklist[id]))
    )
    formData.set(
      "providedDocuments",
      JSON.stringify(Object.keys(providedDocuments).filter((id) => providedDocuments[id]))
    )
    setLoading(true)
    const result = await createPreEnrollment(formData)
    
    if (result.error) {
      toast.error(result.error)
    } else if (result.data?.code) {
      setCode(result.data.code)
      setSubmitted(true)
      toast.success("Pré-inscription enregistrée !")
    }
    setLoading(false)
  }

  if (submitted && code) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h3 className="text-xl font-semibold text-green-800 dark:text-green-200">Pré-inscription enregistrée !</h3>
            <p className="text-sm text-green-600 dark:text-green-300">
              Votre code de pré-inscription est :
            </p>
            <div className="inline-block bg-white dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg px-6 py-3">
              <span className="text-2xl font-mono font-bold tracking-widest text-green-700 dark:text-green-300">{code}</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-300 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" /> Valable 72h
            </p>
            <p className="text-xs text-green-600 dark:text-green-300">
              Présentez-vous au guichet de l'établissement avec ce code pour finaliser l'inscription.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations de l'élève</CardTitle>
        <CardDescription>
          Tous les champs marqués * sont obligatoires.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">
          <input type="hidden" name="schoolId" value={schoolId} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
               <Input id="firstName" name="firstName" required disabled={loading} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input id="lastName" name="lastName" required disabled={loading} className="min-h-11" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date de naissance *</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" required disabled={loading} className="min-h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthCertificateNumber">N acte de naissance</Label>
            <Input id="birthCertificateNumber" name="birthCertificateNumber" disabled={loading} className="min-h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gradeLevelId">Niveau souhaité *</Label>
            <Select
              value={selectedGradeLevel}
              onValueChange={setSelectedGradeLevel}
              name="gradeLevelId"
              required
              displayLabel={selectedGrade ? `${selectedGrade.name} — ${selectedGrade.cycle}` : undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un niveau" />
              </SelectTrigger>
              <SelectContent>
                {gradeLevels.map(level => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name} — {level.cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {checklistItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" />
                Fournitures scolaires
              </div>
              <p className="text-xs text-muted-foreground">
                Liste définie par l'établissement. Les articles cochés seront à fournir lors de la finalisation.
              </p>
              <div className="space-y-2">
                {checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`checklist-${item.id}`}
                        checked={acceptedChecklist[item.id] || false}
                        onChange={(e) => setAcceptedChecklist((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                        disabled={loading}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`checklist-${item.id}`} className="text-sm font-normal cursor-pointer">
                          {item.nom}
                          {item.obligatoire && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {item.montant_cash !== null && (
                          <p className="text-xs text-muted-foreground">Valeur indicative : {formatFCFA(item.montant_cash)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {applicableDocuments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Pièces à fournir
              </div>
              <p className="text-xs text-muted-foreground">
                Documents demandés par l'établissement pour ce niveau.
              </p>
              <div className="space-y-2">
                {applicableDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`doc-${doc.id}`}
                        checked={providedDocuments[doc.id] || false}
                        onChange={(e) => setProvidedDocuments((prev) => ({ ...prev, [doc.id]: e.target.checked }))}
                        disabled={loading}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor={`doc-${doc.id}`} className="text-sm font-normal cursor-pointer">
                        {doc.nom}
                        {doc.obligatoire && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paymentMethods.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-primary" />
                Moyen de paiement
              </div>
              <p className="text-xs text-muted-foreground">
                Choisissez comment vous régulariserez les frais. Le virement bancaire nécessite une validation manuelle par le secrétariat.
              </p>
              <div className="space-y-2">
                {paymentMethods.map((pm) => (
                  <label
                    key={pm.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedPaymentMethod === pm.id ? "border-primary bg-muted/30" : "hover:bg-muted/20"}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethodId"
                      value={pm.id}
                      checked={selectedPaymentMethod === pm.id}
                      onChange={() => setSelectedPaymentMethod(pm.id)}
                      disabled={loading}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">{PAYMENT_LABELS[pm.type]}</span>
                      {pm.config_details && typeof pm.config_details === "object" && "instructions" in pm.config_details && (
                        <p className="text-xs text-muted-foreground">{String(pm.config_details.instructions)}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <hr className="border-border" />

          <div className="space-y-2">
            <Label htmlFor="guardianName">Nom du tuteur *</Label>
            <Input
              id="guardianName"
              name="guardianName"
              required
              disabled={loading}
              className="min-h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guardianPhone">Téléphone du tuteur *</Label>
            <Input
              id="guardianPhone"
              name="guardianPhone"
              type="tel"
              placeholder="+225 07 00 00 00 00"
              required
              disabled={loading}
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">
              Ce numéro servira à identifier le tuteur et à envoyer les communications.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full min-h-11"
            disabled={loading || !selectedGradeLevel || requiredChecklistMissing || requiredDocumentsMissing}
          >
            {loading ? "Enregistrement..." : "Réserver ma place"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
