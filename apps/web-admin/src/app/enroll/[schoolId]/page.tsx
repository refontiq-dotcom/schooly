import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import PreEnrollmentForm from "./pre-enrollment-form"

interface Props {
  params: Promise<{ schoolId: string }>
}

export default async function EnrollPage({ params }: Props) {
  const { schoolId } = await params
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: school } = await admin
    .from("schools")
    .select("id, name, city")
    .eq("id", schoolId)
    .is("deleted_at", null)
    .single()

  if (!school) return notFound()

  const { data: gradeLevels } = await admin
    .from("grade_levels")
    .select("id, name, level, cycle")
    .eq("school_id", schoolId)
    .order("level", { ascending: true })

  return (
    <div className="min-h-screen bg-muted/40 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img src="/schooly_logo_vector.svg" alt="Schooly" className="h-12 w-auto" />
          </div>
          <h1 className="text-3xl font-bold">Pré-inscription</h1>
          <p className="text-muted-foreground">
            {school.name} — {school.city}
          </p>
          <p className="text-sm text-muted-foreground">
            Remplissez ce formulaire pour réserver une place. Vous recevrez un code de pré-inscription valable 72h.
          </p>
        </div>

        <PreEnrollmentForm schoolId={schoolId} gradeLevels={gradeLevels || []} />
      </div>
    </div>
  )
}
