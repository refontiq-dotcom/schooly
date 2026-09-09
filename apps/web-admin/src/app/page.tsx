import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-4">
          <Badge variant="outline" className="text-primary border-primary">Schooly V2</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Design System Premium</h1>
          <p className="text-muted-foreground text-lg">Fondations visuelles validées. L'interface est prête pour un usage intensif au guichet (Zero-Training UX).</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Encaissement Rapide</CardTitle>
              <CardDescription>Saisissez le matricule de l'élève pour encaisser ou vérifier ses droits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="matricule">Matricule Élève</Label>
                <Input id="matricule" placeholder="Ex: SCH-2026-001" className="h-12 text-lg" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" className="h-11 px-8">Annuler</Button>
              <Button className="h-11 px-8">Rechercher</Button>
            </CardFooter>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Aperçu des statuts sémantiques</CardTitle>
              <CardDescription>Les couleurs sont étudiées pour être lisibles en plein jour et réduire l'effort cognitif.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 pt-4">
              <Badge className="px-3 py-1 text-sm">Inscription Validée</Badge>
              <Badge variant="secondary" className="px-3 py-1 text-sm">En attente (Trouvetou)</Badge>
              <Badge variant="destructive" className="px-3 py-1 text-sm">Impayé bloquant</Badge>
              <Badge variant="outline" className="px-3 py-1 text-sm text-muted-foreground">Archive N-1</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
