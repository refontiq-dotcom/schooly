"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  completeCounterEnrollment,
  getEnrollmentQuote,
  validatePreEnrollment,
  type CounterEnrollmentResult,
} from "@/app/dashboard/admissions/actions"
import { PAYMENT_LABELS, type PaymentMethod } from "@/app/dashboard/admissions/enrollment-utils"
import { toast } from "sonner"
import { Banknote, Loader2, Wallet } from "lucide-react"

type GradeLevel = { id: string; name: string }
type SchoolClass = { id: string; name: string; grade_level_id?: string }

export type CounterPrefill = {
  preEnrollmentId?: string
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  gradeLevelId?: string
  guardianPhone?: string
  guardianName?: string
  birthCertificateNumber?: string
  paymentMethod?: string | null
  paymentReference?: string | null
}

type SuccessState = CounterEnrollmentResult

function formatFCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}

export function CounterEnrollmentModal({
  open,
  onOpenChange,
  gradeLevels,
  classes,
  prefill,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gradeLevels: GradeLevel[]
  classes: SchoolClass[]
  prefill?: CounterPrefill | null
  onCompleted: () => Promise<void> | void
}) {
  const isFromPreEnrollment = Boolean(prefill?.preEnrollmentId)
  const [loading, setLoading] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [gradeLevelId, setGradeLevelId] = useState("")
  const [classId, setClassId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null)
  const [yearLabel, setYearLabel] = useState<string | null>(null)
  const [collectPayment, setCollectPayment] = useState(true)
  const [success, setSuccess] = useState<SuccessState | null>(null)

  useEffect(() => {
    if (!open) return
    setSuccess(null)
    setGradeLevelId(prefill?.gradeLevelId ?? "")
    setClassId("")
    setCollectPayment(true)
    const mapped = prefill?.paymentMethod
    setPaymentMethod(
      mapped === "mobile_money" || mapped === "check" || mapped === "transfer" ? mapped : "cash"
    )
  }, [open, prefill])

  useEffect(() => {
    if (!open || !gradeLevelId) {
      setSuggestedAmount(null)
      setYearLabel(null)
      return
    }
    let cancelled = false
    setQuoting(true)
    getEnrollmentQuote(gradeLevelId)
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setSuggestedAmount(null)
          setYearLabel(null)
          return
        }
        setSuggestedAmount(res.data?.amount ?? 0)
        setYearLabel(res.data?.academicYearLabel ?? null)
      })
      .finally(() => {
        if (!cancelled) setQuoting(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, gradeLevelId])

  const gradeLabel = gradeLevels.find((g) => g.id === gradeLevelId)?.name
  const classesForLevel = classes.filter(
    (c) => !c.grade_level_id || !gradeLevelId || c.grade_level_id === gradeLevelId
  )

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    formData.set("collectPayment", collectPayment ? "1" : "0")
    formData.set("gradeLevelId", gradeLevelId)
    formData.set("classId", classId)
    formData.set("paymentMethod", paymentMethod)
    if (prefill?.preEnrollmentId) {
      formData.set("preEnrollmentId", prefill.preEnrollmentId)
    }

    const result = prefill?.preEnrollmentId
      ? await validatePreEnrollment(formData)
      : await completeCounterEnrollment(formData)

    if (result.error) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      setSuccess(result.data)
      toast.success(
        result.data.receiptNumber
          ? `Inscription et encaissement OK — ${result.data.matricule}`
          : `Inscription OK — ${result.data.matricule}`
      )
      await onCompleted()
    }
    setLoading(false)
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogClose onClick={() => onOpenChange(false)} />
      {success ? (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>Inscription confirmee</DialogTitle>
            <DialogDescription>
              Matricule genere. {success.receiptNumber ? "Recu d'encaissement emis." : "Aucun encaissement."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <p>
              Matricule : <span className="font-mono font-semibold">{success.matricule}</span>
            </p>
            <p>
              Badge QR : <span className="font-mono text-xs break-all">{success.qrCode}</span>
            </p>
            {success.receiptNumber && (
              <>
                <p>Recu : <span className="font-mono">{success.receiptNumber}</span></p>
                <p>Encaisse : {formatFCFA(success.amountCollected)}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form action={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {isFromPreEnrollment ? "Valider au guichet" : "Inscrire au guichet"}
            </DialogTitle>
            <DialogDescription>
              {isFromPreEnrollment
                ? "Verifiez les pieces, encaissez, puis confirmez. Le matricule et le recu QR sont generes ensemble."
                : "Inscription directe au secretariat : identite, parent ou tuteur, encaissement immediat."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prenom *</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                defaultValue={prefill?.firstName ?? ""}
                disabled={loading}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                name="lastName"
                required
                defaultValue={prefill?.lastName ?? ""}
                disabled={loading || isFromPreEnrollment}
                className="min-h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date de naissance *</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                required
                defaultValue={prefill?.dateOfBirth ?? ""}
                disabled={loading || isFromPreEnrollment}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthCertificateNumber">N acte de naissance</Label>
              <Input
                id="birthCertificateNumber"
                name="birthCertificateNumber"
                defaultValue={prefill?.birthCertificateNumber ?? ""}
                disabled={loading || isFromPreEnrollment}
                className="min-h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Niveau *</Label>
            <Select
              value={gradeLevelId}
              onValueChange={setGradeLevelId}
              name="gradeLevelId"
              required
              displayLabel={gradeLabel}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selectionner un niveau" />
              </SelectTrigger>
              <SelectContent>
                {gradeLevels.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {classesForLevel.length > 0 && (
            <div className="space-y-2">
              <Label>Classe (optionnel)</Label>
              <Select
                value={classId}
                onValueChange={setClassId}
                name="classId"
                displayLabel={classesForLevel.find((c) => c.id === classId)?.name}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Affecter plus tard" />
                </SelectTrigger>
                <SelectContent>
                  {classesForLevel.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guardianName">Nom du parent ou tuteur *</Label>
              <Input
                id="guardianName"
                name="guardianName"
                required
                defaultValue={prefill?.guardianName ?? ""}
                disabled={loading || (isFromPreEnrollment && Boolean(prefill?.guardianName))}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianPhone">Telephone parent ou tuteur *</Label>
              <Input
                id="guardianPhone"
                name="guardianPhone"
                type="tel"
                required
                defaultValue={prefill?.guardianPhone ?? ""}
                disabled={loading}
                className="min-h-11"
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={collectPayment}
                onChange={(e) => setCollectPayment(e.target.checked)}
                disabled={loading}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Encaisser maintenant
              </span>
            </label>

            {collectPayment && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (FCFA) *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min={1}
                    step={1}
                    required
                    defaultValue={suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : ""}
                    key={`${gradeLevelId}-${suggestedAmount ?? "none"}`}
                    disabled={loading}
                    className="min-h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    {quoting
                      ? "Calcul du tarif..."
                      : suggestedAmount != null
                        ? `Tarif grille${yearLabel ? ` (${yearLabel})` : ""} : ${formatFCFA(suggestedAmount)}`
                        : "Aucun tarif pour ce niveau — saisissez le montant encaisse."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Mode de paiement *</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                    name="paymentMethod"
                    displayLabel={PAYMENT_LABELS[paymentMethod]}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod !== "cash" && (
                  <div className="space-y-2">
                    <Label htmlFor="paymentReference">
                      {paymentMethod === "check"
                        ? "N° de cheque *"
                        : paymentMethod === "mobile_money"
                          ? "N° de transaction Mobile Money"
                          : "Reference du virement"}
                    </Label>
                    <Input
                      id="paymentReference"
                      name="paymentReference"
                      required={paymentMethod === "check"}
                      placeholder={
                        paymentMethod === "check"
                          ? "Numero figurant sur le cheque"
                          : "Optionnel — pour le rapprochement"
                      }
                      defaultValue={prefill?.paymentReference ?? ""}
                      disabled={loading}
                      className="min-h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      {paymentMethod === "check"
                        ? "La reference du cheque est requise pour l'encaissement."
                        : "Utile pour retrouver la transaction lors du rapprochement."}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" className="min-h-11" disabled={loading || !gradeLevelId}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {collectPayment ? "Inscrire et encaisser" : "Inscrire sans encaisser"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
