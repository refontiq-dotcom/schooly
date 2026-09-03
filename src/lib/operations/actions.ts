"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DocumentStatus, PaymentMethod } from "@/types";

const METHODS: PaymentMethod[] = [
  "orange_money",
  "mtn_momo",
  "moov",
  "wave",
  "cash",
  "bank",
];

function num(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export async function recordPayment(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const feeId = String(formData.get("fee_id") ?? "");
  const amount = num(formData.get("amount"));
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  const reference = String(formData.get("reference") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "") === "1";

  if (!feeId) return "Échéance manquante.";
  if (!Number.isFinite(amount) || amount <= 0) return "Montant invalide.";
  if (!METHODS.includes(method)) return "Moyen de paiement invalide.";

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_fee_payment", {
    p_student_fee_id: feeId,
    p_amount: amount,
    p_method: method,
    p_reference: reference || null,
    p_confirm: confirm,
  });
  if (error) return error.message;

  revalidatePath("/dashboard/parent");
  revalidatePath("/dashboard/parent/paiements");
  revalidatePath("/dashboard/admin/paiements");
  revalidatePath("/dashboard/secretariat");
  return null;
}

export async function toggleTrouvetouPublication(published: boolean): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || !profile.establishment_id) {
    return "Action réservée à l'administrateur.";
  }

  const { error } = await supabase
    .from("establishments")
    .update({ published_to_trouvetou: published })
    .eq("id", profile.establishment_id);
  if (error) return error.message;

  revalidatePath("/dashboard/admin");
  return null;
}

export async function updateEstablishment(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const websiteUrl = String(formData.get("website_url") ?? "").trim();
  const coverImageUrl = String(formData.get("cover_image_url") ?? "").trim();
  const tour360Url = String(formData.get("tour_360_url") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const reservationFeeAmount = Number(formData.get("reservation_fee_amount"));
  const reservationHoldHours = Number(formData.get("reservation_hold_hours"));

  if (!name || !city) return "Le nom et la ville sont obligatoires.";
  if (!Number.isFinite(reservationFeeAmount) || reservationFeeAmount < 0) {
    return "Les frais de réservation sont invalides.";
  }
  if (!Number.isInteger(reservationHoldHours) || reservationHoldHours < 1) {
    return "Le délai de réservation doit être d'au moins une heure.";
  }
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) return "Le site web doit commencer par http:// ou https://.";
  if (coverImageUrl && !/^https?:\/\//i.test(coverImageUrl)) return "L'URL de la photo est invalide.";
  if (tour360Url && !/^https?:\/\//i.test(tour360Url)) return "L'URL de la visite 360° est invalide.";
  if ((Number.isFinite(latitude) && (latitude < -90 || latitude > 90)) || (Number.isFinite(longitude) && (longitude < -180 || longitude > 180))) {
    return "Les coordonnées GPS sont invalides.";
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || !profile.establishment_id) {
    return "Action réservée à l'administrateur.";
  }

  const { error } = await supabase
    .from("establishments")
    .update({
      name,
      city,
      address: address || null,
      description: description || null,
      website_url: websiteUrl || null,
      cover_image_url: coverImageUrl || null,
      tour_360_url: tour360Url || null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      reservation_fee_amount: reservationFeeAmount,
      reservation_hold_hours: reservationHoldHours,
    })
    .eq("id", profile.establishment_id);
  if (error) return error.message;

  revalidatePath("/dashboard/admin/trouvetou");
  revalidatePath("/dashboard/admin");
  return null;
}

export async function createTrouvetouAd(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const targetUrl = String(formData.get("target_url") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const endsAt = String(formData.get("ends_at") ?? "").trim();
  if (!title) return "Titre de la publicité requis.";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || !profile.establishment_id) {
    return "Action réservée à l'administrateur.";
  }

  const { error } = await supabase.from("trouvetou_ads").insert({
    establishment_id: profile.establishment_id,
    title,
    description: description || null,
    image_url: imageUrl || null,
    target_url: targetUrl || null,
    starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    active: true,
  });
  if (error) return error.message;
  revalidatePath("/dashboard/admin/trouvetou");
  return null;
}

export async function confirmPayment(paymentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_fee_payment", {
    p_payment_id: paymentId,
  });
  if (error) return error.message;
  revalidatePath("/dashboard/admin/paiements");
  revalidatePath("/dashboard/secretariat");
  revalidatePath("/dashboard/parent/paiements");
  return null;
}

export async function finalizeReservation(reservationId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_reservation", {
    p_reservation_id: reservationId,
  });
  if (error) return error.message;
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/secretariat");
  return null;
}

export async function createFeeCategory(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const amount = num(formData.get("amount"));
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const schoolYear = String(formData.get("school_year") ?? "2026-2027").trim();

  if (!name) return "Nom de frais requis.";
  if (!Number.isFinite(amount) || amount < 0) return "Montant invalide.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    return "Action réservée à l'administrateur.";
  }

  const { error } = await supabase.from("fee_categories").insert({
    establishment_id: profile.establishment_id,
    name,
    amount,
    due_date: dueDate || null,
    description: description || null,
    school_year: schoolYear || "2026-2027",
  });
  if (error) return error.message;

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("establishment_id", profile.establishment_id);
  for (const student of students ?? []) {
    await supabase.rpc("assign_fees_to_student", { p_student_id: student.id });
  }

  revalidatePath("/dashboard/admin/paiements");
  return null;
}

export async function createSupplyList(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const title = String(formData.get("title") ?? "").trim();
  const levelId = String(formData.get("level_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "");

  if (!title || !levelId) return "Titre et niveau requis.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.establishment_id || !["admin", "secretariat"].includes(profile.role)) {
    return "Action non autorisée.";
  }

  const { data: list, error } = await supabase
    .from("supply_lists")
    .insert({
      establishment_id: profile.establishment_id,
      level_id: levelId,
      title,
      notes: notes || null,
      published: true,
    })
    .select("id")
    .single();
  if (error) return error.message;

  const items = itemsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, qty, cost] = line.split("|").map((p) => p.trim());
      return {
        list_id: list.id,
        name,
        quantity: qty || "1",
        estimated_cost: Number(cost || 0) || 0,
        sort_order: index,
      };
    });

  if (items.length > 0) {
    const { error: itemError } = await supabase.from("supply_items").insert(items);
    if (itemError) return itemError.message;
  }

  revalidatePath("/dashboard/admin/rentree");
  revalidatePath("/dashboard/parent/rentree");
  return null;
}

export async function toggleSupplyItem(studentId: string, itemId: string, purchased: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("student_supply_checks").upsert(
    {
      student_id: studentId,
      supply_item_id: itemId,
      purchased,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,supply_item_id" }
  );
  if (error) return error.message;
  revalidatePath("/dashboard/parent/rentree");
  return null;
}

export async function markDocumentStatus(
  documentId: string,
  status: DocumentStatus
): Promise<string | null> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "submitted") patch.submitted_at = new Date().toISOString();
  const { error } = await supabase.from("student_documents").update(patch).eq("id", documentId);
  if (error) return error.message;
  revalidatePath("/dashboard/parent/documents");
  revalidatePath("/dashboard/admin/documents");
  return null;
}

export async function sendMessage(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const recipientId = String(formData.get("recipient_id") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!recipientId) return "Destinataire requis.";
  if (!subject || !body) return "Sujet et message requis.";

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_school_message", {
    p_recipient_id: recipientId,
    p_student_id: studentId || null,
    p_subject: subject,
    p_body: body,
  });
  if (error) return error.message;

  revalidatePath("/dashboard/parent/messages");
  revalidatePath("/dashboard/admin/messages");
  return null;
}

export async function markMessageRead(messageId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("read_at", null);
  if (error) {
    console.error("markMessageRead:", error.message);
  }
  revalidatePath("/dashboard/parent/messages");
  revalidatePath("/dashboard/admin/messages");
}

export async function addBehaviorNote(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const studentId = String(formData.get("student_id") ?? "");
  const sectionId = String(formData.get("section_id") ?? "");
  const kind = String(formData.get("kind") ?? "a_surveiller");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!studentId || !sectionId || !title) return "Champs requis manquants.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { error } = await supabase.from("behavior_notes").insert({
    student_id: studentId,
    section_id: sectionId,
    recorded_by: user.id,
    kind,
    title,
    body: body || null,
  });
  if (error) return error.message;
  revalidatePath(`/dashboard/professeur/classe/${sectionId}`);
  revalidatePath("/dashboard/parent");
  return null;
}

export async function seedMissingStudentOps(studentId: string) {
  const supabase = await createClient();
  await supabase.rpc("assign_fees_to_student", { p_student_id: studentId });
  await supabase.rpc("seed_student_documents", { p_student_id: studentId });
}

/* ------------------------------------------------------------------ */
/* Paiements intelligents                                              */
/* ------------------------------------------------------------------ */

export async function generateYearlySchedule(schoolYear: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || !profile.establishment_id) {
    return "Action réservée à l'administrateur.";
  }

  const { error } = await supabase.rpc("generate_yearly_schedule", {
    p_establishment_id: profile.establishment_id,
    p_school_year: schoolYear,
  });
  if (error) return error.message;

  revalidatePath("/dashboard/admin/paiements");
  revalidatePath("/dashboard/parent/paiements");
  return null;
}

export async function markFeeReminder(
  studentFeeId: string,
  channel: "sms" | "whatsapp" | "email" | "in_app" = "in_app",
  note?: string
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile ||
    !["admin", "secretariat", "censeur"].includes(profile.role) ||
    !profile.establishment_id
  ) {
    return "Action non autorisée."
  }

  const { error } = await supabase.from("fee_reminders").insert({
    student_fee_id: studentFeeId,
    channel,
    sent_by: user.id,
    note: note ?? null,
  });
  if (error) return error.message;

  revalidatePath("/dashboard/admin/paiements");
  return null;
}

export async function reconcilePayment(
  paymentId: string,
  matchedReconciliationId: string | null,
  note?: string
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { data: payProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!payProfile || !["admin", "secretariat", "censeur"].includes(payProfile.role)) {
    return "Action non autorisée.";
  }

  const { error: payError } = await supabase
    .from("payments")
    .update({
      reconciled_at: new Date().toISOString(),
      reconciled_by: user.id,
      reconciliation_note: note ?? null,
    })
    .eq("id", paymentId);
  if (payError) return payError.message;

  if (matchedReconciliationId) {
    const { error: reconError } = await supabase
      .from("payment_reconciliations")
      .update({
        status: "matched",
        payment_id: paymentId,
        matched_at: new Date().toISOString(),
        matched_by: user.id,
      })
      .eq("id", matchedReconciliationId);
    if (reconError) return reconError.message;
  }

  revalidatePath("/dashboard/admin/paiements");
  return null;
}
