// M4 — Route publique PWA : /fiche/[schoolId] (cible du QR code Mode B).
// SANS auth : page statique cote serveur qui delegue au client FicheEcole.
import { FicheEcole } from "@/components/fiches/fiche-ecole"

export const dynamic = "force-dynamic"

export default async function FichePage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params
  const apiBase = process.env.NEXT_PUBLIC_SCHOOLY_URL ?? ""
  return <FicheEcole schoolId={schoolId} apiBase={apiBase} />
}
