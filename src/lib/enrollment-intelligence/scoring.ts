import type { SupabaseClient } from "@supabase/supabase-js";

export type EnrollmentStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "incomplete"
  | "waitlisted"
  | "approved"
  | "rejected"
  | "cancelled";

export interface EnrollmentPipelineRow {
  id: string;
  establishment_id: string;
  reservation_id: string | null;
  student_id: string | null;
  status: EnrollmentStatus;
  modality: string;
  student_full_name: string;
  student_birthdate: string | null;
  parent_full_name: string;
  parent_phone: string;
  requested_level_id: string;
  requested_level_name: string;
  completeness_pct: number;
  duplicate_risk_score: number;
  duplicate_flags: string[];
  recommended_section_id: string | null;
  recommended_section_name: string | null;
  recommendation_score: number | null;
  recommendation_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export function enrollmentStatusLabel(status: EnrollmentStatus): string {
  const labels: Record<EnrollmentStatus, string> = {
    draft: "Brouillon",
    submitted: "Nouveau dossier",
    under_review: "À étudier",
    incomplete: "Dossier incomplet",
    waitlisted: "Liste d'attente",
    approved: "Validé",
    rejected: "Refusé",
    cancelled: "Annulé",
  };
  return labels[status];
}

export function enrollmentRiskLabel(score: number): string {
  if (score >= 80) return "Risque élevé";
  if (score >= 50) return "À vérifier";
  return "Faible risque";
}

export async function fetchEnrollmentPipeline(
  supabase: SupabaseClient,
  establishmentId: string,
  limit = 50
): Promise<EnrollmentPipelineRow[]> {
  const { data, error } = await supabase
    .from("enrollment_pipeline")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[enrollment-intelligence] pipeline error", error);
    return [];
  }
  return (data ?? []) as EnrollmentPipelineRow[];
}

export async function recomputeEnrollmentIntelligence(
  supabase: SupabaseClient,
  applicationId: string
): Promise<EnrollmentPipelineRow | null> {
  const { data, error } = await supabase.rpc("compute_enrollment_intelligence", {
    p_application_id: applicationId,
  });
  if (error) {
    console.error("[enrollment-intelligence] scoring error", error);
    return null;
  }
  return (data as EnrollmentPipelineRow | null) ?? null;
}
