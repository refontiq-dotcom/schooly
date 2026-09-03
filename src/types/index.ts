export type UserRole = "admin" | "professeur" | "secretariat" | "censeur" | "parent";

export const STAFF_INVITE_ROLES = [
  "professeur",
  "secretariat",
  "censeur",
  "admin",
] as const;

export type StaffInviteRole = (typeof STAFF_INVITE_ROLES)[number];

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  establishment_id: string | null;
  created_at: string;
}

export interface StaffInvitation {
  id: string;
  establishment_id: string;
  email: string;
  role: StaffInviteRole;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export type ReservationStatus =
  | "pending_payment"
  | "reserved"
  | "confirmed"
  | "expired"
  | "cancelled"
  | "waitlisted"
  | "rejected_fraud";

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  pending_payment: "En attente de paiement",
  reserved: "Réservée",
  confirmed: "Inscription finalisée",
  expired: "Expirée",
  cancelled: "Annulée",
  waitlisted: "Liste d'attente",
  rejected_fraud: "Rejetée (fraude)",
};

export const RESERVATION_STATUS_COLOR: Record<ReservationStatus, string> = {
  pending_payment: "badge-warning",
  reserved: "badge-success",
  confirmed: "badge-success",
  expired: "badge-danger",
  cancelled: "badge-muted",
  waitlisted: "badge-info",
  rejected_fraud: "badge-danger",
};

export type SchoolType =
  | "primaire"
  | "college"
  | "lycee"
  | "professionnel"
  | "islamique";

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  primaire: "École primaire",
  college: "Collège",
  lycee: "Lycée",
  professionnel: "Professionnel & Technique",
  islamique: "Établissement islamique",
};

export const SCHOOL_TYPE_ICONS: Record<SchoolType, string> = {
  primaire: "🎒",
  college: "📚",
  lycee: "🎓",
  professionnel: "🔧",
  islamique: "🕌",
};

/** Niveaux prédéfinis par type d'établissement */
export const SCHOOL_LEVEL_PRESETS: Record<SchoolType, string[]> = {
  primaire: ["Maternelle", "CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  college: ["6ème", "5ème", "4ème", "3ème"],
  lycee: ["Seconde", "Première", "Terminale"],
  professionnel: ["1ère année", "2ème année", "3ème année"],
  islamique: ["Coran", "Arabe", "Fiqh", "Hadith", "Sira"],
};

export interface Establishment {
  id: string;
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  cover_image_url: string | null;
  tour_360_url: string | null;
  reservation_fee_amount: number;
  reservation_hold_hours: number;
  published_to_trouvetou: boolean;
  school_type: SchoolType | null;
}

export interface LevelAvailability {
  level_id: string;
  establishment_id: string;
  level_name: string;
  total_capacity: number;
  total_taken: number;
  seats_available: number;
}

export interface Section {
  id: string;
  level_id: string;
  name: string;
  capacity: number;
  seats_taken: number;
}

export interface Reservation {
  id: string;
  establishment_id: string;
  level_id: string;
  section_id: string | null;
  student_full_name: string;
  student_birthdate: string | null;
  parent_full_name: string;
  parent_phone: string;
  parent_email: string | null;
  status: ReservationStatus;
  amount_paid: number;
  qr_code_token: string;
  expires_at: string | null;
  created_at: string;
  parent_trust_score: number | null;
  fraud_flags: string[];
  waitlist_position: number | null;
  promoted_at: string | null;
  cancelled_at: string | null;
}

export interface Student {
  id: string;
  full_name: string;
  section_id: string;
  parent_phone: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  section_id: string;
  session_date: string;
  present: boolean;
  note: string | null;
}

export interface Grade {
  id: string;
  student_id: string;
  section_id: string;
  subject: string;
  evaluation_type: string;
  score: number;
  max_score: number;
  evaluation_date: string;
}

export type FeeStatus = "pending" | "partial" | "paid" | "overdue";
export type PaymentMethod =
  | "orange_money"
  | "mtn_momo"
  | "moov"
  | "wave"
  | "cash"
  | "bank";
export type PaymentStatus = "pending" | "confirmed" | "failed";
export type DocumentType =
  | "acte_naissance"
  | "photo_identite"
  | "carnet_vaccination"
  | "bulletin_precedent"
  | "certificat_scolarite"
  | "piece_identite"
  | "dossier_examen"
  | "autre";
export type DocumentStatus = "missing" | "submitted" | "validated" | "rejected";
export type BehaviorKind = "positif" | "a_surveiller" | "incident";

export interface FeeCategory {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  school_year: string;
  is_optional: boolean;
}

export interface StudentFee {
  id: string;
  student_id: string;
  fee_category_id: string;
  establishment_id: string;
  amount: number;
  amount_paid: number;
  due_date: string | null;
  status: FeeStatus;
}

export interface Payment {
  id: string;
  student_id: string;
  student_fee_id: string | null;
  establishment_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}

export interface SupplyList {
  id: string;
  establishment_id: string;
  level_id: string;
  school_year: string;
  title: string;
  notes: string | null;
  published: boolean;
}

export interface SupplyItem {
  id: string;
  list_id: string;
  name: string;
  quantity: string;
  estimated_cost: number;
  is_optional: boolean;
  sort_order: number;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  establishment_id: string;
  doc_type: DocumentType;
  status: DocumentStatus;
  required: boolean;
  alert_from_level: string | null;
  notes: string | null;
  submitted_at: string | null;
}

export interface SchoolMessage {
  id: string;
  establishment_id: string;
  sender_id: string;
  recipient_id: string | null;
  student_id: string | null;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface BehaviorNote {
  id: string;
  student_id: string;
  section_id: string;
  recorded_by: string;
  kind: BehaviorKind;
  title: string;
  body: string | null;
  session_date: string;
}

// ── Module Internat ──────────────────────────────────────────────

export type InternatGender = "garcon" | "fille" | "mixte";
export type InternatRoomStatus = "disponible" | "maintenance" | "complet";
export type InternatBedStatus = "libre" | "occupe" | "maintenance";
export type InternatAssignmentStatus = "actif" | "suspendu" | "termine";
export type InternatRollCallType = "matin" | "soir";
export type InternatMealType = "petit_dejeuner" | "dejeuner" | "diner";
export type InternatIncidentSeverity = "mineur" | "majeur" | "grave";
export type InternatIncidentCategory = "discipline" | "sante" | "comportement" | "autre";

export const INTERNAT_GENDER_LABELS: Record<InternatGender, string> = {
  garcon: "Garçons",
  fille: "Filles",
  mixte: "Mixte",
};

export const INTERNAT_GENDER_ICONS: Record<InternatGender, string> = {
  garcon: "👦",
  fille: "👧",
  mixte: "🏠",
};

export const INTERNAT_ROLL_CALL_LABELS: Record<InternatRollCallType, string> = {
  matin: "Appel du matin",
  soir: "Appel du soir",
};

export const INTERNAT_MEAL_LABELS: Record<InternatMealType, string> = {
  petit_dejeuner: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
};

export const INTERNAT_MEAL_ICONS: Record<InternatMealType, string> = {
  petit_dejeuner: "🥐",
  dejeuner: "🍽️",
  diner: "🌙",
};

export const INTERNAT_SEVERITY_LABELS: Record<InternatIncidentSeverity, string> = {
  mineur: "Mineur",
  majeur: "Majeur",
  grave: "Grave",
};

export const INTERNAT_SEVERITY_COLORS: Record<InternatIncidentSeverity, string> = {
  mineur: "bg-amber-100 text-amber-700",
  majeur: "bg-orange-100 text-orange-700",
  grave: "bg-red-100 text-red-700",
};

export const INTERNAT_CATEGORY_LABELS: Record<InternatIncidentCategory, string> = {
  discipline: "Discipline",
  sante: "Santé",
  comportement: "Comportement",
  autre: "Autre",
};

export interface InternatBlock {
  id: string;
  establishment_id: string;
  name: string;
  gender: InternatGender;
  capacity: number;
  created_at: string;
}

export interface InternatRoom {
  id: string;
  block_id: string;
  number: string;
  bed_count: number;
  status: InternatRoomStatus;
  created_at: string;
}

export interface InternatBed {
  id: string;
  room_id: string;
  bed_number: number;
  status: InternatBedStatus;
  created_at: string;
}

export interface InternatAssignment {
  id: string;
  student_id: string;
  bed_id: string;
  academic_year: string;
  start_date: string;
  end_date: string | null;
  status: InternatAssignmentStatus;
  assigned_by: string | null;
  created_at: string;
}

export interface InternatRollCall {
  id: string;
  block_id: string;
  roll_call_date: string;
  roll_call_type: InternatRollCallType;
  recorded_by: string | null;
  created_at: string;
}

export interface InternatRollItem {
  id: string;
  roll_call_id: string;
  student_id: string;
  present: boolean;
  note: string | null;
  late_minutes: number;
  created_at: string;
}

export interface InternatMeal {
  id: string;
  establishment_id: string;
  meal_date: string;
  meal_type: InternatMealType;
  meal_name: string;
  created_by: string | null;
  created_at: string;
}

export interface InternatMealAttendance {
  id: string;
  meal_id: string;
  student_id: string;
  present: boolean;
  created_at: string;
}

export interface InternatIncident {
  id: string;
  establishment_id: string;
  student_id: string;
  incident_date: string;
  severity: InternatIncidentSeverity;
  category: InternatIncidentCategory;
  title: string;
  description: string | null;
  reported_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface InternatVisit {
  id: string;
  student_id: string;
  visitor_name: string;
  visitor_phone: string | null;
  relationship: string | null;
  visit_date: string;
  arrive_at: string | null;
  leave_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface InternatHealth {
  id: string;
  student_id: string;
  check_date: string;
  temperature: number | null;
  weight: number | null;
  symptoms: string | null;
  medication: string | null;
  notes: string | null;
  recorded_by: string | null;
  parent_notified: boolean;
  created_at: string;
}

export interface InternatBlockCapacity {
  block_id: string;
  establishment_id: string;
  block_name: string;
  gender: InternatGender;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
  capacity: number;
}
