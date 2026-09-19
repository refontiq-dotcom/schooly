import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { redirect } from "next/navigation"
import IntakeClient from "./client"

export default async function AdmissionsIntakePage() {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: ["direction", "secretariat"],
  })
  if (!guard.ok) redirect("/dashboard/direction/admissions")

  const [{ data: years }, { data: levels }] = await Promise.all([
    supabase.from("academic_years").select("id,label,is_current").eq("school_id", guard.context.schoolId).order("is_current", { ascending: false }).order("label", { ascending: false }),
    supabase.from("grade_levels").select("id,name,level,cycle").eq("school_id", guard.context.schoolId).is("deleted_at", null).order("level"),
  ])

  return (
    <IntakeClient
      schoolId={guard.context.schoolId}
      academicYears={years ?? []}
      gradeLevels={levels ?? []}
    />
  )
}
