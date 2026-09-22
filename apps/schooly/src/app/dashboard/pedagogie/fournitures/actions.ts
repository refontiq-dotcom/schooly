"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import type { ClassSuppliesConfiguration } from "@/lib/fiches/types"
import { parseClassSupplies } from "@/lib/fiches/normalize"

type Result<T = unknown> = { ok: boolean; data?: T; error?: string }

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function teacherContext() {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: ["professeur"] })
  if (!guard.ok) return { ok: false as const, error: denial(guard.reason, null).error }
  return { ok: true as const, ...guard.context }
}

async function currentYearId(admin: ReturnType<typeof adminClient>, schoolId: string) {
  const { data } = await admin.from("academic_years").select("id,label").eq("school_id", schoolId).eq("status","en_cours").is("deleted_at",null).maybeSingle()
  return data ? { id: String(data.id), label: String(data.label) } : null
}

export type TeacherSupplyAssignment = {
  assignment_id: string
  class_id: string
  class_name: string
  grade_level_id: string
  grade_level_name: string
  subject_id: string
  subject_name: string
  scope: "class" | "subject" | "module" | "course" | "program" | "custom"
}

export type TeacherSupplyProposal = {
  id?: string
  assignment_id: string
  class_id: string
  subject_id: string
  class_name: string
  subject_name: string
  status: "draft" | "submitted" | "changes_requested" | "approved" | "rejected"
  revision: number
  review_note: string | null
  configurations: ClassSuppliesConfiguration
  scope: "class" | "subject" | "module" | "course" | "program" | "custom"
}

export async function getTeacherSupplyAssignments(): Promise<Result<TeacherSupplyAssignment[]>> {
  const ctx = await teacherContext()
  if (!ctx.ok) return ctx
  const admin = adminClient()
  const year = await currentYearId(admin, ctx.schoolId)
  if (!year) return { ok: true, data: [] }
  const { data: school } = await admin.from("schools").select("school_type").eq("id",ctx.schoolId).maybeSingle()
  if (school?.school_type === "primaire") {
    const { data, error } = await admin.from("pedagogical_assignments").select(
      "id,class_id,scope,classes(id,name,grade_level_id,grade_levels(id,name)),pedagogical_assignment_members!inner(user_id,role,is_primary)"
    ).eq("school_id",ctx.schoolId).eq("academic_year_id",year.id).eq("scope","class").eq("status","active").is("deleted_at",null)
      .eq("pedagogical_assignment_members.user_id",ctx.userId)
    if (error) return { ok:false,error:error.message }
    const rows = (data ?? []) as any[]
    return { ok:true, data:rows.map(r=>({
      assignment_id:String(r.id), class_id:String(r.class_id), class_name:String(r.classes?.name ?? ""),
      grade_level_id:String(r.classes?.grade_level_id ?? r.classes?.grade_levels?.id ?? ""),
      grade_level_name:String(r.classes?.grade_levels?.name ?? ""),
      subject_id:"", subject_name:"Toute la classe", scope:"class" as const
    })).filter(r=>r.class_name) }
  }
  const { data, error } = await admin.from("class_subject_assignments").select(
    "id,class_id,subject_id,pedagogical_assignment_id,classes(id,name,grade_level_id,grade_levels(id,name)),subjects(id,name)"
  ).eq("school_id",ctx.schoolId).eq("teacher_id",ctx.userId).is("deleted_at",null)
  if (error) return { ok:false,error:error.message }
  const rows = (data ?? []) as any[]
  return { ok:true, data:rows.map(r=>({
    assignment_id:String(r.pedagogical_assignment_id ?? r.id), class_id:String(r.class_id), class_name:String(r.classes?.name ?? ""),
    grade_level_id:String(r.classes?.grade_level_id ?? r.classes?.grade_levels?.id ?? ""),
    grade_level_name:String(r.classes?.grade_levels?.name ?? ""),
    subject_id:String(r.subject_id), subject_name:String(r.subjects?.name ?? ""), scope:"subject" as const
  })).filter(r=>r.class_name && r.subject_name) }
}

export async function getTeacherSupplyProposals(): Promise<Result<TeacherSupplyProposal[]>> {
  const ctx = await teacherContext()
  if (!ctx.ok) return ctx
  const admin = adminClient()
  const year = await currentYearId(admin, ctx.schoolId)
  if (!year) return { ok:true,data:[] }
  const assignments = await getTeacherSupplyAssignments()
  if (!assignments.ok) return { ok: false, error: assignments.error }
  const proposals = await admin.from("school_supply_proposals").select("id,assignment_id,class_id,subject_id,status,revision,review_note,configurations").eq("school_id",ctx.schoolId).eq("academic_year_id",year.id).eq("teacher_id",ctx.userId).is("deleted_at",null)
  if (proposals.error) return { ok:false,error:proposals.error.message }
  const byKey = new Map((proposals.data ?? []).map((p:any)=>[String(p.assignment_id ?? "") || String(p.class_id)+":"+String(p.subject_id)+":"+String(ctx.userId),p]))
  return { ok:true,data:(assignments.data ?? []).map(a=>{
    const p=(byKey.get(a.assignment_id) ?? byKey.get(a.class_id+":"+a.subject_id+":"+ctx.userId)) as any
    const config=parseClassSupplies(p?.configurations,a.class_name)
    return { id:p?.id,assignment_id:a.assignment_id,class_id:a.class_id,subject_id:a.subject_id,class_name:a.class_name,subject_name:a.subject_name,status:p?.status ?? "draft",revision:Number(p?.revision ?? 1),review_note:p?.review_note ?? null,configurations:config,scope:a.scope }
  }) }
}

export async function saveTeacherSupplyProposal(assignmentId:string, configurations:ClassSuppliesConfiguration):Promise<Result<{status:string}>> {
  const ctx=await teacherContext()
  if(!ctx.ok)return ctx
  const admin=adminClient()
  const year=await currentYearId(admin,ctx.schoolId)
  if(!year)return {ok:false,error:"Aucune année scolaire en cours."}

  const {data:universal}=await admin.from("pedagogical_assignments")
    .select("id,class_id,scope,classes(name)")
    .eq("id",assignmentId).eq("school_id",ctx.schoolId).eq("academic_year_id",year.id)
    .eq("status","active").is("deleted_at",null).maybeSingle()

  let assignment:any=universal
  if(!assignment){
    const {data:legacy}=await admin.from("class_subject_assignments")
      .select("id,class_id,subject_id,pedagogical_assignment_id,classes(name),subjects(name)")
      .eq("id",assignmentId).eq("school_id",ctx.schoolId).eq("teacher_id",ctx.userId).is("deleted_at",null).maybeSingle()
    if(!legacy)return {ok:false,error:"Cette affectation pédagogique est introuvable."}
    assignment=legacy
  } else {
    const {data:member}=await admin.from("pedagogical_assignment_members")
      .select("id").eq("assignment_id",assignmentId).eq("user_id",ctx.userId).eq("is_primary",true).maybeSingle()
    if(!member)return {ok:false,error:"Vous n'êtes pas responsable de cette affectation."}
    assignment.subject_id=null
  }

  const className=String(assignment.classes?.name ?? "")
  const parsed=parseClassSupplies(configurations,className)
  const universalId=String(assignment.pedagogical_assignment_id ?? assignment.id)
  const {data:existing}=await admin.from("school_supply_proposals")
    .select("id,revision,status")
    .eq("school_id",ctx.schoolId).eq("academic_year_id",year.id)
    .eq("pedagogical_assignment_id",universalId).eq("teacher_id",ctx.userId)
    .is("deleted_at",null).maybeSingle()

  const nextStatus=existing?.status === "approved" ? "submitted" : (existing?.status === "submitted" ? "submitted" : "draft")
  const payload={
    school_id:ctx.schoolId,academic_year_id:year.id,
    assignment_id:universalId,pedagogical_assignment_id:universalId,
    class_id:assignment.class_id,subject_id:assignment.subject_id || null,teacher_id:ctx.userId,
    configurations:parsed,status:nextStatus,revision:Number(existing?.revision ?? 0)+1,review_note:null
  }
  let write:any
  if(existing?.id) write=await admin.from("school_supply_proposals").update(payload).eq("id",existing.id).eq("teacher_id",ctx.userId)
  else write=await admin.from("school_supply_proposals").insert(payload)
  if(write.error)return {ok:false,error:write.error.message}
  revalidatePath("/dashboard/pedagogie/fournitures")
  revalidatePath("/dashboard/direction/informations")
  return {ok:true,data:{status:nextStatus}}
}

export async function submitTeacherSupplyProposal(assignmentId:string):Promise<Result<{status:string}>> {
  const ctx=await teacherContext()
  if(!ctx.ok)return ctx
  const admin=adminClient()
  const year=await currentYearId(admin,ctx.schoolId)
  if(!year)return {ok:false,error:"Aucune année scolaire en cours."}

  const {data:assignment}=await admin.from("pedagogical_assignments")
    .select("id,class_id,scope,classes(name)")
    .eq("id",assignmentId).eq("school_id",ctx.schoolId).eq("academic_year_id",year.id)
    .eq("status","active").is("deleted_at",null).maybeSingle()
  if(!assignment)return {ok:false,error:"Affectation pédagogique introuvable."}
  const {data:member}=await admin.from("pedagogical_assignment_members")
    .select("id").eq("assignment_id",assignmentId).eq("user_id",ctx.userId).eq("is_primary",true).maybeSingle()
  if(!member)return {ok:false,error:"Vous n'êtes pas responsable de cette affectation."}

  const {data:proposal}=await admin.from("school_supply_proposals")
    .select("id,configurations").eq("school_id",ctx.schoolId).eq("academic_year_id",year.id)
    .eq("pedagogical_assignment_id",assignmentId).eq("teacher_id",ctx.userId).is("deleted_at",null).maybeSingle()
  if(!proposal)return {ok:false,error:"Enregistrez votre proposition avant de la soumettre."}
  const parsed=parseClassSupplies(proposal.configurations,String((assignment as any).classes?.name ?? ""))
  if(!parsed.manuals.length&&!parsed.stationery.length&&!parsed.equipment.length)return {ok:false,error:"Ajoutez au moins une fourniture."}
  const {error}=await admin.from("school_supply_proposals").update({configurations:parsed,status:"submitted",submitted_at:new Date().toISOString(),review_note:null}).eq("id",proposal.id).eq("teacher_id",ctx.userId)
  if(error)return {ok:false,error:error.message}
  revalidatePath("/dashboard/pedagogie/fournitures"); revalidatePath("/dashboard/direction/informations")
  return {ok:true,data:{status:"submitted"}}
}
