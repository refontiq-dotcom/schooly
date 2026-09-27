import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { trouvetouProfileSchema } from "@/lib/schemas/trouvetou"
import { logServerEvent } from "@/lib/server-logger"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: role } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", [...TROUVETOU_ADMIN_ROLES])
      .maybeSingle()

    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const payload: unknown = await request.json()
    const parsed = trouvetouProfileSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données du profil invalides." },
        { status: 400 },
      )
    }
    const body = parsed.data

    // Règles médias Trouvetou. La source de vérité est la contrainte SQL
    // schools_trouvetou_gallery_max_4 / schools_trouvetou_photos_360_max_1
    // (migration 20260927005000) : 4 photos classiques au total, la photo
    // principale comprise, et une seule source 360°. Le schéma garantit le type
    // et la sûreté des URL (refs http/https, pas de javascript:) ; la troncature
    // garantit qu'on n'atteint jamais la contrainte, qui lèverait sinon une
    // erreur PostgreSQL à l'écriture.
    const coverPhoto = body.cover_photo_url ?? ""
    const galleryPhotos = dedupe(body.gallery_photos)
      .filter((photo) => photo !== coverPhoto)
      .slice(0, coverPhoto ? 3 : 4)
    const photos360 = dedupe(body.photos_360).slice(0, 1)

    const { error } = await admin
      .from("schools")
      .update({
        description_publique: body.description_publique,
        latitude: body.latitude,
        longitude: body.longitude,
        itineraire: body.itineraire,
        video_url: body.video_url,
        photos_360: photos360,
        cover_photo_url: coverPhoto || null,
        gallery_photos: galleryPhotos,
        public_address: body.public_address,
        public_phone: body.public_phone,
        public_email: body.public_email,
        public_website_url: body.public_website_url,
        public_highlights: dedupe(body.public_highlights),
        admission_notes: body.admission_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", role.school_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logServerEvent("error", "trouvetou.profile.failed", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Impossible d'enregistrer le profil." }, { status: 500 })
  }
}

/**
 * Déduplique une liste de chaînes déjà validée par le schéma zod (URL http/https
 * bornées, ou texte non vide). Le schéma garantit la forme ; seul le doublon
 * reste à traiter, ici et en un seul endroit.
 */
function dedupe(values: readonly string[]): string[] {
  return Array.from(new Set(values))
}
