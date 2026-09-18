import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizePhone, pickNextLevel } from "@/lib/reinscription"
import { findGuardiansByPhone, loadChildren, loadLevelsWithSeats } from "@/lib/reinscription-data"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function checkAuth(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false
  const token = authHeader.split(" ")[1]
  return token === process.env.TROUVETOU_API_KEY_PEPPER || token === process.env.TROUVETOU_API_KEY
}

/**
 * POST /api/v1/public/ecoles/[id]/reinscription/check
 *
 * Réinscription en un clic — étape 1 : « qui est cet enfant ? ».
 * Le parent ne remplit AUCUN formulaire technique : il donne le téléphone
 * utilisé lors de l'inscription, le système retrouve ses enfants déjà inscrits
 * dans l'école et propose pour chacun la classe suivante (pré-remplie).
 *
 * Body: { parent_phone: string, student_birthdate?: string }
 *
 * Réponses :
 *   200 { eleves: [...], places_ok: boolean }
 *   400 numéro manquant ou illisible
 *   404 école non publiée, ou aucun enfant rattaché à ce numéro
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: schoolId } = await params

  try {
    const body = await request.json()
    const { parent_phone, student_birthdate } = body ?? {}

    const phoneNorm = normalizePhone(parent_phone)
    if (!phoneNorm) {
      return NextResponse.json({ error: "Numero de telephone du parent manquant" }, { status: 400 })
    }

    // L'école doit être publiée : on n'expose la structure d'un établissement
    // non publié sur aucun canal externe.
    const { data: school } = await supabase
      .from("schools")
      .select("id, name")
      .eq("id", schoolId)
      .eq("published_to_trouvetou", true)
      .is("deleted_at", null)
      .maybeSingle()

    if (!school) {
      return NextResponse.json({ error: "Ecole non trouvee ou non publiee" }, { status: 404 })
    }

    const guardians = await findGuardiansByPhone(supabase, phoneNorm)
    if (guardians.length === 0) {
      return NextResponse.json({ error: "Aucun eleve trouve pour ce numero" }, { status: 404 })
    }

    const children = await loadChildren(
      supabase,
      schoolId,
      guardians.map((g) => g.id)
    )
    if (children.length === 0) {
      return NextResponse.json(
        { error: "Aucun eleve rattache a ce numero dans cet etablissement" },
        { status: 404 }
      )
    }

    const levels = await loadLevelsWithSeats(supabase, schoolId)

    // Filtre facultatif sur la date de naissance : utile quand le numéro est
    // partagé (plusieurs tuteurs sous le même téléphone) ou pour lever un doute.
    const filtered = student_birthdate
      ? children.filter((c) => c.date_of_birth === student_birthdate)
      : children

    if (filtered.length === 0) {
      return NextResponse.json(
        { error: "Aucun eleve ne correspond a cette date de naissance pour ce numero" },
        { status: 404 }
      )
    }

    const eleves = filtered.map((child) => {
      // Niveau de référence : la dernière inscription en base prime sur la
      // classe déclarée à l'entrée (celle-ci peut dater d'une autre école).
      const currentName = child.current_level?.name ?? child.previous_class ?? null
      const next = pickNextLevel(currentName, levels)
      const nextWithSeats = next ? levels.find((l) => l.id === next.id) ?? null : null

      return {
        student_id: child.student_id,
        prenom: child.first_name,
        nom: child.last_name,
        date_naissance: child.date_of_birth,
        matricule: child.matricule,
        classe_actuelle: child.current_level?.name ?? child.previous_class ?? null,
        niveau_suggere: nextWithSeats
          ? { id: nextWithSeats.id, label: nextWithSeats.name }
          : null,
        places_disponibles: nextWithSeats?.places_disponibles ?? 0,
        // Le parent ne peut confirmer que si une classe d'accueil existe ET
        // qu'il reste de la place : c'est la règle « il doit y avoir de la
        // place dans l'établissement choisi avant de continuer ».
        peut_reinscrire: !!nextWithSeats && nextWithSeats.places_disponibles > 0,
      }
    })

    return NextResponse.json({
      success: true,
      school: { id: school.id, name: school.name },
      eleves,
      places_ok: eleves.some((e) => e.peut_reinscrire),
    })
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
}
