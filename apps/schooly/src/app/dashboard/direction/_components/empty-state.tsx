import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { GraduationCap, Users } from "lucide-react"

export function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="rounded-full bg-primary/10 p-3">
          <GraduationCap className="h-6 w-6 text-primary" />
        </span>
        <div className="space-y-1">
          <h3 className="font-semibold">Votre établissement n’est pas encore configuré</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Créez votre année académique, vos niveaux et vos classes, puis
            inscrivez vos premiers élèves pour voir vos indicateurs apparaître.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard/academic-structure"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <GraduationCap className="h-4 w-4" /> Structurer l’établissement
          </Link>
          <Link
            href="/dashboard/direction/admissions"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Users className="h-4 w-4" /> Inscrire des élèves
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
