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
}

export async function getTeacherSupplyAssignments(): Promise<Result<TeacherSupplyAssignment[]>> {
  const ctx = await teacherContext()
  if (!ctx.ok) return ctx
  const admin = adminClient()
  const year = await currentYearId(admin, ctx.schoolId)
  if (!year) return { ok: true, data: [] }
  const { data, error } = await admin.from("class_subject_assignments").select(
    "id,class_id,subject_id,classes(id,name,grade_level_id,grade_levels(id,name)),subjects(id,name)"
  ).eq("school_id",ctx.schoolId).eq("teacher_id",ctx.userId).is("deleted_at",null)
  if (error) return { ok:false,error:error.message }
  const rows = (data ?? []) as any[]
  return { ok:true, data:rows.map(r=>({
    assignment_id:String(r.id), class_id:String(r.class_id), class_name:String(r.classes?.name ?? ""),
    grade_level_id:String(r.classes?.grade_level_id ?? r.classes?.grade_levels?.id ?? ""),
    grade_level_name:String(r.classes?.grade_levels?.name ?? ""),
    subject_id:String(r.subject_id), subject_name:String(r.subjects?.name ?? "")
  })).filter(r=>r.class_name && r.subject_name) }
}

export async function getTeacherSupplyProposals(): Promise<Result<TeacherSupplyProposal[]>> {
  const ctx = await teacherContext()
  if (!ctx.ok) return ctx
  const admin = adminClient()
  const year = await currentYearId(admin, ctx.schoolId)
  if (!year) return { ok:true,data:[] }
  const assignments = await getTeacherSupplyAssignments()
  if (!assignments.ok) return assignments
  const proposals = await admin.from("school_supply_proposals").select("id,class_id,subject_id,status,revision,review_note,configurations").eq("school_id",ctx.schoolId).eq("academic_year_id",year.id).eq("teacher_id",ctx.userId).is("deleted_at",null)
  if (proposals.error) return { ok:false,error:proposals.error.message }
  const byKey = new Map((proposals.data ?? []).map((p:any)=>[String(p.class_id)+":"+String(p.subject_id),p]))
  return { ok:true,data:assignments.data.map(a=>{
    const p=byKey.get(a.class_id+":"+a.subject_id) as any
    const config=parseClassSupplies(p?.configurations,a.class_name)
    return { id:p?.id,assignment_id:a.assignment_id,class_id:a.class_id,subject_id:a.subject_id,class_name:a.class_name,subject_name:a.subject_name,status:p?.status ?? "draft",revision:Number(p?.revision ?? 1),review_note:p?.review_note ?? null,configurations:config }
  }) }
}

export async function saveTeacherSupplyProposal(assignmentId:string, configurations:ClassSuppliesConfiguration):Promise<Result<{status:string}>> {
  const ctx=await teacherContext()
  if(!ctx.ok)return ctx
  const admin=adminClient()
  const year=await currentYearId(admin,ctx.schoolId)
  if(!year)return {ok:false,error:"Aucune année scolaire en cours."}
  const {data:assignment}=await admin.from("class_subject_assignments").select("id,class_id,subject_id,classes(name),subjects(name)").eq("id",assignmentId).eq("school_id",ctx.schoolId).eq("teacher_id",ctx.userId).is("deleted_at",null).maybeSingle()
  if(!assignment)return {ok:false,error:"Cette affectation pédagogique est introuvable."}
  const className=String((assignment as any).classes?.name ?? "")
  const parsed=parseClassSupplies(configurations,className)
  const {data:existing}=await admin.from("school_supply_proposals").select("id,revision,status").eq("school_id",ctx.schoolId).eq("academic_year_id",year.id).eq("class_id",(assignment as any).class_id).eq("subject_id",(assignment as any).subject_id).eq("teacher_id",ctx.userId).is("deleted_at",null).maybeSingle()
  const nextStatus=existing?.status === "approved" ? "submitted" : (existing?.status === "submitted" ? "submitted" : "draft")
  const payload={school_id:ctx.schoolId,academic_year_id:year.id,class_id:(assignment as any).class_id,subject_id:(assignment as any).subject_id,teacher_id:ctx.userId,configurations:parsed,status:nextStatus,revision:Number(existing?.revision ?? 0)+1,review_note:null}
  const {error}=await admin.from("school_supply_proposals").upsert(payload,{onConflict:"school_id,academic_year_id,class_id,subject_id,teacher_id"})
  if(error)return {ok:false,error:error.message}
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
  const {data:assignment}=await admin.from("class_subject_assignments").select("id,class_id,subject_id,classes(name)").eq("id",assignmentId).eq("school_id",ctx.schoolId).eq("teacher_id",ctx.userId).is("deleted_at",null).maybeSingle()
  if(!assignment)return {ok:false,error:"Affectation introuvable."}
  const {data:proposal}=await admin.from("school_supply_proposals").select("id,configurations").eq("school_id",ctx.schoolId).eq("academic_year_id",year.id).eq("class_id",(assignment as any).class_id).eq("subject_id",(assignment as any).subject_id).eq("teacher_id",ctx.userId).is("deleted_at",null).maybeSingle()
  if(!proposal)return {ok:false,error:"Enregistrez votre proposition avant de la soumettre."}
  const parsed=parseClassSupplies(proposal.configurations,String((assignment as any).classes?.name ?? ""))
  if(!parsed.manuals.length&&!parsed.stationery.length&&!parsed.equipment.length)return {ok:false,error:"Ajoutez au moins une fourniture."}
  const {error}=await admin.from("school_supply_proposals").update({configurations:parsed,status:"submitted",submitted_at:new Date().toISOString(),review_note:null}).eq("id",proposal.id).eq("teacher_id",ctx.userId)
  if(error)return {ok:false,error:error.message}
  revalidatePath("/dashboard/pedagogie/fournitures"); revalidatePath("/dashboard/direction/informations")
  return {ok:true,data:{status:"submitted"}}
}
