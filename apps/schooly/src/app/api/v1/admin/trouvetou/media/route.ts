import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"

const BUCKET = "trouvetou-media"
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])

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

    const form = await request.formData()
    const file = form.get("file")
    const kind = String(form.get("kind") || "gallery")

    if (!(file instanceof File)) return NextResponse.json({ error: "Image requise" }, { status: 400 })

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("cover_photo_url, gallery_photos, photos_360")
      .eq("id", role.school_id)
      .maybeSingle()
    if (schoolError || !school) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 })

    const galleryCount = Array.isArray(school.gallery_photos)
      ? school.gallery_photos.filter((item) => typeof item === "string" && item.trim()).length
      : 0
    const hasCover = typeof school.cover_photo_url === "string" && school.cover_photo_url.trim().length > 0
    const has360 = Array.isArray(school.photos_360)
      ? school.photos_360.some((item) => typeof item === "string" && item.trim())
      : false

    if (kind === "gallery" && galleryCount + (hasCover ? 1 : 0) >= 4) {
      return NextResponse.json({ error: "Maximum 4 photos classiques, photo principale comprise." }, { status: 400 })
    }
    if (kind === "360" && has360) {
      return NextResponse.json({ error: "Une seule visite 360° est autorisée par établissement." }, { status: 400 })
    }

    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Format accepte : JPG, PNG ou WebP" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image trop volumineuse (8 Mo maximum)" }, { status: 400 })
    if (!["cover", "gallery", "360", "ad"].includes(kind)) return NextResponse.json({ error: "Type de media invalide" }, { status: 400 })

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const path = `${role.school_id}/${kind}/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, cacheControl: "31536000", upsert: false })

    if (uploadError) throw uploadError

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ success: true, url: publicUrl.publicUrl, path, kind })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur upload" }, { status: 500 })
  }
}
