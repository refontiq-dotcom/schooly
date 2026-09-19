import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizePhone, pickNextLevel } from "@/lib/reinscription"
import { findGuardiansByPhone, loadChildren, loadLevelsWithSeats } from "@/lib/reinscription-data"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function checkAuth(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false
  const token = authHeader.split(" ")[1]
  return token === process.env.TROUVETOU_API_KEY_PEPPER || token === process.env.TROUVETOU_API_KEY
}

/** Alphabet sans caractères ambigus (pas de I, O, 0, 1) — cf. admissions/actions.ts. */
function generateCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** Code unique dans l'école (même invariant que la pré-inscription publique). */
async function issueUniqueCode(schoolId: string): Promise<string> {
  let code = generateCode()
  for (let attempts = 0; attempts < 5; attempts++) {
    const { data: existing } = await supabase
      .from("pre_enrollments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("code", code)
      .is("deleted_at", null)
      .maybeSingle()

    if (!existing) return code
    code = generateCode()
  }
  return `${generateCode(4)}${Date.now().toString().slice(-2)}`
}

/**
 * POST /api/v1/public/ecoles/[id]/reinscription/confirm
 *
 * Réinscription en un clic — étape 2 : « oui, il continue ».
 * Le parent confirme ; AUCUN champ technique n'est demandé. L'identité de
 * l'élève, son matricule et le parent sont repris de la base.
 *
 * La place est revérifiée ICI en temps réel : entre l'affichage de l'écran et
 * la confirmation, un autre parent a pu prendre la dernière place.
 *
 * Body: { parent_phone: string, student_id: string, level_id?: string }
 *
 * Réponses :
 *   201 { success, code, expires_at, level, created }
 *   200 { success, code, expires_at, already: true } — confirmation déjà reçue
 *   400 paramètres manquants
 *   403 élève non rattaché au parent, ou niveau hors établissement
 *   404 école non publiée / enfant introuvable
 *   409 plus de place disponible
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
    const { parent_phone, student_id, level_id } = body ?? {}

    const phoneNorm = normalizePhone(parent_phone)
    if (!phoneNorm || !student_id) {
      return NextResponse.json(
        { error: "Numero de telephone du parent et identifiant eleve requis" },
        { status: 400 }
      )
    }

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
    const child = children.find((c) => c.student_id === student_id)
    if (!child) {
      return NextResponse.json(
        { error: "Cet eleve n'est pas rattache a ce numero dans cet etablissement" },
        { status: 403 }
      )
    }
    const levels = await loadLevelsWithSeats(supabase, schoolId)

    // Niveau cible : explicite (le parent a corrigé la proposition) ou déduit
    // de la progression. Dans les deux cas il doit appartenir à l'établissement.
    let target = level_id ? levels.find((l) => l.id === level_id) ?? null : null
    if (level_id && !target) {
      return NextResponse.json({ error: "Niveau inconnu dans cet etablissement" }, { status: 403 })
    }
    if (!target) {
      const currentName = child.current_level?.name ?? child.previous_class ?? null
      const next = pickNextLevel(currentName, levels)
      if (!next) {
        return NextResponse.json(
          { error: "Aucune classe suivante trouvee — contactez l'etablissement" },
          { status: 409 }
        )
      }
      target = levels.find((l) => l.id === next.id) ?? null
    }
    if (!target) {
      return NextResponse.json({ error: "Niveau introuvable" }, { status: 404 })
    }

    // Règle produit : de la place dans l'établissement AVANT de continuer.
    if (target.places_disponibles <= 0) {
      return NextResponse.json(
        { error: `Plus de place disponible en ${target.name}` },
        { status: 409 }
      )
    }

    // Idempotence : une confirmation déjà enregistrée (moins de 72 h) est
    // renvoyée telle quelle plutôt que dupliquée — un parent qui reclique, ou
    // un retry réseau du connecteur, ne doit pas créer deux dossiers.
    const { data: existing } = await supabase
      .from("pre_enrollments")
      .select("id, code, expires_at")
      .eq("school_id", schoolId)
      .eq("guardian_phone", phoneNorm)
      .eq("date_of_birth", child.date_of_birth ?? "")
      .eq("first_name", child.first_name)
      .eq("last_name", child.last_name)
      .eq("enrollment_type", "reinscription")
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        already: true,
        code: existing.code,
        expires_at: existing.expires_at,
        level: { id: target.id, label: target.name },
      })
    }

    const code = await issueUniqueCode(schoolId)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 72)

    const { error: insertError } = await supabase.from("pre_enrollments").insert({
      school_id: schoolId,
      first_name: child.first_name,
      last_name: child.last_name,
      date_of_birth: child.date_of_birth,
      grade_level_id: target.id,
      guardian_phone: phoneNorm,
      guardian_name: guardians[0]?.full_name ?? null,
      enrollment_type: "reinscription",
      state_orientation: "non_oriente",
      previous_matricule: child.matricule,
      status: "pending",
      source: "trouvetou",
      code,
      expires_at: expiresAt.toISOString(),
    })

    if (insertError) {
      console.error("[Reinscription Confirm] Insert error:", insertError.message)
      return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        created: true,
        code,
        expires_at: expiresAt.toISOString(),
        level: { id: target.id, label: target.name },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
}