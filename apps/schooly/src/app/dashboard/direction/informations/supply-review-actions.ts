"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { parseClassSupplies } from "@/lib/fiches/normalize"
import type { ClassSuppliesConfiguration } from "@/lib/fiches/types"

type Result<T=unknown>={ok:boolean;data?:T;error?:string}
function adminClient(){return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{autoRefreshToken:false,persistSession:false}})}
async function directionContext(){const s=await createClient();const g=await requireSchoolRole(s,{allowedRoles:["direction","super_admin"]});if(!g.ok)return{ok:false as const,error:denial(g.reason,null).error};return{ok:true as const,...g.context}}
async function year(admin:any,schoolId:string){const {data}=await admin.from("academic_years").select("id,label").eq("school_id",schoolId).eq("status","en_cours").is("deleted_at",null).maybeSingle();return data}
export type SupplyReviewRow={id:string;class_id:string;class_name:string;subject_id:string;subject_name:string;teacher_id:string;teacher_name:string;status:string;revision:number;review_note:string|null;configurations:ClassSuppliesConfiguration}
export async function getSupplyProposalsForDirection():Promise<Result<SupplyReviewRow[]>>{
 const ctx=await directionContext();if(!ctx.ok)return ctx;const a=adminClient();const y=await year(a,ctx.schoolId);if(!y)return{ok:true,data:[]}
 const {data,error}=await a.from("school_supply_proposals").select("id,class_id,subject_id,teacher_id,status,revision,review_note,configurations,classes(name),subjects(name),users(full_name)").eq("school_id",ctx.schoolId).eq("academic_year_id",y.id).is("deleted_at",null).order("updated_at",{ascending:false})
 if(error)return{ok:false,error:error.message}
 return{ok:true,data:((data??[]) as any[]).map(p=>({id:String(p.id),class_id:String(p.class_id),class_name:String(p.classes?.name??""),subject_id:String(p.subject_id),subject_name:String(p.subjects?.name??""),teacher_id:String(p.teacher_id),teacher_name:String(p.users?.full_name??"Enseignant"),status:String(p.status),revision:Number(p.revision??1),review_note:p.review_note??null,configurations:parseClassSupplies(p.configurations,String(p.classes?.name??""))}))}
}
export async function reviewSupplyProposal(id:string,decision:"approved"|"changes_requested"|"rejected",note:string=""):Promise<Result>{
 const ctx=await directionContext();if(!ctx.ok)return ctx;const a=adminClient();const y=await year(a,ctx.schoolId);if(!y)return{ok:false,error:"Aucune année scolaire en cours."}
 const {data:p}=await a.from("school_supply_proposals").select("id").eq("id",id).eq("school_id",ctx.schoolId).eq("academic_year_id",y.id).maybeSingle();if(!p)return{ok:false,error:"Proposition introuvable."}
 const {error}=await a.from("school_supply_proposals").update({status:decision,reviewed_at:new Date().toISOString(),reviewed_by:ctx.userId,review_note:note.trim()||null}).eq("id",id).eq("school_id",ctx.schoolId)
 if(error)return{ok:false,error:error.message};revalidatePath("/dashboard/direction/informations");revalidatePath("/dashboard/pedagogie/fournitures");return{ok:true}
}
function uniqueBy<T>(items:T[],key:(x:T)=>string){const m=new Map<string,T>();for(const x of items){const k=key(x);if(!m.has(k))m.set(k,x)}return[...m.values()]}
export async function publishClassSupplyFromProposals(classId:string):Promise<Result>{
 const ctx=await directionContext();if(!ctx.ok)return ctx;const a=adminClient();const y=await year(a,ctx.schoolId);if(!y)return{ok:false,error:"Aucune année scolaire en cours."}
 const {data:cls}=await a.from("classes").select("id,name,grade_level_id,grade_levels(name,level,cycle)").eq("id",classId).eq("school_id",ctx.schoolId).is("deleted_at",null).maybeSingle();if(!cls)return{ok:false,error:"Classe introuvable."}
 const {data:ps,error}=await a.from("school_supply_proposals").select("configurations,status").eq("school_id",ctx.schoolId).eq("academic_year_id",y.id).eq("class_id",classId).is("deleted_at",null).in("status",["submitted","approved"])
 if(error)return{ok:false,error:error.message}
 if(!ps?.length)return{ok:false,error:"Aucune proposition validée ou soumise pour cette classe."}
 const configs=ps.map((p:any)=>parseClassSupplies(p.configurations,String((cls as any).name)))
 const merged:ClassSuppliesConfiguration={status:"published",class_label:String((cls as any).name),level:Number((cls as any).grade_levels?.level??0),cycle:String((cls as any).grade_levels?.cycle??""),year:String(y.label),manuals:uniqueBy(configs.flatMap(c=>c.manuals),m=>m.subject+"|"+m.title+"|"+m.editor),stationery:uniqueBy(configs.flatMap(c=>c.stationery),s=>s.category+"|"+s.name+"|"+s.quantity),equipment:uniqueBy(configs.flatMap(c=>c.equipment),e=>e.name+"|"+e.quantity+"|"+(e.color_hint??""))}
 const payload={grade_level_id:(cls as any).grade_level_id,configurations:merged,status:"published",published_at:new Date().toISOString(),deleted_at:null}
 const {data:existing}=await a.from("school_supplies").select("id").eq("school_id",ctx.schoolId).eq("class_name",String((cls as any).name)).eq("academic_year_id",y.id).maybeSingle()
 let writeError:null|string=null
 if(existing?.id){
   const {error}=await a.from("school_supplies").update(payload).eq("id",existing.id).eq("school_id",ctx.schoolId)
   writeError=error?.message??null
 } else {
   const {error}=await a.from("school_supplies").insert({school_id:ctx.schoolId,class_name:String((cls as any).name),academic_year_id:y.id,...payload})
   writeError=error?.message??null
 }
 if(writeError)return{ok:false,error:writeError}
 revalidatePath("/dashboard/direction/informations");return{ok:true}
}
