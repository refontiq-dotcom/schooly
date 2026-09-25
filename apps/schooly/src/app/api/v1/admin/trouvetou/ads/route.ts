import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { trouvetouAdSchema } from "@/lib/schemas/trouvetou"
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
    const parsed = trouvetouAdSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données de la publicité invalides." },
        { status: 400 },
      )
    }
    const body = parsed.data

    const { error } = await admin
      .from("trouvetou_ads")
      .insert({
        school_id: role.school_id,
        ...body,
        is_active: true,
      })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logServerEvent("error", "trouvetou.ad.failed", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Impossible de créer la publicité." }, { status: 500 })
  }
}
