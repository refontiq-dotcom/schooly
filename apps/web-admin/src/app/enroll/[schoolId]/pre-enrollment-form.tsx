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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle2, Clock } from "lucide-react"

type GradeLevel = {
  id: string
  name: string
  level: number
  cycle: string
}

export default function PreEnrollmentForm({ schoolId, gradeLevels }: { schoolId: string; gradeLevels: GradeLevel[] }) {
  const [submitted, setSubmitted] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>("")

  async function handleSubmit(formData: FormData) {
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
              <Input id="firstName" name="firstName" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input id="lastName" name="lastName" required disabled={loading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date de naissance *</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" required disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gradeLevelId">Niveau souhaité</Label>
            <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel} name="gradeLevelId">
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

          <hr className="border-border" />

          <div className="space-y-2">
            <Label htmlFor="guardianPhone">Téléphone du tuteur *</Label>
            <Input
              id="guardianPhone"
              name="guardianPhone"
              type="tel"
              placeholder="+225 07 00 00 00 00"
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Ce numéro servira à identifier le tuteur et à envoyer les communications.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enregistrement..." : "Réserver ma place"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
