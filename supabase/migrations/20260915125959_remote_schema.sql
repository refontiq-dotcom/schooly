drop extension if exists "pg_net";

create type "public"."academic_year_status" as enum ('planifiee', 'en_cours', 'cloturee');

create type "public"."school_type" as enum ('primaire', 'college', 'lycee', 'professionnel', 'islamique', 'superieur');


  create table "public"."academic_decisions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "academic_year_id" uuid not null,
    "decision" text not null,
    "average" numeric,
    "observations" text,
    "decided_by" uuid,
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."academic_decisions" enable row level security;


  create table "public"."academic_years" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "label" text not null,
    "start_date" date not null,
    "end_date" date not null,
    "status" public.academic_year_status not null default 'planifiee'::public.academic_year_status,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."academic_years" enable row level security;


  create table "public"."accounting_exports" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "academic_year_id" uuid not null,
    "export_type" text not null,
    "period_start" date not null,
    "period_end" date not null,
    "file_url" text,
    "generated_by" uuid,
    "generated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."accounting_exports" enable row level security;


  create table "public"."attendance_records" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "course_session_id" uuid not null,
    "enrollment_id" uuid not null,
    "status" text not null,
    "remark" text,
    "recorded_at" timestamp with time zone not null default now(),
    "recorded_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."attendance_records" enable row level security;


  create table "public"."billing_configs" (
    "id" uuid not null default gen_random_uuid(),
    "product_id" text not null,
    "name" text not null,
    "mode" text not null,
    "currency" text not null default 'XOF'::text,
    "tiers" jsonb default '[]'::jsonb,
    "event_amount" bigint default 1000,
    "event_types" jsonb default '[]'::jsonb,
    "wave_merchant_id" text,
    "wave_webhook_secret" text,
    "telegram_bot_token" text,
    "telegram_chat_id" text,
    "telegram_admin_url" text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."billing_configs" enable row level security;


  create table "public"."boarding_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "academic_year_id" uuid not null,
    "enrollment_id" uuid not null,
    "room_id" uuid,
    "amount_cfa" bigint not null default 0,
    "start_date" date not null,
    "end_date" date,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."boarding_subscriptions" enable row level security;


  create table "public"."bus_routes" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "name" text not null,
    "driver_name" text,
    "driver_phone" text,
    "vehicle_plate" text,
    "capacity" integer,
    "monthly_fee_cfa" bigint not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."bus_routes" enable row level security;


  create table "public"."bus_stops" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "route_id" uuid not null,
    "name" text not null,
    "pickup_time" time without time zone,
    "dropoff_time" time without time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."bus_stops" enable row level security;


  create table "public"."canteen_attendance" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "subscription_id" uuid not null,
    "date" date not null default CURRENT_DATE,
    "meal_type" text not null default 'lunch'::text,
    "scanned_at" timestamp with time zone not null default now(),
    "scanned_by" uuid,
    "status" text not null default 'present'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."canteen_attendance" enable row level security;


  create table "public"."canteen_menus" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "date" date not null,
    "meal_type" text not null default 'lunch'::text,
    "description" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."canteen_menus" enable row level security;


  create table "public"."canteen_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "academic_year_id" uuid not null,
    "enrollment_id" uuid not null,
    "plan_type" text not null,
    "amount_cfa" bigint not null default 0,
    "start_date" date not null,
    "end_date" date,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."canteen_subscriptions" enable row level security;


  create table "public"."cash_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "opened_by" uuid not null,
    "closed_by" uuid,
    "opening_amount" bigint not null default 0,
    "closing_amount" bigint,
    "expected_amount" bigint,
    "difference" bigint,
    "status" text not null default 'open'::text,
    "opened_at" timestamp with time zone not null default now(),
    "closed_at" timestamp with time zone,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."cash_sessions" enable row level security;


  create table "public"."class_subject_assignments" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "class_id" uuid not null,
    "subject_id" uuid not null,
    "teacher_id" uuid,
    "coefficient" numeric not null default 1,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."class_subject_assignments" enable row level security;


  create table "public"."classes" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "grade_level_id" uuid not null,
    "name" text not null,
    "capacity" integer,
    "head_teacher_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."classes" enable row level security;


  create table "public"."course_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "class_id" uuid not null,
    "subject_id" uuid not null,
    "teacher_id" uuid not null,
    "academic_year_id" uuid not null,
    "starts_at" timestamp with time zone not null,
    "ends_at" timestamp with time zone not null,
    "room" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."course_sessions" enable row level security;


  create table "public"."detentions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "reason" text not null,
    "scheduled_date" date not null,
    "scheduled_time" time without time zone not null,
    "duration_minutes" integer not null default 60,
    "assigned_by" uuid,
    "served" boolean not null default false,
    "served_at" timestamp with time zone,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."detentions" enable row level security;


  create table "public"."door_entries" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "qr_code_id" uuid not null,
    "event_type" text not null,
    "scanned_at" timestamp with time zone not null default now(),
    "scanned_by" uuid,
    "location" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."door_entries" enable row level security;


  create table "public"."dorm_rooms" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "dormitory_id" uuid not null,
    "room_number" text not null,
    "capacity" integer not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dorm_rooms" enable row level security;


  create table "public"."dormitories" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "name" text not null,
    "gender_restriction" text not null,
    "capacity" integer not null,
    "supervisor_name" text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."dormitories" enable row level security;


  create table "public"."dropout_alerts" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "course_session_id" uuid,
    "door_entry_id" uuid,
    "alert_type" text not null,
    "status" text not null default 'pending'::text,
    "detected_at" timestamp with time zone not null default now(),
    "investigated_by" uuid,
    "investigated_at" timestamp with time zone,
    "resolution_notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."dropout_alerts" enable row level security;


  create table "public"."enrollment_checklist_items" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "nom" text not null,
    "montant_cash" bigint,
    "obligatoire" boolean not null default true,
    "ordre_affichage" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."enrollment_checklist_items" enable row level security;


  create table "public"."enrollment_decisions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "academic_year_id" uuid not null,
    "decision" text not null default 'pending'::text,
    "decided_by" uuid,
    "decided_at" timestamp with time zone,
    "comment" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."enrollment_decisions" enable row level security;


  create table "public"."enrollments" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "student_id" uuid not null,
    "guardian_id" uuid not null,
    "grade_level_id" uuid not null,
    "class_id" uuid,
    "academic_year_id" uuid not null,
    "financial_profile_id" uuid,
    "enrollment_date" date not null default now(),
    "status" text not null default 'active'::text,
    "matricule" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."enrollments" enable row level security;


  create table "public"."family_reliability_scores" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "guardian_id" uuid not null,
    "score" integer not null default 100,
    "total_moratoriums" integer not null default 0,
    "approved_moratoriums" integer not null default 0,
    "rejected_moratoriums" integer not null default 0,
    "late_payments" integer not null default 0,
    "on_time_payments" integer not null default 0,
    "last_updated" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."family_reliability_scores" enable row level security;


  create table "public"."fee_schedules" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "grade_level_id" uuid,
    "financial_profile_id" uuid,
    "amount" bigint not null,
    "academic_year_id" uuid not null,
    "label" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."fee_schedules" enable row level security;


  create table "public"."financial_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "name" text not null,
    "description" text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."financial_profiles" enable row level security;


  create table "public"."grade_entries" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "subject_id" uuid not null,
    "academic_year_id" uuid not null,
    "grade_type" text not null,
    "label" text not null,
    "value" numeric not null,
    "max_value" numeric not null default 20,
    "weight" numeric not null default 1,
    "comment" text,
    "session_id" uuid,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."grade_entries" enable row level security;


  create table "public"."grade_levels" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "name" text not null,
    "level" integer not null,
    "cycle" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."grade_levels" enable row level security;


  create table "public"."guardians" (
    "id" uuid not null default gen_random_uuid(),
    "phone" text not null,
    "full_name" text not null,
    "email" text,
    "address" text,
    "occupation" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."guardians" enable row level security;


  create table "public"."homeworks" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "class_id" uuid not null,
    "subject_id" uuid not null,
    "teacher_id" uuid not null,
    "title" text not null,
    "description" text,
    "due_date" date not null,
    "supports" jsonb not null default '[]'::jsonb,
    "is_published" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."homeworks" enable row level security;


  create table "public"."moratoriums" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "guardian_id" uuid not null,
    "reason" text not null,
    "requested_amount" bigint not null,
    "approved_amount" bigint,
    "status" text not null default 'pending'::text,
    "requested_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "due_date" date not null,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."moratoriums" enable row level security;


  create table "public"."notification_outbox" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "recipient_phone" text not null,
    "channel" text not null,
    "template_key" text not null,
    "payload" jsonb not null default '{}'::jsonb,
    "status" text not null default 'pending'::text,
    "attempts" integer not null default 0,
    "max_attempts" integer not null default 3,
    "scheduled_at" timestamp with time zone not null default now(),
    "sent_at" timestamp with time zone,
    "error_message" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."notification_outbox" enable row level security;


  create table "public"."payment_reminders" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "reminder_type" text not null,
    "channel" text not null,
    "sent_at" timestamp with time zone not null default now(),
    "sent_by" uuid,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."payment_reminders" enable row level security;


  create table "public"."payments" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "amount" bigint not null,
    "payment_method" text not null,
    "reference" text,
    "cash_session_id" uuid,
    "received_by" uuid,
    "received_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."payments" enable row level security;


  create table "public"."platform_fee_ledger" (
    "id" uuid not null default gen_random_uuid(),
    "event_id" uuid not null,
    "tenant_id" uuid not null,
    "amount" bigint not null default 1000,
    "status" text not null default 'due'::text,
    "academic_year_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "product_id" text not null default 'schooly'::text,
    "event_type" text default 'enrollment_confirmed'::text,
    "period_label" text,
    "period_start" date,
    "period_end" date
      );


alter table "public"."platform_fee_ledger" enable row level security;


  create table "public"."platform_invoices" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid not null,
    "academic_year_id" uuid,
    "period_label" text not null,
    "period_start" date not null,
    "period_end" date not null,
    "total_students" integer not null default 0,
    "total_due" bigint not null default 0,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "product_id" text not null default 'schooly'::text,
    "total_events" integer default 0,
    "paid_at" timestamp with time zone,
    "paid_amount" bigint
      );


alter table "public"."platform_invoices" enable row level security;


  create table "public"."pre_enrollments" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "first_name" text not null,
    "last_name" text not null,
    "date_of_birth" date not null,
    "grade_level_id" uuid,
    "guardian_phone" text not null,
    "code" text not null,
    "status" text not null default 'pending'::text,
    "expires_at" timestamp with time zone not null,
    "validated_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."pre_enrollments" enable row level security;


  create table "public"."receipts" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "payment_id" uuid not null,
    "receipt_number" text not null,
    "verification_code" text not null,
    "qr_code_data" text not null,
    "issued_at" timestamp with time zone not null default now(),
    "issued_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."receipts" enable row level security;


  create table "public"."report_cards" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "academic_year_id" uuid not null,
    "status" text not null default 'draft'::text,
    "pdf_url" text,
    "generated_by" uuid,
    "generated_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."report_cards" enable row level security;


  create table "public"."required_documents" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "nom" text not null,
    "obligatoire" boolean not null default true,
    "applicable_to_level_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."required_documents" enable row level security;


  create table "public"."roles" (
    "code" text not null,
    "label" text not null
      );


alter table "public"."roles" enable row level security;


  create table "public"."school_features" (
    "school_id" uuid not null,
    "feature" text not null,
    "enabled" boolean not null default false
      );


alter table "public"."school_features" enable row level security;


  create table "public"."school_payment_methods" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "type" text not null,
    "actif" boolean not null default true,
    "mobile_money_type" text,
    "mobile_money_prefix" text,
    "iban" text,
    "cheque_details" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."school_payment_methods" enable row level security;


  create table "public"."schools" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "city" text,
    "school_type" public.school_type,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone,
    "published_to_trouvetou" boolean not null default false,
    "description_publique" text,
    "latitude" double precision,
    "longitude" double precision,
    "itineraire" text,
    "photos_360" jsonb default '[]'::jsonb,
    "video_url" text,
    "grille_tarifaire_publique" jsonb default '[]'::jsonb,
    "is_setup_complete" boolean not null default false
      );


alter table "public"."schools" enable row level security;


  create table "public"."student_qr_codes" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "enrollment_id" uuid not null,
    "qr_code" text not null,
    "is_active" boolean not null default true,
    "generated_at" timestamp with time zone not null default now(),
    "deactivated_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."student_qr_codes" enable row level security;


  create table "public"."students" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "first_name" text not null,
    "last_name" text not null,
    "date_of_birth" date not null,
    "birth_certificate_number" text,
    "gender" text,
    "address" text,
    "photo_url" text,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."students" enable row level security;


  create table "public"."subjects" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "name" text not null,
    "code" text,
    "coefficient" numeric not null default 1,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."subjects" enable row level security;


  create table "public"."subscription_payment_requests" (
    "id" uuid not null default gen_random_uuid(),
    "product_id" text not null,
    "tenant_id" uuid not null,
    "subscription_id" uuid,
    "tier_id" text,
    "amount" bigint not null,
    "status" text not null default 'pending'::text,
    "requested_by" uuid,
    "validated_by" uuid,
    "validated_at" timestamp with time zone,
    "sender_phone" text,
    "payment_provider" text default 'wave'::text,
    "reference" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."subscription_payment_requests" enable row level security;


  create table "public"."transport_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "academic_year_id" uuid not null,
    "enrollment_id" uuid not null,
    "route_id" uuid not null,
    "stop_id" uuid,
    "start_date" date not null,
    "end_date" date,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."transport_subscriptions" enable row level security;


  create table "public"."trouvetou_ads" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "title" text not null,
    "message" text not null,
    "image_url" text,
    "target_url" text,
    "start_date" date not null,
    "end_date" date not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."trouvetou_ads" enable row level security;


  create table "public"."trouvetou_reservations" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "grade_level_id" uuid not null,
    "student_full_name" text not null,
    "student_birthdate" date,
    "parent_full_name" text not null,
    "parent_phone" text not null,
    "parent_email" text,
    "status" text not null default 'pending_payment'::text,
    "payment_reference" text,
    "amount_paid" bigint,
    "qr_code_token" text,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."trouvetou_reservations" enable row level security;


  create table "public"."user_school_roles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "school_id" uuid not null,
    "role_code" text not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."user_school_roles" enable row level security;


  create table "public"."users" (
    "id" uuid not null,
    "full_name" text not null,
    "email" text,
    "phone" text,
    "pin_hash" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."users" enable row level security;


  create table "public"."year_rollover_logs" (
    "id" uuid not null default gen_random_uuid(),
    "school_id" uuid not null,
    "old_year_id" uuid not null,
    "new_year_id" uuid not null,
    "initiated_by" uuid not null,
    "initiated_at" timestamp with time zone not null default now(),
    "students_promoted" integer not null default 0,
    "students_repeated" integer not null default 0,
    "students_excluded" integer not null default 0,
    "students_pending" integer not null default 0,
    "status" text not null default 'pending'::text,
    "error_message" text,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."year_rollover_logs" enable row level security;

CREATE UNIQUE INDEX academic_decisions_pkey ON public.academic_decisions USING btree (id);

CREATE UNIQUE INDEX academic_decisions_school_id_enrollment_id_academic_year_id_key ON public.academic_decisions USING btree (school_id, enrollment_id, academic_year_id);

CREATE UNIQUE INDEX academic_years_pkey ON public.academic_years USING btree (id);

CREATE UNIQUE INDEX academic_years_school_id_label_key ON public.academic_years USING btree (school_id, label);

CREATE UNIQUE INDEX accounting_exports_pkey ON public.accounting_exports USING btree (id);

CREATE UNIQUE INDEX attendance_records_course_session_id_enrollment_id_key ON public.attendance_records USING btree (course_session_id, enrollment_id);

CREATE UNIQUE INDEX attendance_records_pkey ON public.attendance_records USING btree (id);

CREATE UNIQUE INDEX billing_configs_pkey ON public.billing_configs USING btree (id);

CREATE UNIQUE INDEX billing_configs_product_id_key ON public.billing_configs USING btree (product_id);

CREATE UNIQUE INDEX boarding_subscriptions_pkey ON public.boarding_subscriptions USING btree (id);

CREATE UNIQUE INDEX boarding_subscriptions_school_id_academic_year_id_enrollmen_key ON public.boarding_subscriptions USING btree (school_id, academic_year_id, enrollment_id);

CREATE UNIQUE INDEX bus_routes_pkey ON public.bus_routes USING btree (id);

CREATE UNIQUE INDEX bus_stops_pkey ON public.bus_stops USING btree (id);

CREATE UNIQUE INDEX canteen_attendance_pkey ON public.canteen_attendance USING btree (id);

CREATE UNIQUE INDEX canteen_attendance_subscription_id_date_meal_type_key ON public.canteen_attendance USING btree (subscription_id, date, meal_type);

CREATE UNIQUE INDEX canteen_menus_pkey ON public.canteen_menus USING btree (id);

CREATE UNIQUE INDEX canteen_menus_school_id_date_meal_type_key ON public.canteen_menus USING btree (school_id, date, meal_type);

CREATE UNIQUE INDEX canteen_subscriptions_pkey ON public.canteen_subscriptions USING btree (id);

CREATE UNIQUE INDEX canteen_subscriptions_school_id_academic_year_id_enrollment_key ON public.canteen_subscriptions USING btree (school_id, academic_year_id, enrollment_id);

CREATE UNIQUE INDEX cash_sessions_pkey ON public.cash_sessions USING btree (id);

CREATE UNIQUE INDEX class_subject_assignments_pkey ON public.class_subject_assignments USING btree (id);

CREATE UNIQUE INDEX class_subject_assignments_school_id_class_id_subject_id_key ON public.class_subject_assignments USING btree (school_id, class_id, subject_id);

CREATE UNIQUE INDEX classes_pkey ON public.classes USING btree (id);

CREATE UNIQUE INDEX classes_school_id_name_key ON public.classes USING btree (school_id, name);

CREATE UNIQUE INDEX course_sessions_pkey ON public.course_sessions USING btree (id);

CREATE UNIQUE INDEX course_sessions_school_id_class_id_subject_id_teacher_id_st_key ON public.course_sessions USING btree (school_id, class_id, subject_id, teacher_id, starts_at);

CREATE UNIQUE INDEX detentions_pkey ON public.detentions USING btree (id);

CREATE UNIQUE INDEX detentions_school_id_enrollment_id_scheduled_date_scheduled_key ON public.detentions USING btree (school_id, enrollment_id, scheduled_date, scheduled_time);

CREATE UNIQUE INDEX door_entries_pkey ON public.door_entries USING btree (id);

CREATE UNIQUE INDEX dorm_rooms_dormitory_id_room_number_key ON public.dorm_rooms USING btree (dormitory_id, room_number);

CREATE UNIQUE INDEX dorm_rooms_pkey ON public.dorm_rooms USING btree (id);

CREATE UNIQUE INDEX dormitories_pkey ON public.dormitories USING btree (id);

CREATE UNIQUE INDEX dropout_alerts_pkey ON public.dropout_alerts USING btree (id);

CREATE UNIQUE INDEX enrollment_checklist_items_pkey ON public.enrollment_checklist_items USING btree (id);

CREATE UNIQUE INDEX enrollment_checklist_items_school_id_ordre_affichage_key ON public.enrollment_checklist_items USING btree (school_id, ordre_affichage);

CREATE UNIQUE INDEX enrollment_decisions_enrollment_id_academic_year_id_key ON public.enrollment_decisions USING btree (enrollment_id, academic_year_id);

CREATE UNIQUE INDEX enrollment_decisions_pkey ON public.enrollment_decisions USING btree (id);

CREATE UNIQUE INDEX enrollments_matricule_key ON public.enrollments USING btree (matricule);

CREATE UNIQUE INDEX enrollments_pkey ON public.enrollments USING btree (id);

CREATE UNIQUE INDEX enrollments_school_id_matricule_key ON public.enrollments USING btree (school_id, matricule);

CREATE UNIQUE INDEX family_reliability_scores_pkey ON public.family_reliability_scores USING btree (id);

CREATE UNIQUE INDEX family_reliability_scores_school_id_guardian_id_key ON public.family_reliability_scores USING btree (school_id, guardian_id);

CREATE UNIQUE INDEX fee_schedules_pkey ON public.fee_schedules USING btree (id);

CREATE UNIQUE INDEX fee_schedules_school_id_grade_level_id_financial_profile_id_key ON public.fee_schedules USING btree (school_id, grade_level_id, financial_profile_id, academic_year_id);

CREATE UNIQUE INDEX financial_profiles_pkey ON public.financial_profiles USING btree (id);

CREATE UNIQUE INDEX financial_profiles_school_id_name_key ON public.financial_profiles USING btree (school_id, name);

CREATE UNIQUE INDEX grade_entries_pkey ON public.grade_entries USING btree (id);

CREATE UNIQUE INDEX grade_entries_school_id_enrollment_id_subject_id_academic_y_key ON public.grade_entries USING btree (school_id, enrollment_id, subject_id, academic_year_id, grade_type, label);

CREATE UNIQUE INDEX grade_levels_pkey ON public.grade_levels USING btree (id);

CREATE UNIQUE INDEX grade_levels_school_id_name_key ON public.grade_levels USING btree (school_id, name);

CREATE UNIQUE INDEX guardians_phone_key ON public.guardians USING btree (phone);

CREATE UNIQUE INDEX guardians_pkey ON public.guardians USING btree (id);

CREATE UNIQUE INDEX homeworks_pkey ON public.homeworks USING btree (id);

CREATE INDEX idx_academic_decisions_enrollment ON public.academic_decisions USING btree (enrollment_id);

CREATE INDEX idx_academic_decisions_school ON public.academic_decisions USING btree (school_id);

CREATE INDEX idx_academic_decisions_year ON public.academic_decisions USING btree (academic_year_id);

CREATE INDEX idx_academic_years_school ON public.academic_years USING btree (school_id);

CREATE INDEX idx_accounting_exports_school ON public.accounting_exports USING btree (school_id);

CREATE INDEX idx_accounting_exports_year ON public.accounting_exports USING btree (academic_year_id);

CREATE INDEX idx_attendance_enrollment ON public.attendance_records USING btree (enrollment_id);

CREATE INDEX idx_attendance_school ON public.attendance_records USING btree (school_id);

CREATE INDEX idx_attendance_session ON public.attendance_records USING btree (course_session_id);

CREATE INDEX idx_billing_configs_product ON public.billing_configs USING btree (product_id);

CREATE INDEX idx_boarding_subs_enrollment ON public.boarding_subscriptions USING btree (enrollment_id);

CREATE INDEX idx_bus_routes_school ON public.bus_routes USING btree (school_id);

CREATE INDEX idx_bus_stops_route ON public.bus_stops USING btree (route_id);

CREATE INDEX idx_canteen_att_sub ON public.canteen_attendance USING btree (subscription_id);

CREATE INDEX idx_canteen_menus_school ON public.canteen_menus USING btree (school_id);

CREATE INDEX idx_canteen_subs_enrollment ON public.canteen_subscriptions USING btree (enrollment_id);

CREATE INDEX idx_cash_sessions_school ON public.cash_sessions USING btree (school_id);

CREATE INDEX idx_cash_sessions_status ON public.cash_sessions USING btree (status);

CREATE INDEX idx_classes_grade ON public.classes USING btree (grade_level_id);

CREATE INDEX idx_classes_school ON public.classes USING btree (school_id);

CREATE INDEX idx_course_sessions_class ON public.course_sessions USING btree (class_id);

CREATE INDEX idx_course_sessions_school ON public.course_sessions USING btree (school_id);

CREATE INDEX idx_course_sessions_starts_at ON public.course_sessions USING btree (starts_at);

CREATE INDEX idx_course_sessions_teacher ON public.course_sessions USING btree (teacher_id);

CREATE INDEX idx_course_sessions_year ON public.course_sessions USING btree (academic_year_id);

CREATE INDEX idx_csa_class ON public.class_subject_assignments USING btree (class_id);

CREATE INDEX idx_csa_school ON public.class_subject_assignments USING btree (school_id);

CREATE INDEX idx_csa_subject ON public.class_subject_assignments USING btree (subject_id);

CREATE INDEX idx_detentions_enrollment ON public.detentions USING btree (enrollment_id);

CREATE INDEX idx_detentions_scheduled ON public.detentions USING btree (scheduled_date);

CREATE INDEX idx_detentions_school ON public.detentions USING btree (school_id);

CREATE INDEX idx_detentions_served ON public.detentions USING btree (served);

CREATE INDEX idx_door_entries_enrollment ON public.door_entries USING btree (enrollment_id);

CREATE INDEX idx_door_entries_event_type ON public.door_entries USING btree (event_type);

CREATE INDEX idx_door_entries_scanned_at ON public.door_entries USING btree (scanned_at);

CREATE INDEX idx_door_entries_school ON public.door_entries USING btree (school_id);

CREATE INDEX idx_dorm_rooms_dorm ON public.dorm_rooms USING btree (dormitory_id);

CREATE INDEX idx_dormitories_school ON public.dormitories USING btree (school_id);

CREATE INDEX idx_dropout_alerts_detected_at ON public.dropout_alerts USING btree (detected_at);

CREATE INDEX idx_dropout_alerts_enrollment ON public.dropout_alerts USING btree (enrollment_id);

CREATE INDEX idx_dropout_alerts_school ON public.dropout_alerts USING btree (school_id);

CREATE INDEX idx_dropout_alerts_status ON public.dropout_alerts USING btree (status);

CREATE INDEX idx_enrollment_checklist_items_ordre ON public.enrollment_checklist_items USING btree (school_id, ordre_affichage);

CREATE INDEX idx_enrollment_checklist_items_school ON public.enrollment_checklist_items USING btree (school_id);

CREATE INDEX idx_enrollment_decisions_enrollment ON public.enrollment_decisions USING btree (enrollment_id);

CREATE INDEX idx_enrollment_decisions_school ON public.enrollment_decisions USING btree (school_id);

CREATE INDEX idx_enrollment_decisions_year ON public.enrollment_decisions USING btree (academic_year_id);

CREATE INDEX idx_enrollments_class ON public.enrollments USING btree (class_id);

CREATE INDEX idx_enrollments_guardian ON public.enrollments USING btree (guardian_id);

CREATE INDEX idx_enrollments_school ON public.enrollments USING btree (school_id);

CREATE INDEX idx_enrollments_student ON public.enrollments USING btree (student_id);

CREATE INDEX idx_enrollments_year ON public.enrollments USING btree (academic_year_id);

CREATE INDEX idx_family_reliability_scores_guardian ON public.family_reliability_scores USING btree (guardian_id);

CREATE INDEX idx_family_reliability_scores_school ON public.family_reliability_scores USING btree (school_id);

CREATE INDEX idx_fee_schedules_school ON public.fee_schedules USING btree (school_id);

CREATE INDEX idx_fee_schedules_year ON public.fee_schedules USING btree (academic_year_id);

CREATE INDEX idx_financial_profiles_school ON public.financial_profiles USING btree (school_id);

CREATE INDEX idx_grade_entries_created_by ON public.grade_entries USING btree (created_by);

CREATE INDEX idx_grade_entries_enrollment ON public.grade_entries USING btree (enrollment_id);

CREATE INDEX idx_grade_entries_school ON public.grade_entries USING btree (school_id);

CREATE INDEX idx_grade_entries_subject ON public.grade_entries USING btree (subject_id);

CREATE INDEX idx_grade_entries_year ON public.grade_entries USING btree (academic_year_id);

CREATE INDEX idx_grade_levels_school ON public.grade_levels USING btree (school_id);

CREATE INDEX idx_guardians_phone ON public.guardians USING btree (phone);

CREATE INDEX idx_homeworks_class ON public.homeworks USING btree (class_id);

CREATE INDEX idx_homeworks_due ON public.homeworks USING btree (due_date);

CREATE INDEX idx_homeworks_school ON public.homeworks USING btree (school_id);

CREATE INDEX idx_homeworks_teacher ON public.homeworks USING btree (teacher_id);

CREATE INDEX idx_moratoriums_enrollment ON public.moratoriums USING btree (enrollment_id);

CREATE INDEX idx_moratoriums_guardian ON public.moratoriums USING btree (guardian_id);

CREATE INDEX idx_moratoriums_school ON public.moratoriums USING btree (school_id);

CREATE INDEX idx_moratoriums_status ON public.moratoriums USING btree (status);

CREATE INDEX idx_notification_outbox_scheduled ON public.notification_outbox USING btree (scheduled_at);

CREATE INDEX idx_notification_outbox_school ON public.notification_outbox USING btree (school_id);

CREATE INDEX idx_notification_outbox_status ON public.notification_outbox USING btree (status);

CREATE INDEX idx_payment_reminders_enrollment ON public.payment_reminders USING btree (enrollment_id);

CREATE INDEX idx_payment_reminders_school ON public.payment_reminders USING btree (school_id);

CREATE INDEX idx_payment_reminders_type ON public.payment_reminders USING btree (reminder_type);

CREATE INDEX idx_payments_enrollment ON public.payments USING btree (enrollment_id);

CREATE INDEX idx_payments_school ON public.payments USING btree (school_id);

CREATE INDEX idx_payments_session ON public.payments USING btree (cash_session_id);

CREATE INDEX idx_pfl_event ON public.platform_fee_ledger USING btree (event_id);

CREATE INDEX idx_pfl_product ON public.platform_fee_ledger USING btree (product_id);

CREATE INDEX idx_pi_product ON public.platform_invoices USING btree (product_id);

CREATE INDEX idx_pi_tenant ON public.platform_invoices USING btree (tenant_id);

CREATE INDEX idx_platform_fee_ledger_school ON public.platform_fee_ledger USING btree (tenant_id);

CREATE INDEX idx_platform_fee_ledger_status ON public.platform_fee_ledger USING btree (status);

CREATE INDEX idx_platform_fee_ledger_year ON public.platform_fee_ledger USING btree (academic_year_id);

CREATE INDEX idx_platform_invoices_school ON public.platform_invoices USING btree (tenant_id);

CREATE INDEX idx_platform_invoices_status ON public.platform_invoices USING btree (status);

CREATE INDEX idx_pre_enrollments_code ON public.pre_enrollments USING btree (code);

CREATE INDEX idx_pre_enrollments_school ON public.pre_enrollments USING btree (school_id);

CREATE INDEX idx_receipts_payment ON public.receipts USING btree (payment_id);

CREATE INDEX idx_receipts_school ON public.receipts USING btree (school_id);

CREATE INDEX idx_receipts_verification ON public.receipts USING btree (verification_code);

CREATE INDEX idx_report_cards_enrollment ON public.report_cards USING btree (enrollment_id);

CREATE INDEX idx_report_cards_school ON public.report_cards USING btree (school_id);

CREATE INDEX idx_report_cards_year ON public.report_cards USING btree (academic_year_id);

CREATE INDEX idx_required_documents_level ON public.required_documents USING btree (school_id, applicable_to_level_id);

CREATE INDEX idx_required_documents_school ON public.required_documents USING btree (school_id);

CREATE INDEX idx_school_payment_methods_school ON public.school_payment_methods USING btree (school_id);

CREATE INDEX idx_schools_location ON public.schools USING btree (latitude, longitude) WHERE ((published_to_trouvetou = true) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL));

CREATE INDEX idx_spr_created ON public.subscription_payment_requests USING btree (created_at DESC);

CREATE INDEX idx_spr_product ON public.subscription_payment_requests USING btree (product_id);

CREATE INDEX idx_spr_status ON public.subscription_payment_requests USING btree (status);

CREATE INDEX idx_spr_tenant ON public.subscription_payment_requests USING btree (tenant_id);

CREATE INDEX idx_student_qr_code ON public.student_qr_codes USING btree (qr_code);

CREATE INDEX idx_student_qr_enrollment ON public.student_qr_codes USING btree (enrollment_id);

CREATE INDEX idx_student_qr_school ON public.student_qr_codes USING btree (school_id);

CREATE INDEX idx_students_guardian ON public.students USING btree (school_id, last_name, first_name);

CREATE INDEX idx_students_school ON public.students USING btree (school_id);

CREATE INDEX idx_subjects_school ON public.subjects USING btree (school_id);

CREATE INDEX idx_transport_subs_enrollment ON public.transport_subscriptions USING btree (enrollment_id);

CREATE INDEX idx_trouvetou_ads_active ON public.trouvetou_ads USING btree (school_id, is_active, start_date, end_date);

CREATE INDEX idx_trouvetou_ads_school ON public.trouvetou_ads USING btree (school_id);

CREATE INDEX idx_users_phone ON public.users USING btree (phone);

CREATE INDEX idx_usr_school ON public.user_school_roles USING btree (school_id);

CREATE INDEX idx_usr_user ON public.user_school_roles USING btree (user_id);

CREATE UNIQUE INDEX moratoriums_pkey ON public.moratoriums USING btree (id);

CREATE UNIQUE INDEX notification_outbox_pkey ON public.notification_outbox USING btree (id);

CREATE UNIQUE INDEX payment_reminders_pkey ON public.payment_reminders USING btree (id);

CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);

CREATE UNIQUE INDEX platform_fee_ledger_pkey ON public.platform_fee_ledger USING btree (id);

CREATE UNIQUE INDEX platform_fee_ledger_product_event_unique ON public.platform_fee_ledger USING btree (product_id, event_id);

CREATE UNIQUE INDEX platform_invoices_pkey ON public.platform_invoices USING btree (id);

CREATE UNIQUE INDEX platform_invoices_product_tenant_period_unique ON public.platform_invoices USING btree (product_id, tenant_id, period_label);

CREATE UNIQUE INDEX pre_enrollments_pkey ON public.pre_enrollments USING btree (id);

CREATE UNIQUE INDEX pre_enrollments_school_id_code_key ON public.pre_enrollments USING btree (school_id, code);

CREATE UNIQUE INDEX receipts_pkey ON public.receipts USING btree (id);

CREATE UNIQUE INDEX receipts_receipt_number_key ON public.receipts USING btree (receipt_number);

CREATE UNIQUE INDEX receipts_verification_code_key ON public.receipts USING btree (verification_code);

CREATE UNIQUE INDEX report_cards_pkey ON public.report_cards USING btree (id);

CREATE UNIQUE INDEX report_cards_school_id_enrollment_id_academic_year_id_key ON public.report_cards USING btree (school_id, enrollment_id, academic_year_id);

CREATE UNIQUE INDEX required_documents_pkey ON public.required_documents USING btree (id);

CREATE UNIQUE INDEX required_documents_school_id_nom_applicable_to_level_id_key ON public.required_documents USING btree (school_id, nom, applicable_to_level_id);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (code);

CREATE UNIQUE INDEX school_features_pkey ON public.school_features USING btree (school_id, feature);

CREATE UNIQUE INDEX school_payment_methods_pkey ON public.school_payment_methods USING btree (id);

CREATE UNIQUE INDEX school_payment_methods_school_id_type_key ON public.school_payment_methods USING btree (school_id, type);

CREATE UNIQUE INDEX schools_pkey ON public.schools USING btree (id);

CREATE UNIQUE INDEX student_qr_codes_pkey ON public.student_qr_codes USING btree (id);

CREATE UNIQUE INDEX student_qr_codes_school_id_enrollment_id_key ON public.student_qr_codes USING btree (school_id, enrollment_id);

CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id);

CREATE UNIQUE INDEX subjects_pkey ON public.subjects USING btree (id);

CREATE UNIQUE INDEX subjects_school_id_name_key ON public.subjects USING btree (school_id, name);

CREATE UNIQUE INDEX subscription_payment_requests_pkey ON public.subscription_payment_requests USING btree (id);

CREATE UNIQUE INDEX transport_subscriptions_pkey ON public.transport_subscriptions USING btree (id);

CREATE UNIQUE INDEX transport_subscriptions_school_id_academic_year_id_enrollme_key ON public.transport_subscriptions USING btree (school_id, academic_year_id, enrollment_id);

CREATE UNIQUE INDEX trouvetou_ads_pkey ON public.trouvetou_ads USING btree (id);

CREATE UNIQUE INDEX trouvetou_reservations_pkey ON public.trouvetou_reservations USING btree (id);

CREATE UNIQUE INDEX trouvetou_reservations_qr_code_token_key ON public.trouvetou_reservations USING btree (qr_code_token);

CREATE UNIQUE INDEX user_school_roles_pkey ON public.user_school_roles USING btree (id);

CREATE UNIQUE INDEX user_school_roles_user_id_school_id_role_code_key ON public.user_school_roles USING btree (user_id, school_id, role_code);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX year_rollover_logs_pkey ON public.year_rollover_logs USING btree (id);

alter table "public"."academic_decisions" add constraint "academic_decisions_pkey" PRIMARY KEY using index "academic_decisions_pkey";

alter table "public"."academic_years" add constraint "academic_years_pkey" PRIMARY KEY using index "academic_years_pkey";

alter table "public"."accounting_exports" add constraint "accounting_exports_pkey" PRIMARY KEY using index "accounting_exports_pkey";

alter table "public"."attendance_records" add constraint "attendance_records_pkey" PRIMARY KEY using index "attendance_records_pkey";

alter table "public"."billing_configs" add constraint "billing_configs_pkey" PRIMARY KEY using index "billing_configs_pkey";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_pkey" PRIMARY KEY using index "boarding_subscriptions_pkey";

alter table "public"."bus_routes" add constraint "bus_routes_pkey" PRIMARY KEY using index "bus_routes_pkey";

alter table "public"."bus_stops" add constraint "bus_stops_pkey" PRIMARY KEY using index "bus_stops_pkey";

alter table "public"."canteen_attendance" add constraint "canteen_attendance_pkey" PRIMARY KEY using index "canteen_attendance_pkey";

alter table "public"."canteen_menus" add constraint "canteen_menus_pkey" PRIMARY KEY using index "canteen_menus_pkey";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_pkey" PRIMARY KEY using index "canteen_subscriptions_pkey";

alter table "public"."cash_sessions" add constraint "cash_sessions_pkey" PRIMARY KEY using index "cash_sessions_pkey";

alter table "public"."class_subject_assignments" add constraint "class_subject_assignments_pkey" PRIMARY KEY using index "class_subject_assignments_pkey";

alter table "public"."classes" add constraint "classes_pkey" PRIMARY KEY using index "classes_pkey";

alter table "public"."course_sessions" add constraint "course_sessions_pkey" PRIMARY KEY using index "course_sessions_pkey";

alter table "public"."detentions" add constraint "detentions_pkey" PRIMARY KEY using index "detentions_pkey";

alter table "public"."door_entries" add constraint "door_entries_pkey" PRIMARY KEY using index "door_entries_pkey";

alter table "public"."dorm_rooms" add constraint "dorm_rooms_pkey" PRIMARY KEY using index "dorm_rooms_pkey";

alter table "public"."dormitories" add constraint "dormitories_pkey" PRIMARY KEY using index "dormitories_pkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_pkey" PRIMARY KEY using index "dropout_alerts_pkey";

alter table "public"."enrollment_checklist_items" add constraint "enrollment_checklist_items_pkey" PRIMARY KEY using index "enrollment_checklist_items_pkey";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_pkey" PRIMARY KEY using index "enrollment_decisions_pkey";

alter table "public"."enrollments" add constraint "enrollments_pkey" PRIMARY KEY using index "enrollments_pkey";

alter table "public"."family_reliability_scores" add constraint "family_reliability_scores_pkey" PRIMARY KEY using index "family_reliability_scores_pkey";

alter table "public"."fee_schedules" add constraint "fee_schedules_pkey" PRIMARY KEY using index "fee_schedules_pkey";

alter table "public"."financial_profiles" add constraint "financial_profiles_pkey" PRIMARY KEY using index "financial_profiles_pkey";

alter table "public"."grade_entries" add constraint "grade_entries_pkey" PRIMARY KEY using index "grade_entries_pkey";

alter table "public"."grade_levels" add constraint "grade_levels_pkey" PRIMARY KEY using index "grade_levels_pkey";

alter table "public"."guardians" add constraint "guardians_pkey" PRIMARY KEY using index "guardians_pkey";

alter table "public"."homeworks" add constraint "homeworks_pkey" PRIMARY KEY using index "homeworks_pkey";

alter table "public"."moratoriums" add constraint "moratoriums_pkey" PRIMARY KEY using index "moratoriums_pkey";

alter table "public"."notification_outbox" add constraint "notification_outbox_pkey" PRIMARY KEY using index "notification_outbox_pkey";

alter table "public"."payment_reminders" add constraint "payment_reminders_pkey" PRIMARY KEY using index "payment_reminders_pkey";

alter table "public"."payments" add constraint "payments_pkey" PRIMARY KEY using index "payments_pkey";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_pkey" PRIMARY KEY using index "platform_fee_ledger_pkey";

alter table "public"."platform_invoices" add constraint "platform_invoices_pkey" PRIMARY KEY using index "platform_invoices_pkey";

alter table "public"."pre_enrollments" add constraint "pre_enrollments_pkey" PRIMARY KEY using index "pre_enrollments_pkey";

alter table "public"."receipts" add constraint "receipts_pkey" PRIMARY KEY using index "receipts_pkey";

alter table "public"."report_cards" add constraint "report_cards_pkey" PRIMARY KEY using index "report_cards_pkey";

alter table "public"."required_documents" add constraint "required_documents_pkey" PRIMARY KEY using index "required_documents_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."school_features" add constraint "school_features_pkey" PRIMARY KEY using index "school_features_pkey";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_pkey" PRIMARY KEY using index "school_payment_methods_pkey";

alter table "public"."schools" add constraint "schools_pkey" PRIMARY KEY using index "schools_pkey";

alter table "public"."student_qr_codes" add constraint "student_qr_codes_pkey" PRIMARY KEY using index "student_qr_codes_pkey";

alter table "public"."students" add constraint "students_pkey" PRIMARY KEY using index "students_pkey";

alter table "public"."subjects" add constraint "subjects_pkey" PRIMARY KEY using index "subjects_pkey";

alter table "public"."subscription_payment_requests" add constraint "subscription_payment_requests_pkey" PRIMARY KEY using index "subscription_payment_requests_pkey";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_pkey" PRIMARY KEY using index "transport_subscriptions_pkey";

alter table "public"."trouvetou_ads" add constraint "trouvetou_ads_pkey" PRIMARY KEY using index "trouvetou_ads_pkey";

alter table "public"."trouvetou_reservations" add constraint "trouvetou_reservations_pkey" PRIMARY KEY using index "trouvetou_reservations_pkey";

alter table "public"."user_school_roles" add constraint "user_school_roles_pkey" PRIMARY KEY using index "user_school_roles_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."year_rollover_logs" add constraint "year_rollover_logs_pkey" PRIMARY KEY using index "year_rollover_logs_pkey";

alter table "public"."academic_decisions" add constraint "academic_decisions_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."academic_decisions" validate constraint "academic_decisions_academic_year_id_fkey";

alter table "public"."academic_decisions" add constraint "academic_decisions_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES public.users(id) not valid;

alter table "public"."academic_decisions" validate constraint "academic_decisions_decided_by_fkey";

alter table "public"."academic_decisions" add constraint "academic_decisions_decision_check" CHECK ((decision = ANY (ARRAY['admitted'::text, 'repeated'::text, 'excluded'::text, 'pending'::text]))) not valid;

alter table "public"."academic_decisions" validate constraint "academic_decisions_decision_check";

alter table "public"."academic_decisions" add constraint "academic_decisions_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."academic_decisions" validate constraint "academic_decisions_enrollment_id_fkey";

alter table "public"."academic_decisions" add constraint "academic_decisions_school_id_enrollment_id_academic_year_id_key" UNIQUE using index "academic_decisions_school_id_enrollment_id_academic_year_id_key";

alter table "public"."academic_decisions" add constraint "academic_decisions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."academic_decisions" validate constraint "academic_decisions_school_id_fkey";

alter table "public"."academic_years" add constraint "academic_years_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."academic_years" validate constraint "academic_years_school_id_fkey";

alter table "public"."academic_years" add constraint "academic_years_school_id_label_key" UNIQUE using index "academic_years_school_id_label_key";

alter table "public"."accounting_exports" add constraint "accounting_exports_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."accounting_exports" validate constraint "accounting_exports_academic_year_id_fkey";

alter table "public"."accounting_exports" add constraint "accounting_exports_export_type_check" CHECK ((export_type = ANY (ARRAY['syscohada_synthetic'::text, 'syscohada_analytic'::text, 'sage'::text, 'csv'::text]))) not valid;

alter table "public"."accounting_exports" validate constraint "accounting_exports_export_type_check";

alter table "public"."accounting_exports" add constraint "accounting_exports_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES public.users(id) not valid;

alter table "public"."accounting_exports" validate constraint "accounting_exports_generated_by_fkey";

alter table "public"."accounting_exports" add constraint "accounting_exports_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."accounting_exports" validate constraint "accounting_exports_school_id_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_course_session_id_enrollment_id_key" UNIQUE using index "attendance_records_course_session_id_enrollment_id_key";

alter table "public"."attendance_records" add constraint "attendance_records_course_session_id_fkey" FOREIGN KEY (course_session_id) REFERENCES public.course_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_course_session_id_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_enrollment_id_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.users(id) not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_recorded_by_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_school_id_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_status_check" CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'tardy'::text, 'excused'::text]))) not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_status_check";

alter table "public"."billing_configs" add constraint "billing_configs_mode_check" CHECK ((mode = ANY (ARRAY['subscription_tiers'::text, 'event_based'::text]))) not valid;

alter table "public"."billing_configs" validate constraint "billing_configs_mode_check";

alter table "public"."billing_configs" add constraint "billing_configs_product_id_key" UNIQUE using index "billing_configs_product_id_key";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."boarding_subscriptions" validate constraint "boarding_subscriptions_academic_year_id_fkey";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."boarding_subscriptions" validate constraint "boarding_subscriptions_enrollment_id_fkey";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.dorm_rooms(id) ON DELETE SET NULL not valid;

alter table "public"."boarding_subscriptions" validate constraint "boarding_subscriptions_room_id_fkey";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_school_id_academic_year_id_enrollmen_key" UNIQUE using index "boarding_subscriptions_school_id_academic_year_id_enrollmen_key";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."boarding_subscriptions" validate constraint "boarding_subscriptions_school_id_fkey";

alter table "public"."boarding_subscriptions" add constraint "boarding_subscriptions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text]))) not valid;

alter table "public"."boarding_subscriptions" validate constraint "boarding_subscriptions_status_check";

alter table "public"."bus_routes" add constraint "bus_routes_capacity_check" CHECK ((capacity > 0)) not valid;

alter table "public"."bus_routes" validate constraint "bus_routes_capacity_check";

alter table "public"."bus_routes" add constraint "bus_routes_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."bus_routes" validate constraint "bus_routes_school_id_fkey";

alter table "public"."bus_stops" add constraint "bus_stops_route_id_fkey" FOREIGN KEY (route_id) REFERENCES public.bus_routes(id) ON DELETE CASCADE not valid;

alter table "public"."bus_stops" validate constraint "bus_stops_route_id_fkey";

alter table "public"."bus_stops" add constraint "bus_stops_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."bus_stops" validate constraint "bus_stops_school_id_fkey";

alter table "public"."canteen_attendance" add constraint "canteen_attendance_scanned_by_fkey" FOREIGN KEY (scanned_by) REFERENCES public.users(id) not valid;

alter table "public"."canteen_attendance" validate constraint "canteen_attendance_scanned_by_fkey";

alter table "public"."canteen_attendance" add constraint "canteen_attendance_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."canteen_attendance" validate constraint "canteen_attendance_school_id_fkey";

alter table "public"."canteen_attendance" add constraint "canteen_attendance_status_check" CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text]))) not valid;

alter table "public"."canteen_attendance" validate constraint "canteen_attendance_status_check";

alter table "public"."canteen_attendance" add constraint "canteen_attendance_subscription_id_date_meal_type_key" UNIQUE using index "canteen_attendance_subscription_id_date_meal_type_key";

alter table "public"."canteen_attendance" add constraint "canteen_attendance_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES public.canteen_subscriptions(id) ON DELETE CASCADE not valid;

alter table "public"."canteen_attendance" validate constraint "canteen_attendance_subscription_id_fkey";

alter table "public"."canteen_menus" add constraint "canteen_menus_meal_type_check" CHECK ((meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'snack'::text]))) not valid;

alter table "public"."canteen_menus" validate constraint "canteen_menus_meal_type_check";

alter table "public"."canteen_menus" add constraint "canteen_menus_school_id_date_meal_type_key" UNIQUE using index "canteen_menus_school_id_date_meal_type_key";

alter table "public"."canteen_menus" add constraint "canteen_menus_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."canteen_menus" validate constraint "canteen_menus_school_id_fkey";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."canteen_subscriptions" validate constraint "canteen_subscriptions_academic_year_id_fkey";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."canteen_subscriptions" validate constraint "canteen_subscriptions_enrollment_id_fkey";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_plan_type_check" CHECK ((plan_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'annual'::text]))) not valid;

alter table "public"."canteen_subscriptions" validate constraint "canteen_subscriptions_plan_type_check";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_school_id_academic_year_id_enrollment_key" UNIQUE using index "canteen_subscriptions_school_id_academic_year_id_enrollment_key";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."canteen_subscriptions" validate constraint "canteen_subscriptions_school_id_fkey";

alter table "public"."canteen_subscriptions" add constraint "canteen_subscriptions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text]))) not valid;

alter table "public"."canteen_subscriptions" validate constraint "canteen_subscriptions_status_check";

alter table "public"."cash_sessions" add constraint "cash_sessions_closed_by_fkey" FOREIGN KEY (closed_by) REFERENCES public.users(id) not valid;

alter table "public"."cash_sessions" validate constraint "cash_sessions_closed_by_fkey";

alter table "public"."cash_sessions" add constraint "cash_sessions_opened_by_fkey" FOREIGN KEY (opened_by) REFERENCES public.users(id) not valid;

alter table "public"."cash_sessions" validate constraint "cash_sessions_opened_by_fkey";

alter table "public"."cash_sessions" add constraint "cash_sessions_opening_amount_check" CHECK ((opening_amount >= 0)) not valid;

alter table "public"."cash_sessions" validate constraint "cash_sessions_opening_amount_check";

alter table "public"."cash_sessions" add constraint "cash_sessions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."cash_sessions" validate constraint "cash_sessions_school_id_fkey";

alter table "public"."cash_sessions" add constraint "cash_sessions_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'reconciled'::text]))) not valid;

alter table "public"."cash_sessions" validate constraint "cash_sessions_status_check";

alter table "public"."class_subject_assignments" add constraint "class_subject_assignments_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE not valid;

alter table "public"."class_subject_assignments" validate constraint "class_subject_assignments_class_id_fkey";

alter table "public"."class_subject_assignments" add constraint "class_subject_assignments_school_id_class_id_subject_id_key" UNIQUE using index "class_subject_assignments_school_id_class_id_subject_id_key";

alter table "public"."class_subject_assignments" add constraint "class_subject_assignments_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."class_subject_assignments" validate constraint "class_subject_assignments_school_id_fkey";

alter table "public"."class_subject_assignments" add constraint "class_subject_assignments_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE not valid;

alter table "public"."class_subject_assignments" validate constraint "class_subject_assignments_subject_id_fkey";

alter table "public"."class_subject_assignments" add constraint "class_subject_assignments_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.users(id) not valid;

alter table "public"."class_subject_assignments" validate constraint "class_subject_assignments_teacher_id_fkey";

alter table "public"."classes" add constraint "classes_grade_level_id_fkey" FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id) ON DELETE RESTRICT not valid;

alter table "public"."classes" validate constraint "classes_grade_level_id_fkey";

alter table "public"."classes" add constraint "classes_head_teacher_id_fkey" FOREIGN KEY (head_teacher_id) REFERENCES public.users(id) not valid;

alter table "public"."classes" validate constraint "classes_head_teacher_id_fkey";

alter table "public"."classes" add constraint "classes_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."classes" validate constraint "classes_school_id_fkey";

alter table "public"."classes" add constraint "classes_school_id_name_key" UNIQUE using index "classes_school_id_name_key";

alter table "public"."course_sessions" add constraint "course_sessions_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE not valid;

alter table "public"."course_sessions" validate constraint "course_sessions_academic_year_id_fkey";

alter table "public"."course_sessions" add constraint "course_sessions_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE not valid;

alter table "public"."course_sessions" validate constraint "course_sessions_class_id_fkey";

alter table "public"."course_sessions" add constraint "course_sessions_school_id_class_id_subject_id_teacher_id_st_key" UNIQUE using index "course_sessions_school_id_class_id_subject_id_teacher_id_st_key";

alter table "public"."course_sessions" add constraint "course_sessions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."course_sessions" validate constraint "course_sessions_school_id_fkey";

alter table "public"."course_sessions" add constraint "course_sessions_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE not valid;

alter table "public"."course_sessions" validate constraint "course_sessions_subject_id_fkey";

alter table "public"."course_sessions" add constraint "course_sessions_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.users(id) not valid;

alter table "public"."course_sessions" validate constraint "course_sessions_teacher_id_fkey";

alter table "public"."detentions" add constraint "detentions_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES public.users(id) not valid;

alter table "public"."detentions" validate constraint "detentions_assigned_by_fkey";

alter table "public"."detentions" add constraint "detentions_duration_minutes_check" CHECK ((duration_minutes > 0)) not valid;

alter table "public"."detentions" validate constraint "detentions_duration_minutes_check";

alter table "public"."detentions" add constraint "detentions_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."detentions" validate constraint "detentions_enrollment_id_fkey";

alter table "public"."detentions" add constraint "detentions_school_id_enrollment_id_scheduled_date_scheduled_key" UNIQUE using index "detentions_school_id_enrollment_id_scheduled_date_scheduled_key";

alter table "public"."detentions" add constraint "detentions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."detentions" validate constraint "detentions_school_id_fkey";

alter table "public"."door_entries" add constraint "door_entries_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."door_entries" validate constraint "door_entries_enrollment_id_fkey";

alter table "public"."door_entries" add constraint "door_entries_event_type_check" CHECK ((event_type = ANY (ARRAY['entry'::text, 'exit'::text]))) not valid;

alter table "public"."door_entries" validate constraint "door_entries_event_type_check";

alter table "public"."door_entries" add constraint "door_entries_qr_code_id_fkey" FOREIGN KEY (qr_code_id) REFERENCES public.student_qr_codes(id) ON DELETE CASCADE not valid;

alter table "public"."door_entries" validate constraint "door_entries_qr_code_id_fkey";

alter table "public"."door_entries" add constraint "door_entries_scanned_by_fkey" FOREIGN KEY (scanned_by) REFERENCES public.users(id) not valid;

alter table "public"."door_entries" validate constraint "door_entries_scanned_by_fkey";

alter table "public"."door_entries" add constraint "door_entries_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."door_entries" validate constraint "door_entries_school_id_fkey";

alter table "public"."dorm_rooms" add constraint "dorm_rooms_capacity_check" CHECK ((capacity > 0)) not valid;

alter table "public"."dorm_rooms" validate constraint "dorm_rooms_capacity_check";

alter table "public"."dorm_rooms" add constraint "dorm_rooms_dormitory_id_fkey" FOREIGN KEY (dormitory_id) REFERENCES public.dormitories(id) ON DELETE CASCADE not valid;

alter table "public"."dorm_rooms" validate constraint "dorm_rooms_dormitory_id_fkey";

alter table "public"."dorm_rooms" add constraint "dorm_rooms_dormitory_id_room_number_key" UNIQUE using index "dorm_rooms_dormitory_id_room_number_key";

alter table "public"."dorm_rooms" add constraint "dorm_rooms_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."dorm_rooms" validate constraint "dorm_rooms_school_id_fkey";

alter table "public"."dormitories" add constraint "dormitories_capacity_check" CHECK ((capacity > 0)) not valid;

alter table "public"."dormitories" validate constraint "dormitories_capacity_check";

alter table "public"."dormitories" add constraint "dormitories_gender_restriction_check" CHECK ((gender_restriction = ANY (ARRAY['male'::text, 'female'::text, 'mixed'::text]))) not valid;

alter table "public"."dormitories" validate constraint "dormitories_gender_restriction_check";

alter table "public"."dormitories" add constraint "dormitories_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."dormitories" validate constraint "dormitories_school_id_fkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_alert_type_check" CHECK ((alert_type = ANY (ARRAY['entered_but_absent'::text, 'absent_but_not_left'::text, 'late_entry'::text]))) not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_alert_type_check";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_course_session_id_fkey" FOREIGN KEY (course_session_id) REFERENCES public.course_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_course_session_id_fkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_door_entry_id_fkey" FOREIGN KEY (door_entry_id) REFERENCES public.door_entries(id) ON DELETE CASCADE not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_door_entry_id_fkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_enrollment_id_fkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_investigated_by_fkey" FOREIGN KEY (investigated_by) REFERENCES public.users(id) not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_investigated_by_fkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_school_id_fkey";

alter table "public"."dropout_alerts" add constraint "dropout_alerts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'investigated'::text, 'false_alarm'::text, 'resolved'::text]))) not valid;

alter table "public"."dropout_alerts" validate constraint "dropout_alerts_status_check";

alter table "public"."enrollment_checklist_items" add constraint "enrollment_checklist_items_montant_cash_check" CHECK (((montant_cash IS NULL) OR (montant_cash >= 0))) not valid;

alter table "public"."enrollment_checklist_items" validate constraint "enrollment_checklist_items_montant_cash_check";

alter table "public"."enrollment_checklist_items" add constraint "enrollment_checklist_items_nom_check" CHECK ((TRIM(BOTH FROM nom) <> ''::text)) not valid;

alter table "public"."enrollment_checklist_items" validate constraint "enrollment_checklist_items_nom_check";

alter table "public"."enrollment_checklist_items" add constraint "enrollment_checklist_items_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."enrollment_checklist_items" validate constraint "enrollment_checklist_items_school_id_fkey";

alter table "public"."enrollment_checklist_items" add constraint "enrollment_checklist_items_school_id_ordre_affichage_key" UNIQUE using index "enrollment_checklist_items_school_id_ordre_affichage_key";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE not valid;

alter table "public"."enrollment_decisions" validate constraint "enrollment_decisions_academic_year_id_fkey";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES public.users(id) not valid;

alter table "public"."enrollment_decisions" validate constraint "enrollment_decisions_decided_by_fkey";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_decision_check" CHECK ((decision = ANY (ARRAY['admitted'::text, 'repeated'::text, 'excluded'::text, 'pending'::text]))) not valid;

alter table "public"."enrollment_decisions" validate constraint "enrollment_decisions_decision_check";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_enrollment_id_academic_year_id_key" UNIQUE using index "enrollment_decisions_enrollment_id_academic_year_id_key";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."enrollment_decisions" validate constraint "enrollment_decisions_enrollment_id_fkey";

alter table "public"."enrollment_decisions" add constraint "enrollment_decisions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."enrollment_decisions" validate constraint "enrollment_decisions_school_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) not valid;

alter table "public"."enrollments" validate constraint "enrollments_academic_year_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."enrollments" validate constraint "enrollments_class_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_financial_profile_id_fkey" FOREIGN KEY (financial_profile_id) REFERENCES public.financial_profiles(id) not valid;

alter table "public"."enrollments" validate constraint "enrollments_financial_profile_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_grade_level_id_fkey" FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id) not valid;

alter table "public"."enrollments" validate constraint "enrollments_grade_level_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_guardian_id_fkey" FOREIGN KEY (guardian_id) REFERENCES public.guardians(id) not valid;

alter table "public"."enrollments" validate constraint "enrollments_guardian_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_matricule_key" UNIQUE using index "enrollments_matricule_key";

alter table "public"."enrollments" add constraint "enrollments_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."enrollments" validate constraint "enrollments_school_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_school_id_matricule_key" UNIQUE using index "enrollments_school_id_matricule_key";

alter table "public"."enrollments" add constraint "enrollments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."enrollments" validate constraint "enrollments_student_id_fkey";

alter table "public"."family_reliability_scores" add constraint "family_reliability_scores_guardian_id_fkey" FOREIGN KEY (guardian_id) REFERENCES public.guardians(id) not valid;

alter table "public"."family_reliability_scores" validate constraint "family_reliability_scores_guardian_id_fkey";

alter table "public"."family_reliability_scores" add constraint "family_reliability_scores_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."family_reliability_scores" validate constraint "family_reliability_scores_school_id_fkey";

alter table "public"."family_reliability_scores" add constraint "family_reliability_scores_school_id_guardian_id_key" UNIQUE using index "family_reliability_scores_school_id_guardian_id_key";

alter table "public"."family_reliability_scores" add constraint "family_reliability_scores_score_check" CHECK (((score >= 0) AND (score <= 100))) not valid;

alter table "public"."family_reliability_scores" validate constraint "family_reliability_scores_score_check";

alter table "public"."fee_schedules" add constraint "fee_schedules_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."fee_schedules" validate constraint "fee_schedules_academic_year_id_fkey";

alter table "public"."fee_schedules" add constraint "fee_schedules_amount_check" CHECK ((amount >= 0)) not valid;

alter table "public"."fee_schedules" validate constraint "fee_schedules_amount_check";

alter table "public"."fee_schedules" add constraint "fee_schedules_financial_profile_id_fkey" FOREIGN KEY (financial_profile_id) REFERENCES public.financial_profiles(id) ON DELETE RESTRICT not valid;

alter table "public"."fee_schedules" validate constraint "fee_schedules_financial_profile_id_fkey";

alter table "public"."fee_schedules" add constraint "fee_schedules_grade_level_id_fkey" FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id) ON DELETE RESTRICT not valid;

alter table "public"."fee_schedules" validate constraint "fee_schedules_grade_level_id_fkey";

alter table "public"."fee_schedules" add constraint "fee_schedules_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."fee_schedules" validate constraint "fee_schedules_school_id_fkey";

alter table "public"."fee_schedules" add constraint "fee_schedules_school_id_grade_level_id_financial_profile_id_key" UNIQUE using index "fee_schedules_school_id_grade_level_id_financial_profile_id_key";

alter table "public"."financial_profiles" add constraint "financial_profiles_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."financial_profiles" validate constraint "financial_profiles_school_id_fkey";

alter table "public"."financial_profiles" add constraint "financial_profiles_school_id_name_key" UNIQUE using index "financial_profiles_school_id_name_key";

alter table "public"."grade_entries" add constraint "grade_entries_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_academic_year_id_fkey";

alter table "public"."grade_entries" add constraint "grade_entries_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_created_by_fkey";

alter table "public"."grade_entries" add constraint "grade_entries_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_enrollment_id_fkey";

alter table "public"."grade_entries" add constraint "grade_entries_grade_type_check" CHECK ((grade_type = ANY (ARRAY['devoir'::text, 'controle'::text, 'interrogation'::text, 'project'::text, 'other'::text]))) not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_grade_type_check";

alter table "public"."grade_entries" add constraint "grade_entries_max_value_check" CHECK ((max_value > (0)::numeric)) not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_max_value_check";

alter table "public"."grade_entries" add constraint "grade_entries_school_id_enrollment_id_subject_id_academic_y_key" UNIQUE using index "grade_entries_school_id_enrollment_id_subject_id_academic_y_key";

alter table "public"."grade_entries" add constraint "grade_entries_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_school_id_fkey";

alter table "public"."grade_entries" add constraint "grade_entries_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.course_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_session_id_fkey";

alter table "public"."grade_entries" add constraint "grade_entries_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_subject_id_fkey";

alter table "public"."grade_entries" add constraint "grade_entries_value_check" CHECK (((value >= (0)::numeric) AND (value <= (20)::numeric))) not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_value_check";

alter table "public"."grade_entries" add constraint "grade_entries_weight_check" CHECK ((weight >= (0)::numeric)) not valid;

alter table "public"."grade_entries" validate constraint "grade_entries_weight_check";

alter table "public"."grade_levels" add constraint "grade_levels_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."grade_levels" validate constraint "grade_levels_school_id_fkey";

alter table "public"."grade_levels" add constraint "grade_levels_school_id_name_key" UNIQUE using index "grade_levels_school_id_name_key";

alter table "public"."guardians" add constraint "guardians_phone_key" UNIQUE using index "guardians_phone_key";

alter table "public"."homeworks" add constraint "homeworks_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE not valid;

alter table "public"."homeworks" validate constraint "homeworks_class_id_fkey";

alter table "public"."homeworks" add constraint "homeworks_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."homeworks" validate constraint "homeworks_school_id_fkey";

alter table "public"."homeworks" add constraint "homeworks_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE not valid;

alter table "public"."homeworks" validate constraint "homeworks_subject_id_fkey";

alter table "public"."homeworks" add constraint "homeworks_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.users(id) not valid;

alter table "public"."homeworks" validate constraint "homeworks_teacher_id_fkey";

alter table "public"."moratoriums" add constraint "moratoriums_approved_amount_check" CHECK ((approved_amount >= 0)) not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_approved_amount_check";

alter table "public"."moratoriums" add constraint "moratoriums_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_enrollment_id_fkey";

alter table "public"."moratoriums" add constraint "moratoriums_guardian_id_fkey" FOREIGN KEY (guardian_id) REFERENCES public.guardians(id) not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_guardian_id_fkey";

alter table "public"."moratoriums" add constraint "moratoriums_requested_amount_check" CHECK ((requested_amount >= 0)) not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_requested_amount_check";

alter table "public"."moratoriums" add constraint "moratoriums_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.users(id) not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_reviewed_by_fkey";

alter table "public"."moratoriums" add constraint "moratoriums_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_school_id_fkey";

alter table "public"."moratoriums" add constraint "moratoriums_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'completed'::text]))) not valid;

alter table "public"."moratoriums" validate constraint "moratoriums_status_check";

alter table "public"."notification_outbox" add constraint "notification_outbox_channel_check" CHECK ((channel = ANY (ARRAY['push'::text, 'sms'::text, 'whatsapp'::text, 'email'::text, 'telegram'::text]))) not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_channel_check";

alter table "public"."notification_outbox" add constraint "notification_outbox_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_school_id_fkey";

alter table "public"."notification_outbox" add constraint "notification_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_status_check";

alter table "public"."payment_reminders" add constraint "payment_reminders_channel_check" CHECK ((channel = ANY (ARRAY['push'::text, 'sms'::text, 'whatsapp'::text, 'email'::text]))) not valid;

alter table "public"."payment_reminders" validate constraint "payment_reminders_channel_check";

alter table "public"."payment_reminders" add constraint "payment_reminders_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."payment_reminders" validate constraint "payment_reminders_enrollment_id_fkey";

alter table "public"."payment_reminders" add constraint "payment_reminders_reminder_type_check" CHECK ((reminder_type = ANY (ARRAY['preventive'::text, 'formal'::text, 'warning'::text, 'access_restriction'::text]))) not valid;

alter table "public"."payment_reminders" validate constraint "payment_reminders_reminder_type_check";

alter table "public"."payment_reminders" add constraint "payment_reminders_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."payment_reminders" validate constraint "payment_reminders_school_id_fkey";

alter table "public"."payment_reminders" add constraint "payment_reminders_sent_by_fkey" FOREIGN KEY (sent_by) REFERENCES public.users(id) not valid;

alter table "public"."payment_reminders" validate constraint "payment_reminders_sent_by_fkey";

alter table "public"."payments" add constraint "payments_amount_check" CHECK ((amount > 0)) not valid;

alter table "public"."payments" validate constraint "payments_amount_check";

alter table "public"."payments" add constraint "payments_cash_session_id_fkey" FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_cash_session_id_fkey";

alter table "public"."payments" add constraint "payments_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."payments" validate constraint "payments_enrollment_id_fkey";

alter table "public"."payments" add constraint "payments_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'mobile_money'::text, 'check'::text, 'transfer'::text]))) not valid;

alter table "public"."payments" validate constraint "payments_payment_method_check";

alter table "public"."payments" add constraint "payments_received_by_fkey" FOREIGN KEY (received_by) REFERENCES public.users(id) not valid;

alter table "public"."payments" validate constraint "payments_received_by_fkey";

alter table "public"."payments" add constraint "payments_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_school_id_fkey";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL not valid;

alter table "public"."platform_fee_ledger" validate constraint "platform_fee_ledger_academic_year_id_fkey";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_amount_check" CHECK ((amount >= 0)) not valid;

alter table "public"."platform_fee_ledger" validate constraint "platform_fee_ledger_amount_check";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_enrollment_id_fkey" FOREIGN KEY (event_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."platform_fee_ledger" validate constraint "platform_fee_ledger_enrollment_id_fkey";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_product_event_unique" UNIQUE using index "platform_fee_ledger_product_event_unique";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_school_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.schools(id) ON DELETE RESTRICT not valid;

alter table "public"."platform_fee_ledger" validate constraint "platform_fee_ledger_school_id_fkey";

alter table "public"."platform_fee_ledger" add constraint "platform_fee_ledger_status_check" CHECK ((status = ANY (ARRAY['due'::text, 'collected'::text, 'settled'::text]))) not valid;

alter table "public"."platform_fee_ledger" validate constraint "platform_fee_ledger_status_check";

alter table "public"."platform_invoices" add constraint "platform_invoices_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL not valid;

alter table "public"."platform_invoices" validate constraint "platform_invoices_academic_year_id_fkey";

alter table "public"."platform_invoices" add constraint "platform_invoices_product_tenant_period_unique" UNIQUE using index "platform_invoices_product_tenant_period_unique";

alter table "public"."platform_invoices" add constraint "platform_invoices_school_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.schools(id) ON DELETE RESTRICT not valid;

alter table "public"."platform_invoices" validate constraint "platform_invoices_school_id_fkey";

alter table "public"."platform_invoices" add constraint "platform_invoices_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text]))) not valid;

alter table "public"."platform_invoices" validate constraint "platform_invoices_status_check";

alter table "public"."pre_enrollments" add constraint "pre_enrollments_grade_level_id_fkey" FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id) not valid;

alter table "public"."pre_enrollments" validate constraint "pre_enrollments_grade_level_id_fkey";

alter table "public"."pre_enrollments" add constraint "pre_enrollments_school_id_code_key" UNIQUE using index "pre_enrollments_school_id_code_key";

alter table "public"."pre_enrollments" add constraint "pre_enrollments_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."pre_enrollments" validate constraint "pre_enrollments_school_id_fkey";

alter table "public"."receipts" add constraint "receipts_issued_by_fkey" FOREIGN KEY (issued_by) REFERENCES public.users(id) not valid;

alter table "public"."receipts" validate constraint "receipts_issued_by_fkey";

alter table "public"."receipts" add constraint "receipts_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE not valid;

alter table "public"."receipts" validate constraint "receipts_payment_id_fkey";

alter table "public"."receipts" add constraint "receipts_receipt_number_key" UNIQUE using index "receipts_receipt_number_key";

alter table "public"."receipts" add constraint "receipts_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."receipts" validate constraint "receipts_school_id_fkey";

alter table "public"."receipts" add constraint "receipts_verification_code_key" UNIQUE using index "receipts_verification_code_key";

alter table "public"."report_cards" add constraint "report_cards_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."report_cards" validate constraint "report_cards_academic_year_id_fkey";

alter table "public"."report_cards" add constraint "report_cards_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT not valid;

alter table "public"."report_cards" validate constraint "report_cards_enrollment_id_fkey";

alter table "public"."report_cards" add constraint "report_cards_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES public.users(id) not valid;

alter table "public"."report_cards" validate constraint "report_cards_generated_by_fkey";

alter table "public"."report_cards" add constraint "report_cards_school_id_enrollment_id_academic_year_id_key" UNIQUE using index "report_cards_school_id_enrollment_id_academic_year_id_key";

alter table "public"."report_cards" add constraint "report_cards_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."report_cards" validate constraint "report_cards_school_id_fkey";

alter table "public"."report_cards" add constraint "report_cards_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'generated'::text, 'sent'::text, 'archived'::text]))) not valid;

alter table "public"."report_cards" validate constraint "report_cards_status_check";

alter table "public"."required_documents" add constraint "required_documents_applicable_to_level_id_fkey" FOREIGN KEY (applicable_to_level_id) REFERENCES public.grade_levels(id) ON DELETE SET NULL not valid;

alter table "public"."required_documents" validate constraint "required_documents_applicable_to_level_id_fkey";

alter table "public"."required_documents" add constraint "required_documents_nom_check" CHECK ((TRIM(BOTH FROM nom) <> ''::text)) not valid;

alter table "public"."required_documents" validate constraint "required_documents_nom_check";

alter table "public"."required_documents" add constraint "required_documents_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."required_documents" validate constraint "required_documents_school_id_fkey";

alter table "public"."required_documents" add constraint "required_documents_school_id_nom_applicable_to_level_id_key" UNIQUE using index "required_documents_school_id_nom_applicable_to_level_id_key";

alter table "public"."school_features" add constraint "school_features_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."school_features" validate constraint "school_features_school_id_fkey";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_iban_check" CHECK (((iban IS NULL) OR (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'::text))) not valid;

alter table "public"."school_payment_methods" validate constraint "school_payment_methods_iban_check";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_mobile_money_prefix_check" CHECK (((length(mobile_money_prefix) <= 5) OR (mobile_money_prefix IS NULL))) not valid;

alter table "public"."school_payment_methods" validate constraint "school_payment_methods_mobile_money_prefix_check";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_mobile_money_type_check" CHECK (((mobile_money_type = ANY (ARRAY['wave'::text, 'express'::text, 'mtn'::text, 'orange'::text, 'moov'::text, 'autre'::text])) OR (mobile_money_type IS NULL))) not valid;

alter table "public"."school_payment_methods" validate constraint "school_payment_methods_mobile_money_type_check";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."school_payment_methods" validate constraint "school_payment_methods_school_id_fkey";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_school_id_type_key" UNIQUE using index "school_payment_methods_school_id_type_key";

alter table "public"."school_payment_methods" add constraint "school_payment_methods_type_check" CHECK ((type = ANY (ARRAY['esperes'::text, 'mobile_money'::text, 'virement_bancaire'::text, 'cheque'::text]))) not valid;

alter table "public"."school_payment_methods" validate constraint "school_payment_methods_type_check";

alter table "public"."student_qr_codes" add constraint "student_qr_codes_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."student_qr_codes" validate constraint "student_qr_codes_enrollment_id_fkey";

alter table "public"."student_qr_codes" add constraint "student_qr_codes_school_id_enrollment_id_key" UNIQUE using index "student_qr_codes_school_id_enrollment_id_key";

alter table "public"."student_qr_codes" add constraint "student_qr_codes_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."student_qr_codes" validate constraint "student_qr_codes_school_id_fkey";

alter table "public"."students" add constraint "students_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."students" validate constraint "students_school_id_fkey";

alter table "public"."subjects" add constraint "subjects_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."subjects" validate constraint "subjects_school_id_fkey";

alter table "public"."subjects" add constraint "subjects_school_id_name_key" UNIQUE using index "subjects_school_id_name_key";

alter table "public"."subscription_payment_requests" add constraint "subscription_payment_requests_amount_check" CHECK ((amount >= 0)) not valid;

alter table "public"."subscription_payment_requests" validate constraint "subscription_payment_requests_amount_check";

alter table "public"."subscription_payment_requests" add constraint "subscription_payment_requests_payment_provider_check" CHECK ((payment_provider = ANY (ARRAY['wave'::text, 'orange_money'::text, 'mtn_money'::text, 'moov_money'::text, 'pi_spi'::text, 'manual'::text]))) not valid;

alter table "public"."subscription_payment_requests" validate constraint "subscription_payment_requests_payment_provider_check";

alter table "public"."subscription_payment_requests" add constraint "subscription_payment_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'validated'::text, 'rejected'::text, 'cancelled'::text]))) not valid;

alter table "public"."subscription_payment_requests" validate constraint "subscription_payment_requests_status_check";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_academic_year_id_fkey" FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."transport_subscriptions" validate constraint "transport_subscriptions_academic_year_id_fkey";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE not valid;

alter table "public"."transport_subscriptions" validate constraint "transport_subscriptions_enrollment_id_fkey";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_route_id_fkey" FOREIGN KEY (route_id) REFERENCES public.bus_routes(id) ON DELETE RESTRICT not valid;

alter table "public"."transport_subscriptions" validate constraint "transport_subscriptions_route_id_fkey";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_school_id_academic_year_id_enrollme_key" UNIQUE using index "transport_subscriptions_school_id_academic_year_id_enrollme_key";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."transport_subscriptions" validate constraint "transport_subscriptions_school_id_fkey";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text]))) not valid;

alter table "public"."transport_subscriptions" validate constraint "transport_subscriptions_status_check";

alter table "public"."transport_subscriptions" add constraint "transport_subscriptions_stop_id_fkey" FOREIGN KEY (stop_id) REFERENCES public.bus_stops(id) ON DELETE SET NULL not valid;

alter table "public"."transport_subscriptions" validate constraint "transport_subscriptions_stop_id_fkey";

alter table "public"."trouvetou_ads" add constraint "trouvetou_ads_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."trouvetou_ads" validate constraint "trouvetou_ads_school_id_fkey";

alter table "public"."trouvetou_reservations" add constraint "trouvetou_reservations_grade_level_id_fkey" FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id) ON DELETE CASCADE not valid;

alter table "public"."trouvetou_reservations" validate constraint "trouvetou_reservations_grade_level_id_fkey";

alter table "public"."trouvetou_reservations" add constraint "trouvetou_reservations_qr_code_token_key" UNIQUE using index "trouvetou_reservations_qr_code_token_key";

alter table "public"."trouvetou_reservations" add constraint "trouvetou_reservations_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."trouvetou_reservations" validate constraint "trouvetou_reservations_school_id_fkey";

alter table "public"."trouvetou_reservations" add constraint "trouvetou_reservations_status_check" CHECK ((status = ANY (ARRAY['pending_payment'::text, 'reserved'::text, 'confirmed'::text, 'expired'::text]))) not valid;

alter table "public"."trouvetou_reservations" validate constraint "trouvetou_reservations_status_check";

alter table "public"."user_school_roles" add constraint "user_school_roles_role_code_fkey" FOREIGN KEY (role_code) REFERENCES public.roles(code) not valid;

alter table "public"."user_school_roles" validate constraint "user_school_roles_role_code_fkey";

alter table "public"."user_school_roles" add constraint "user_school_roles_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."user_school_roles" validate constraint "user_school_roles_school_id_fkey";

alter table "public"."user_school_roles" add constraint "user_school_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_school_roles" validate constraint "user_school_roles_user_id_fkey";

alter table "public"."user_school_roles" add constraint "user_school_roles_user_id_school_id_role_code_key" UNIQUE using index "user_school_roles_user_id_school_id_role_code_key";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

alter table "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."users" validate constraint "users_id_fkey";

alter table "public"."users" add constraint "users_phone_key" UNIQUE using index "users_phone_key";

alter table "public"."year_rollover_logs" add constraint "year_rollover_logs_initiated_by_fkey" FOREIGN KEY (initiated_by) REFERENCES public.users(id) not valid;

alter table "public"."year_rollover_logs" validate constraint "year_rollover_logs_initiated_by_fkey";

alter table "public"."year_rollover_logs" add constraint "year_rollover_logs_new_year_id_fkey" FOREIGN KEY (new_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."year_rollover_logs" validate constraint "year_rollover_logs_new_year_id_fkey";

alter table "public"."year_rollover_logs" add constraint "year_rollover_logs_old_year_id_fkey" FOREIGN KEY (old_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT not valid;

alter table "public"."year_rollover_logs" validate constraint "year_rollover_logs_old_year_id_fkey";

alter table "public"."year_rollover_logs" add constraint "year_rollover_logs_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE not valid;

alter table "public"."year_rollover_logs" validate constraint "year_rollover_logs_school_id_fkey";

alter table "public"."year_rollover_logs" add constraint "year_rollover_logs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."year_rollover_logs" validate constraint "year_rollover_logs_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.billing_rpc_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (
    COALESCE(auth.role(), '') = 'service_role'
    OR public.is_super_admin()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    claims jsonb;
    user_role text;
    user_school uuid;
begin
    -- On récupère le rôle actif de l'utilisateur qui se connecte
    select role_code, school_id into user_role, user_school
    from public.user_school_roles
    where user_id = (event->>'user_id')::uuid
      and is_active = true
    limit 1;

    claims := event->'claims';

    if user_role is not null then
        -- On injecte les données dans app_metadata (qui sera lu par le middleware Next)
        claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
        claims := jsonb_set(claims, '{app_metadata, school_id}', to_jsonb(user_school));
    end if;

    event := jsonb_set(event, '{claims}', claims);
    return event;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.finalize_reservation(p_reservation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_res record;
  v_guardian_id uuid;
  v_student_id uuid;
  v_year_id uuid;
begin
  select * into v_res from public.trouvetou_reservations where id = p_reservation_id for update;
  if not found then return false; end if;
  if v_res.status <> 'reserved' then return false; end if;

  -- 1. Chercher l'année active
  select id into v_year_id from public.academic_years where school_id = v_res.school_id and status = 'active' limit 1;
  
  -- 2. Créer/Trouver tuteur
  select id into v_guardian_id from public.guardians where phone = v_res.parent_phone limit 1;
  if not found then
    insert into public.guardians (full_name, phone, email) values (v_res.parent_full_name, v_res.parent_phone, v_res.parent_email) returning id into v_guardian_id;
  end if;

  -- 3. Créer étudiant
  insert into public.students (school_id, first_name, last_name, birth_date) 
  values (v_res.school_id, split_part(v_res.student_full_name, ' ', 1), substring(v_res.student_full_name from position(' ' in v_res.student_full_name) + 1), v_res.student_birthdate)
  returning id into v_student_id;

  -- 4. Inscription
  insert into public.enrollments (school_id, student_id, guardian_id, grade_level_id, academic_year_id, status, enrollment_date)
  values (v_res.school_id, v_student_id, v_guardian_id, v_res.grade_level_id, v_year_id, 'confirmed', current_date);

  -- 5. Mettre à jour réservation
  update public.trouvetou_reservations set status = 'confirmed' where id = p_reservation_id;
  
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_platform_invoices(p_product_id text, p_period_label text, p_period_start date, p_period_end date)
 RETURNS SETOF public.platform_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin';
  END IF;

  INSERT INTO public.platform_invoices (
    product_id, tenant_id, academic_year_id,
    period_label, period_start, period_end,
    total_events, total_due, status
  )
  SELECT
    p_product_id,
    pfl.tenant_id,
    pfl.academic_year_id,
    p_period_label,
    p_period_start,
    p_period_end,
    COUNT(*)::INTEGER as total_events,
    SUM(pfl.amount) as total_due,
    'pending'::TEXT
  FROM public.platform_fee_ledger pfl
  WHERE pfl.product_id = p_product_id
    AND pfl.status IN ('due', 'collected')
    AND pfl.created_at >= p_period_start
    AND pfl.created_at <= p_period_end
  GROUP BY pfl.tenant_id, pfl.academic_year_id
  ON CONFLICT (product_id, tenant_id, period_label) DO UPDATE SET
    total_events = EXCLUDED.total_events,
    total_due = EXCLUDED.total_due,
    updated_at = NOW()
  RETURNING *;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_enrollment_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- Déclenche uniquement lors du passage à 'confirmed' (pas à chaque update)
  if new.status = 'confirmed' and (old.status is null or old.status <> 'confirmed') then
    insert into public.platform_fee_ledger (
      enrollment_id,
      school_id,
      academic_year_id,
      amount,
      status
    ) values (
      new.id,
      new.school_id,
      new.academic_year_id,
      1000, -- 1000 FCFA — montant de base, configurable à terme via school_features
      'due'
    )
    on conflict (enrollment_id) do nothing; -- idempotence : ne crée pas de doublon
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.users (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Utilisateur'),
    nullif(new.email, ''),
    nullif(new.phone, '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = coalesce(public.users.email, excluded.email),
        phone = coalesce(public.users.phone, excluded.phone);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.has_school_role(p_school uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_school_roles
    where user_id = auth.uid() and school_id = p_school
      and is_active and role_code = any (p_roles)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_school_member(p_school uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_school_roles
    where user_id = auth.uid() and school_id = p_school and is_active
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_school_roles usr
    where usr.user_id = auth.uid() and usr.is_active and usr.role_code = 'super_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.mark_fees_collected(p_product_id text, p_tenant_id uuid, p_period_label text, p_paid_amount bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated INTEGER;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin';
  END IF;

  UPDATE public.platform_fee_ledger
  SET status = 'collected', updated_at = NOW()
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND status = 'due'
    AND period_label = p_period_label;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.platform_invoices
  SET status = 'paid', paid_at = NOW(), paid_amount = p_paid_amount, updated_at = NOW()
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND period_label = p_period_label
    AND status = 'pending';

  RETURN v_updated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_billable_event(p_product_id text, p_event_id uuid, p_tenant_id uuid, p_event_type text, p_amount bigint DEFAULT NULL::bigint, p_academic_year_id uuid DEFAULT NULL::uuid, p_period_label text DEFAULT NULL::text, p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, product_id text, event_id uuid, tenant_id uuid, event_type text, amount bigint, status text, period_label text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config RECORD;
  v_amount BIGINT;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin';
  END IF;

  SELECT INTO v_config *
  FROM public.billing_configs
  WHERE product_id = p_product_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: Configuration produit introuvable';
  END IF;

  v_amount := COALESCE(p_amount, v_config.event_amount);

  INSERT INTO public.platform_fee_ledger (
    product_id, event_id, tenant_id, event_type, amount,
    status, academic_year_id, period_label, period_start, period_end
  ) VALUES (
    p_product_id, p_event_id, p_tenant_id, p_event_type, v_amount,
    'due', p_academic_year_id, p_period_label, p_period_start, p_period_end
  )
  ON CONFLICT (product_id, event_id) DO NOTHING;

  RETURN QUERY
  SELECT id, product_id, event_id, tenant_id, event_type, amount, status, period_label, created_at
  FROM public.platform_fee_ledger
  WHERE product_id = p_product_id AND event_id = p_event_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_subscription_payment(p_request_id uuid, p_validator_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, product_id text, tenant_id uuid, amount bigint, status text, validated_by uuid, validated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.subscription_payment_requests%ROWTYPE;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Seul le Super Admin peut rejeter un paiement';
  END IF;

  SELECT * INTO v_request
  FROM public.subscription_payment_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande de paiement introuvable ou déjà traitée';
  END IF;

  UPDATE public.subscription_payment_requests
  SET
    status = 'rejected',
    validated_by = p_validator_id,
    validated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY SELECT
    v_request.id, v_request.product_id, v_request.tenant_id, v_request.amount,
    'rejected'::TEXT, p_validator_id, NOW()::TIMESTAMPTZ;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_seat(p_reservation_id uuid, p_payment_ref text, p_amount bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_res record;
begin
  select * into v_res from public.trouvetou_reservations where id = p_reservation_id for update;
  if not found then return false; end if;
  if v_res.status <> 'pending_payment' then return false; end if;
  
  update public.trouvetou_reservations 
  set status = 'reserved', 
      payment_reference = p_payment_ref, 
      amount_paid = p_amount,
      qr_code_token = encode(gen_random_bytes(16), 'hex'),
      expires_at = now() + interval '72 hours'
  where id = p_reservation_id;
  
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.validate_subscription_payment(p_request_id uuid, p_validator_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, product_id text, tenant_id uuid, amount bigint, status text, validated_by uuid, validated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.subscription_payment_requests%ROWTYPE;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Seul le Super Admin peut valider un paiement';
  END IF;

  SELECT * INTO v_request
  FROM public.subscription_payment_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande de paiement introuvable ou déjà traitée';
  END IF;

  UPDATE public.subscription_payment_requests
  SET
    status = 'validated',
    validated_by = p_validator_id,
    validated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY SELECT
    v_request.id, v_request.product_id, v_request.tenant_id, v_request.amount,
    'validated'::TEXT, p_validator_id, NOW()::TIMESTAMPTZ;
END;
$function$
;

grant delete on table "public"."academic_decisions" to "service_role";

grant insert on table "public"."academic_decisions" to "service_role";

grant references on table "public"."academic_decisions" to "service_role";

grant select on table "public"."academic_decisions" to "service_role";

grant trigger on table "public"."academic_decisions" to "service_role";

grant truncate on table "public"."academic_decisions" to "service_role";

grant update on table "public"."academic_decisions" to "service_role";

grant delete on table "public"."academic_years" to "service_role";

grant insert on table "public"."academic_years" to "service_role";

grant references on table "public"."academic_years" to "service_role";

grant select on table "public"."academic_years" to "service_role";

grant trigger on table "public"."academic_years" to "service_role";

grant truncate on table "public"."academic_years" to "service_role";

grant update on table "public"."academic_years" to "service_role";

grant delete on table "public"."accounting_exports" to "service_role";

grant insert on table "public"."accounting_exports" to "service_role";

grant references on table "public"."accounting_exports" to "service_role";

grant select on table "public"."accounting_exports" to "service_role";

grant trigger on table "public"."accounting_exports" to "service_role";

grant truncate on table "public"."accounting_exports" to "service_role";

grant update on table "public"."accounting_exports" to "service_role";

grant delete on table "public"."attendance_records" to "service_role";

grant insert on table "public"."attendance_records" to "service_role";

grant references on table "public"."attendance_records" to "service_role";

grant select on table "public"."attendance_records" to "service_role";

grant trigger on table "public"."attendance_records" to "service_role";

grant truncate on table "public"."attendance_records" to "service_role";

grant update on table "public"."attendance_records" to "service_role";

grant delete on table "public"."billing_configs" to "service_role";

grant insert on table "public"."billing_configs" to "service_role";

grant references on table "public"."billing_configs" to "service_role";

grant select on table "public"."billing_configs" to "service_role";

grant trigger on table "public"."billing_configs" to "service_role";

grant truncate on table "public"."billing_configs" to "service_role";

grant update on table "public"."billing_configs" to "service_role";

grant delete on table "public"."boarding_subscriptions" to "service_role";

grant insert on table "public"."boarding_subscriptions" to "service_role";

grant references on table "public"."boarding_subscriptions" to "service_role";

grant select on table "public"."boarding_subscriptions" to "service_role";

grant trigger on table "public"."boarding_subscriptions" to "service_role";

grant truncate on table "public"."boarding_subscriptions" to "service_role";

grant update on table "public"."boarding_subscriptions" to "service_role";

grant delete on table "public"."bus_routes" to "service_role";

grant insert on table "public"."bus_routes" to "service_role";

grant references on table "public"."bus_routes" to "service_role";

grant select on table "public"."bus_routes" to "service_role";

grant trigger on table "public"."bus_routes" to "service_role";

grant truncate on table "public"."bus_routes" to "service_role";

grant update on table "public"."bus_routes" to "service_role";

grant delete on table "public"."bus_stops" to "service_role";

grant insert on table "public"."bus_stops" to "service_role";

grant references on table "public"."bus_stops" to "service_role";

grant select on table "public"."bus_stops" to "service_role";

grant trigger on table "public"."bus_stops" to "service_role";

grant truncate on table "public"."bus_stops" to "service_role";

grant update on table "public"."bus_stops" to "service_role";

grant delete on table "public"."canteen_attendance" to "service_role";

grant insert on table "public"."canteen_attendance" to "service_role";

grant references on table "public"."canteen_attendance" to "service_role";

grant select on table "public"."canteen_attendance" to "service_role";

grant trigger on table "public"."canteen_attendance" to "service_role";

grant truncate on table "public"."canteen_attendance" to "service_role";

grant update on table "public"."canteen_attendance" to "service_role";

grant delete on table "public"."canteen_menus" to "service_role";

grant insert on table "public"."canteen_menus" to "service_role";

grant references on table "public"."canteen_menus" to "service_role";

grant select on table "public"."canteen_menus" to "service_role";

grant trigger on table "public"."canteen_menus" to "service_role";

grant truncate on table "public"."canteen_menus" to "service_role";

grant update on table "public"."canteen_menus" to "service_role";

grant delete on table "public"."canteen_subscriptions" to "service_role";

grant insert on table "public"."canteen_subscriptions" to "service_role";

grant references on table "public"."canteen_subscriptions" to "service_role";

grant select on table "public"."canteen_subscriptions" to "service_role";

grant trigger on table "public"."canteen_subscriptions" to "service_role";

grant truncate on table "public"."canteen_subscriptions" to "service_role";

grant update on table "public"."canteen_subscriptions" to "service_role";

grant delete on table "public"."cash_sessions" to "service_role";

grant insert on table "public"."cash_sessions" to "service_role";

grant references on table "public"."cash_sessions" to "service_role";

grant select on table "public"."cash_sessions" to "service_role";

grant trigger on table "public"."cash_sessions" to "service_role";

grant truncate on table "public"."cash_sessions" to "service_role";

grant update on table "public"."cash_sessions" to "service_role";

grant delete on table "public"."class_subject_assignments" to "service_role";

grant insert on table "public"."class_subject_assignments" to "service_role";

grant references on table "public"."class_subject_assignments" to "service_role";

grant select on table "public"."class_subject_assignments" to "service_role";

grant trigger on table "public"."class_subject_assignments" to "service_role";

grant truncate on table "public"."class_subject_assignments" to "service_role";

grant update on table "public"."class_subject_assignments" to "service_role";

grant delete on table "public"."classes" to "service_role";

grant insert on table "public"."classes" to "service_role";

grant references on table "public"."classes" to "service_role";

grant select on table "public"."classes" to "service_role";

grant trigger on table "public"."classes" to "service_role";

grant truncate on table "public"."classes" to "service_role";

grant update on table "public"."classes" to "service_role";

grant delete on table "public"."course_sessions" to "service_role";

grant insert on table "public"."course_sessions" to "service_role";

grant references on table "public"."course_sessions" to "service_role";

grant select on table "public"."course_sessions" to "service_role";

grant trigger on table "public"."course_sessions" to "service_role";

grant truncate on table "public"."course_sessions" to "service_role";

grant update on table "public"."course_sessions" to "service_role";

grant delete on table "public"."detentions" to "service_role";

grant insert on table "public"."detentions" to "service_role";

grant references on table "public"."detentions" to "service_role";

grant select on table "public"."detentions" to "service_role";

grant trigger on table "public"."detentions" to "service_role";

grant truncate on table "public"."detentions" to "service_role";

grant update on table "public"."detentions" to "service_role";

grant delete on table "public"."door_entries" to "service_role";

grant insert on table "public"."door_entries" to "service_role";

grant references on table "public"."door_entries" to "service_role";

grant select on table "public"."door_entries" to "service_role";

grant trigger on table "public"."door_entries" to "service_role";

grant truncate on table "public"."door_entries" to "service_role";

grant update on table "public"."door_entries" to "service_role";

grant delete on table "public"."dorm_rooms" to "service_role";

grant insert on table "public"."dorm_rooms" to "service_role";

grant references on table "public"."dorm_rooms" to "service_role";

grant select on table "public"."dorm_rooms" to "service_role";

grant trigger on table "public"."dorm_rooms" to "service_role";

grant truncate on table "public"."dorm_rooms" to "service_role";

grant update on table "public"."dorm_rooms" to "service_role";

grant delete on table "public"."dormitories" to "service_role";

grant insert on table "public"."dormitories" to "service_role";

grant references on table "public"."dormitories" to "service_role";

grant select on table "public"."dormitories" to "service_role";

grant trigger on table "public"."dormitories" to "service_role";

grant truncate on table "public"."dormitories" to "service_role";

grant update on table "public"."dormitories" to "service_role";

grant delete on table "public"."dropout_alerts" to "service_role";

grant insert on table "public"."dropout_alerts" to "service_role";

grant references on table "public"."dropout_alerts" to "service_role";

grant select on table "public"."dropout_alerts" to "service_role";

grant trigger on table "public"."dropout_alerts" to "service_role";

grant truncate on table "public"."dropout_alerts" to "service_role";

grant update on table "public"."dropout_alerts" to "service_role";

grant delete on table "public"."enrollment_checklist_items" to "service_role";

grant insert on table "public"."enrollment_checklist_items" to "service_role";

grant references on table "public"."enrollment_checklist_items" to "service_role";

grant select on table "public"."enrollment_checklist_items" to "service_role";

grant trigger on table "public"."enrollment_checklist_items" to "service_role";

grant truncate on table "public"."enrollment_checklist_items" to "service_role";

grant update on table "public"."enrollment_checklist_items" to "service_role";

grant delete on table "public"."enrollment_decisions" to "service_role";

grant insert on table "public"."enrollment_decisions" to "service_role";

grant references on table "public"."enrollment_decisions" to "service_role";

grant select on table "public"."enrollment_decisions" to "service_role";

grant trigger on table "public"."enrollment_decisions" to "service_role";

grant truncate on table "public"."enrollment_decisions" to "service_role";

grant update on table "public"."enrollment_decisions" to "service_role";

grant delete on table "public"."enrollments" to "service_role";

grant insert on table "public"."enrollments" to "service_role";

grant references on table "public"."enrollments" to "service_role";

grant select on table "public"."enrollments" to "service_role";

grant trigger on table "public"."enrollments" to "service_role";

grant truncate on table "public"."enrollments" to "service_role";

grant update on table "public"."enrollments" to "service_role";

grant delete on table "public"."family_reliability_scores" to "service_role";

grant insert on table "public"."family_reliability_scores" to "service_role";

grant references on table "public"."family_reliability_scores" to "service_role";

grant select on table "public"."family_reliability_scores" to "service_role";

grant trigger on table "public"."family_reliability_scores" to "service_role";

grant truncate on table "public"."family_reliability_scores" to "service_role";

grant update on table "public"."family_reliability_scores" to "service_role";

grant delete on table "public"."fee_schedules" to "service_role";

grant insert on table "public"."fee_schedules" to "service_role";

grant references on table "public"."fee_schedules" to "service_role";

grant select on table "public"."fee_schedules" to "service_role";

grant trigger on table "public"."fee_schedules" to "service_role";

grant truncate on table "public"."fee_schedules" to "service_role";

grant update on table "public"."fee_schedules" to "service_role";

grant delete on table "public"."financial_profiles" to "service_role";

grant insert on table "public"."financial_profiles" to "service_role";

grant references on table "public"."financial_profiles" to "service_role";

grant select on table "public"."financial_profiles" to "service_role";

grant trigger on table "public"."financial_profiles" to "service_role";

grant truncate on table "public"."financial_profiles" to "service_role";

grant update on table "public"."financial_profiles" to "service_role";

grant delete on table "public"."grade_entries" to "service_role";

grant insert on table "public"."grade_entries" to "service_role";

grant references on table "public"."grade_entries" to "service_role";

grant select on table "public"."grade_entries" to "service_role";

grant trigger on table "public"."grade_entries" to "service_role";

grant truncate on table "public"."grade_entries" to "service_role";

grant update on table "public"."grade_entries" to "service_role";

grant delete on table "public"."grade_levels" to "service_role";

grant insert on table "public"."grade_levels" to "service_role";

grant references on table "public"."grade_levels" to "service_role";

grant select on table "public"."grade_levels" to "service_role";

grant trigger on table "public"."grade_levels" to "service_role";

grant truncate on table "public"."grade_levels" to "service_role";

grant update on table "public"."grade_levels" to "service_role";

grant delete on table "public"."guardians" to "service_role";

grant insert on table "public"."guardians" to "service_role";

grant references on table "public"."guardians" to "service_role";

grant select on table "public"."guardians" to "service_role";

grant trigger on table "public"."guardians" to "service_role";

grant truncate on table "public"."guardians" to "service_role";

grant update on table "public"."guardians" to "service_role";

grant delete on table "public"."homeworks" to "service_role";

grant insert on table "public"."homeworks" to "service_role";

grant references on table "public"."homeworks" to "service_role";

grant select on table "public"."homeworks" to "service_role";

grant trigger on table "public"."homeworks" to "service_role";

grant truncate on table "public"."homeworks" to "service_role";

grant update on table "public"."homeworks" to "service_role";

grant delete on table "public"."moratoriums" to "service_role";

grant insert on table "public"."moratoriums" to "service_role";

grant references on table "public"."moratoriums" to "service_role";

grant select on table "public"."moratoriums" to "service_role";

grant trigger on table "public"."moratoriums" to "service_role";

grant truncate on table "public"."moratoriums" to "service_role";

grant update on table "public"."moratoriums" to "service_role";

grant delete on table "public"."notification_outbox" to "service_role";

grant insert on table "public"."notification_outbox" to "service_role";

grant references on table "public"."notification_outbox" to "service_role";

grant select on table "public"."notification_outbox" to "service_role";

grant trigger on table "public"."notification_outbox" to "service_role";

grant truncate on table "public"."notification_outbox" to "service_role";

grant update on table "public"."notification_outbox" to "service_role";

grant delete on table "public"."payment_reminders" to "service_role";

grant insert on table "public"."payment_reminders" to "service_role";

grant references on table "public"."payment_reminders" to "service_role";

grant select on table "public"."payment_reminders" to "service_role";

grant trigger on table "public"."payment_reminders" to "service_role";

grant truncate on table "public"."payment_reminders" to "service_role";

grant update on table "public"."payment_reminders" to "service_role";

grant delete on table "public"."payments" to "service_role";

grant insert on table "public"."payments" to "service_role";

grant references on table "public"."payments" to "service_role";

grant select on table "public"."payments" to "service_role";

grant trigger on table "public"."payments" to "service_role";

grant truncate on table "public"."payments" to "service_role";

grant update on table "public"."payments" to "service_role";

grant delete on table "public"."platform_fee_ledger" to "service_role";

grant insert on table "public"."platform_fee_ledger" to "service_role";

grant references on table "public"."platform_fee_ledger" to "service_role";

grant select on table "public"."platform_fee_ledger" to "service_role";

grant trigger on table "public"."platform_fee_ledger" to "service_role";

grant truncate on table "public"."platform_fee_ledger" to "service_role";

grant update on table "public"."platform_fee_ledger" to "service_role";

grant delete on table "public"."platform_invoices" to "service_role";

grant insert on table "public"."platform_invoices" to "service_role";

grant references on table "public"."platform_invoices" to "service_role";

grant select on table "public"."platform_invoices" to "service_role";

grant trigger on table "public"."platform_invoices" to "service_role";

grant truncate on table "public"."platform_invoices" to "service_role";

grant update on table "public"."platform_invoices" to "service_role";

grant delete on table "public"."pre_enrollments" to "service_role";

grant insert on table "public"."pre_enrollments" to "service_role";

grant references on table "public"."pre_enrollments" to "service_role";

grant select on table "public"."pre_enrollments" to "service_role";

grant trigger on table "public"."pre_enrollments" to "service_role";

grant truncate on table "public"."pre_enrollments" to "service_role";

grant update on table "public"."pre_enrollments" to "service_role";

grant delete on table "public"."receipts" to "service_role";

grant insert on table "public"."receipts" to "service_role";

grant references on table "public"."receipts" to "service_role";

grant select on table "public"."receipts" to "service_role";

grant trigger on table "public"."receipts" to "service_role";

grant truncate on table "public"."receipts" to "service_role";

grant update on table "public"."receipts" to "service_role";

grant delete on table "public"."report_cards" to "service_role";

grant insert on table "public"."report_cards" to "service_role";

grant references on table "public"."report_cards" to "service_role";

grant select on table "public"."report_cards" to "service_role";

grant trigger on table "public"."report_cards" to "service_role";

grant truncate on table "public"."report_cards" to "service_role";

grant update on table "public"."report_cards" to "service_role";

grant delete on table "public"."required_documents" to "service_role";

grant insert on table "public"."required_documents" to "service_role";

grant references on table "public"."required_documents" to "service_role";

grant select on table "public"."required_documents" to "service_role";

grant trigger on table "public"."required_documents" to "service_role";

grant truncate on table "public"."required_documents" to "service_role";

grant update on table "public"."required_documents" to "service_role";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."school_features" to "service_role";

grant insert on table "public"."school_features" to "service_role";

grant references on table "public"."school_features" to "service_role";

grant select on table "public"."school_features" to "service_role";

grant trigger on table "public"."school_features" to "service_role";

grant truncate on table "public"."school_features" to "service_role";

grant update on table "public"."school_features" to "service_role";

grant delete on table "public"."school_payment_methods" to "service_role";

grant insert on table "public"."school_payment_methods" to "service_role";

grant references on table "public"."school_payment_methods" to "service_role";

grant select on table "public"."school_payment_methods" to "service_role";

grant trigger on table "public"."school_payment_methods" to "service_role";

grant truncate on table "public"."school_payment_methods" to "service_role";

grant update on table "public"."school_payment_methods" to "service_role";

grant delete on table "public"."schools" to "service_role";

grant insert on table "public"."schools" to "service_role";

grant references on table "public"."schools" to "service_role";

grant select on table "public"."schools" to "service_role";

grant trigger on table "public"."schools" to "service_role";

grant truncate on table "public"."schools" to "service_role";

grant update on table "public"."schools" to "service_role";

grant delete on table "public"."student_qr_codes" to "service_role";

grant insert on table "public"."student_qr_codes" to "service_role";

grant references on table "public"."student_qr_codes" to "service_role";

grant select on table "public"."student_qr_codes" to "service_role";

grant trigger on table "public"."student_qr_codes" to "service_role";

grant truncate on table "public"."student_qr_codes" to "service_role";

grant update on table "public"."student_qr_codes" to "service_role";

grant delete on table "public"."students" to "service_role";

grant insert on table "public"."students" to "service_role";

grant references on table "public"."students" to "service_role";

grant select on table "public"."students" to "service_role";

grant trigger on table "public"."students" to "service_role";

grant truncate on table "public"."students" to "service_role";

grant update on table "public"."students" to "service_role";

grant delete on table "public"."subjects" to "service_role";

grant insert on table "public"."subjects" to "service_role";

grant references on table "public"."subjects" to "service_role";

grant select on table "public"."subjects" to "service_role";

grant trigger on table "public"."subjects" to "service_role";

grant truncate on table "public"."subjects" to "service_role";

grant update on table "public"."subjects" to "service_role";

grant delete on table "public"."subscription_payment_requests" to "service_role";

grant insert on table "public"."subscription_payment_requests" to "service_role";

grant references on table "public"."subscription_payment_requests" to "service_role";

grant select on table "public"."subscription_payment_requests" to "service_role";

grant trigger on table "public"."subscription_payment_requests" to "service_role";

grant truncate on table "public"."subscription_payment_requests" to "service_role";

grant update on table "public"."subscription_payment_requests" to "service_role";

grant delete on table "public"."transport_subscriptions" to "service_role";

grant insert on table "public"."transport_subscriptions" to "service_role";

grant references on table "public"."transport_subscriptions" to "service_role";

grant select on table "public"."transport_subscriptions" to "service_role";

grant trigger on table "public"."transport_subscriptions" to "service_role";

grant truncate on table "public"."transport_subscriptions" to "service_role";

grant update on table "public"."transport_subscriptions" to "service_role";

grant delete on table "public"."trouvetou_ads" to "service_role";

grant insert on table "public"."trouvetou_ads" to "service_role";

grant references on table "public"."trouvetou_ads" to "service_role";

grant select on table "public"."trouvetou_ads" to "service_role";

grant trigger on table "public"."trouvetou_ads" to "service_role";

grant truncate on table "public"."trouvetou_ads" to "service_role";

grant update on table "public"."trouvetou_ads" to "service_role";

grant delete on table "public"."trouvetou_reservations" to "service_role";

grant insert on table "public"."trouvetou_reservations" to "service_role";

grant references on table "public"."trouvetou_reservations" to "service_role";

grant select on table "public"."trouvetou_reservations" to "service_role";

grant trigger on table "public"."trouvetou_reservations" to "service_role";

grant truncate on table "public"."trouvetou_reservations" to "service_role";

grant update on table "public"."trouvetou_reservations" to "service_role";

grant delete on table "public"."user_school_roles" to "service_role";

grant insert on table "public"."user_school_roles" to "service_role";

grant references on table "public"."user_school_roles" to "service_role";

grant select on table "public"."user_school_roles" to "service_role";

grant trigger on table "public"."user_school_roles" to "service_role";

grant truncate on table "public"."user_school_roles" to "service_role";

grant update on table "public"."user_school_roles" to "service_role";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant delete on table "public"."year_rollover_logs" to "service_role";

grant insert on table "public"."year_rollover_logs" to "service_role";

grant references on table "public"."year_rollover_logs" to "service_role";

grant select on table "public"."year_rollover_logs" to "service_role";

grant trigger on table "public"."year_rollover_logs" to "service_role";

grant truncate on table "public"."year_rollover_logs" to "service_role";

grant update on table "public"."year_rollover_logs" to "service_role";


  create policy "academic_decisions_direction_write"
  on "public"."academic_decisions"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "academic_decisions_member_read"
  on "public"."academic_decisions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "academic_years_direction_write"
  on "public"."academic_years"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "academic_years_member_read"
  on "public"."academic_years"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "accounting_exports_compta_write"
  on "public"."accounting_exports"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['compta'::text, 'direction'::text, 'super_admin'::text])));



  create policy "accounting_exports_member_read"
  on "public"."accounting_exports"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "attendance_records_teacher_read"
  on "public"."attendance_records"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR (recorded_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.course_sessions cs
  WHERE ((cs.id = attendance_records.course_session_id) AND (cs.teacher_id = auth.uid()))))));



  create policy "attendance_records_write"
  on "public"."attendance_records"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text, 'surveillance'::text]) OR (recorded_by = auth.uid())));



  create policy "billing_configs_delete"
  on "public"."billing_configs"
  as permissive
  for delete
  to public
using (public.is_super_admin());



  create policy "billing_configs_insert"
  on "public"."billing_configs"
  as permissive
  for insert
  to public
with check (public.is_super_admin());



  create policy "billing_configs_read"
  on "public"."billing_configs"
  as permissive
  for select
  to public
using (public.is_super_admin());



  create policy "billing_configs_update"
  on "public"."billing_configs"
  as permissive
  for update
  to public
using (public.is_super_admin())
with check (public.is_super_admin());



  create policy "boarding_subs_direction_write"
  on "public"."boarding_subscriptions"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'compta'::text])));



  create policy "boarding_subs_member_read"
  on "public"."boarding_subscriptions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "bus_routes_direction_write"
  on "public"."bus_routes"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text])));



  create policy "bus_routes_member_read"
  on "public"."bus_routes"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "bus_stops_direction_write"
  on "public"."bus_stops"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text])));



  create policy "bus_stops_member_read"
  on "public"."bus_stops"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "canteen_att_member_read"
  on "public"."canteen_attendance"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "canteen_att_staff_write"
  on "public"."canteen_attendance"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'surveillance'::text])));



  create policy "canteen_menus_direction_write"
  on "public"."canteen_menus"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text])));



  create policy "canteen_menus_member_read"
  on "public"."canteen_menus"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "canteen_subs_direction_write"
  on "public"."canteen_subscriptions"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'compta'::text])));



  create policy "canteen_subs_member_read"
  on "public"."canteen_subscriptions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "cash_sessions_caisse_write"
  on "public"."cash_sessions"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['caisse'::text, 'direction'::text, 'compta'::text, 'super_admin'::text])));



  create policy "cash_sessions_member_read"
  on "public"."cash_sessions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "csa_direction_write"
  on "public"."class_subject_assignments"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "csa_member_read"
  on "public"."class_subject_assignments"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "classes_direction_write"
  on "public"."classes"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "classes_member_read"
  on "public"."classes"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "course_sessions_direction_write"
  on "public"."course_sessions"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "course_sessions_teacher_read"
  on "public"."course_sessions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR (teacher_id = auth.uid())));



  create policy "detentions_member_read"
  on "public"."detentions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR (enrollment_id IN ( SELECT e.id
   FROM public.enrollments e
  WHERE (e.school_id = ( SELECT user_school_roles.school_id
           FROM public.user_school_roles
          WHERE ((user_school_roles.user_id = auth.uid()) AND user_school_roles.is_active)
         LIMIT 1))))));



  create policy "door_entries_surveillance_read"
  on "public"."door_entries"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR public.has_school_role(school_id, ARRAY['surveillance'::text]) OR (enrollment_id IN ( SELECT e.id
   FROM public.enrollments e
  WHERE (e.school_id = ( SELECT user_school_roles.school_id
           FROM public.user_school_roles
          WHERE ((user_school_roles.user_id = auth.uid()) AND user_school_roles.is_active)
         LIMIT 1))))));



  create policy "door_entries_write"
  on "public"."door_entries"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['surveillance'::text, 'direction'::text, 'super_admin'::text])));



  create policy "dorm_rooms_direction_write"
  on "public"."dorm_rooms"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text])));



  create policy "dorm_rooms_member_read"
  on "public"."dorm_rooms"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "dormitories_direction_write"
  on "public"."dormitories"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text])));



  create policy "dormitories_member_read"
  on "public"."dormitories"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "dropout_alerts_member_read"
  on "public"."dropout_alerts"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "dropout_alerts_write"
  on "public"."dropout_alerts"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'surveillance'::text, 'super_admin'::text])));



  create policy "enrollment_checklist_items_delete"
  on "public"."enrollment_checklist_items"
  as permissive
  for delete
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "enrollment_checklist_items_read"
  on "public"."enrollment_checklist_items"
  as permissive
  for select
  to public
using (((deleted_at IS NULL) AND (public.is_super_admin() OR public.is_school_member(school_id))));



  create policy "enrollment_checklist_items_update"
  on "public"."enrollment_checklist_items"
  as permissive
  for update
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])))
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "enrollment_checklist_items_write"
  on "public"."enrollment_checklist_items"
  as permissive
  for insert
  to public
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "enrollment_decisions_direction_read"
  on "public"."enrollment_decisions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "enrollment_decisions_direction_update"
  on "public"."enrollment_decisions"
  as permissive
  for update
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])))
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "enrollment_decisions_direction_write"
  on "public"."enrollment_decisions"
  as permissive
  for insert
  to public
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "enrollments_member_read"
  on "public"."enrollments"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "enrollments_write"
  on "public"."enrollments"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "family_reliability_scores_member_read"
  on "public"."family_reliability_scores"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "family_reliability_scores_write"
  on "public"."family_reliability_scores"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'compta'::text, 'super_admin'::text])));



  create policy "fee_schedules_direction_write"
  on "public"."fee_schedules"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "fee_schedules_member_read"
  on "public"."fee_schedules"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "financial_profiles_direction_write"
  on "public"."financial_profiles"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "financial_profiles_member_read"
  on "public"."financial_profiles"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "grade_entries_teacher_read"
  on "public"."grade_entries"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR (created_by = auth.uid())));



  create policy "grade_entries_write"
  on "public"."grade_entries"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text, 'professeur'::text]) OR (created_by = auth.uid())));



  create policy "grade_levels_direction_write"
  on "public"."grade_levels"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "grade_levels_member_read"
  on "public"."grade_levels"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "guardians_member_read"
  on "public"."guardians"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.enrollments e
  WHERE ((e.guardian_id = guardians.id) AND (e.school_id = ( SELECT user_school_roles.school_id
           FROM public.user_school_roles
          WHERE ((user_school_roles.user_id = auth.uid()) AND user_school_roles.is_active)
         LIMIT 1)))))));



  create policy "guardians_write"
  on "public"."guardians"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.user_school_roles usr
  WHERE ((usr.user_id = auth.uid()) AND usr.is_active AND (usr.role_code = ANY (ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])))))));



  create policy "homeworks_teacher_read"
  on "public"."homeworks"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR (teacher_id = auth.uid())));



  create policy "homeworks_teacher_write"
  on "public"."homeworks"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text, 'professeur'::text]) OR (teacher_id = auth.uid())));



  create policy "moratoriums_member_read"
  on "public"."moratoriums"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "moratoriums_write"
  on "public"."moratoriums"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "notification_outbox_member_read"
  on "public"."notification_outbox"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "notification_outbox_write"
  on "public"."notification_outbox"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'compta'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "payment_reminders_member_read"
  on "public"."payment_reminders"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "payment_reminders_write"
  on "public"."payment_reminders"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'caisse'::text, 'super_admin'::text])));



  create policy "payments_caisse_write"
  on "public"."payments"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['caisse'::text, 'direction'::text, 'compta'::text, 'super_admin'::text])));



  create policy "payments_member_read"
  on "public"."payments"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "platform_fee_ledger_super_admin"
  on "public"."platform_fee_ledger"
  as permissive
  for all
  to public
using (public.is_super_admin());



  create policy "platform_invoices_super_admin"
  on "public"."platform_invoices"
  as permissive
  for all
  to public
using (public.is_super_admin());



  create policy "pre_enrollments_member_read"
  on "public"."pre_enrollments"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "pre_enrollments_write"
  on "public"."pre_enrollments"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "receipts_caisse_write"
  on "public"."receipts"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['caisse'::text, 'direction'::text, 'compta'::text, 'super_admin'::text])));



  create policy "receipts_member_read"
  on "public"."receipts"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "report_cards_direction_write"
  on "public"."report_cards"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "report_cards_member_read"
  on "public"."report_cards"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "required_documents_delete"
  on "public"."required_documents"
  as permissive
  for delete
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "required_documents_read"
  on "public"."required_documents"
  as permissive
  for select
  to public
using (((deleted_at IS NULL) AND (public.is_super_admin() OR public.is_school_member(school_id))));



  create policy "required_documents_update"
  on "public"."required_documents"
  as permissive
  for update
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])))
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "required_documents_write"
  on "public"."required_documents"
  as permissive
  for insert
  to public
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "roles_read"
  on "public"."roles"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "features_direction_write"
  on "public"."school_features"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text]));



  create policy "features_member_read"
  on "public"."school_features"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "school_payment_methods_delete"
  on "public"."school_payment_methods"
  as permissive
  for delete
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "school_payment_methods_read"
  on "public"."school_payment_methods"
  as permissive
  for select
  to public
using (((deleted_at IS NULL) AND (public.is_super_admin() OR public.is_school_member(school_id))));



  create policy "school_payment_methods_update"
  on "public"."school_payment_methods"
  as permissive
  for update
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])))
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "school_payment_methods_write"
  on "public"."school_payment_methods"
  as permissive
  for insert
  to public
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "schools_direction_update"
  on "public"."schools"
  as permissive
  for update
  to public
using (public.has_school_role(id, ARRAY['direction'::text]));



  create policy "schools_member_read"
  on "public"."schools"
  as permissive
  for select
  to public
using (((deleted_at IS NULL) AND (public.is_super_admin() OR public.is_school_member(id))));



  create policy "student_qr_codes_member_read"
  on "public"."student_qr_codes"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id) OR (EXISTS ( SELECT 1
   FROM public.enrollments e
  WHERE ((e.id = student_qr_codes.enrollment_id) AND (e.school_id = ( SELECT user_school_roles.school_id
           FROM public.user_school_roles
          WHERE ((user_school_roles.user_id = auth.uid()) AND user_school_roles.is_active)
         LIMIT 1)))))));



  create policy "student_qr_codes_write"
  on "public"."student_qr_codes"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "students_member_read"
  on "public"."students"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "students_write"
  on "public"."students"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "subjects_direction_write"
  on "public"."subjects"
  as permissive
  for all
  to public
using (public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text]));



  create policy "subjects_member_read"
  on "public"."subjects"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "spr_member_insert"
  on "public"."subscription_payment_requests"
  as permissive
  for insert
  to authenticated
with check ((tenant_id IN ( SELECT user_school_roles.school_id
   FROM public.user_school_roles
  WHERE ((user_school_roles.user_id = auth.uid()) AND user_school_roles.is_active))));



  create policy "spr_member_read"
  on "public"."subscription_payment_requests"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (tenant_id IN ( SELECT user_school_roles.school_id
   FROM public.user_school_roles
  WHERE ((user_school_roles.user_id = auth.uid()) AND user_school_roles.is_active)))));



  create policy "transport_subs_direction_write"
  on "public"."transport_subscriptions"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'compta'::text])));



  create policy "transport_subs_member_read"
  on "public"."transport_subscriptions"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "trouvetou_ads_member_read"
  on "public"."trouvetou_ads"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "trouvetou_ads_write"
  on "public"."trouvetou_ads"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "trouvetou_reservations_member_read"
  on "public"."trouvetou_reservations"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "trouvetou_reservations_write"
  on "public"."trouvetou_reservations"
  as permissive
  for all
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'secretariat'::text, 'super_admin'::text])));



  create policy "usr_read"
  on "public"."user_school_roles"
  as permissive
  for select
  to public
using (((user_id = auth.uid()) OR public.is_super_admin() OR public.is_school_member(school_id)));



  create policy "users_self_read"
  on "public"."users"
  as permissive
  for select
  to public
using (((id = auth.uid()) OR public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM (public.user_school_roles mine
     JOIN public.user_school_roles theirs ON ((theirs.school_id = mine.school_id)))
  WHERE ((mine.user_id = auth.uid()) AND (theirs.user_id = users.id) AND mine.is_active AND theirs.is_active)))));



  create policy "users_self_update"
  on "public"."users"
  as permissive
  for update
  to public
using ((id = auth.uid()));



  create policy "rollover_logs_direction_read"
  on "public"."year_rollover_logs"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));



  create policy "rollover_logs_direction_write"
  on "public"."year_rollover_logs"
  as permissive
  for insert
  to public
with check ((public.is_super_admin() OR public.has_school_role(school_id, ARRAY['direction'::text, 'super_admin'::text])));


CREATE TRIGGER trg_academic_decisions_updated_at BEFORE UPDATE ON public.academic_decisions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_academic_years_updated_at BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_accounting_exports_updated_at BEFORE UPDATE ON public.accounting_exports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_attendance_records_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_billing_configs_updated BEFORE UPDATE ON public.billing_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_boarding_subs_updated_at BEFORE UPDATE ON public.boarding_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_bus_routes_updated_at BEFORE UPDATE ON public.bus_routes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_bus_stops_updated_at BEFORE UPDATE ON public.bus_stops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_canteen_att_updated_at BEFORE UPDATE ON public.canteen_attendance FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_canteen_menus_updated_at BEFORE UPDATE ON public.canteen_menus FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_canteen_subs_updated_at BEFORE UPDATE ON public.canteen_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_cash_sessions_updated_at BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_class_subject_assignments_updated_at BEFORE UPDATE ON public.class_subject_assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_course_sessions_updated_at BEFORE UPDATE ON public.course_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_detentions_updated_at BEFORE UPDATE ON public.detentions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_door_entries_updated_at BEFORE UPDATE ON public.door_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_dorm_rooms_updated_at BEFORE UPDATE ON public.dorm_rooms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_dormitories_updated_at BEFORE UPDATE ON public.dormitories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_dropout_alerts_updated_at BEFORE UPDATE ON public.dropout_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_enrollment_checklist_items_updated_at BEFORE UPDATE ON public.enrollment_checklist_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_enrollment_decisions_updated_at BEFORE UPDATE ON public.enrollment_decisions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_enrollment_confirmed_fee AFTER INSERT OR UPDATE OF status ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.handle_enrollment_confirmed();

CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_family_reliability_scores_updated_at BEFORE UPDATE ON public.family_reliability_scores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_fee_schedules_updated_at BEFORE UPDATE ON public.fee_schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_financial_profiles_updated_at BEFORE UPDATE ON public.financial_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_grade_entries_updated_at BEFORE UPDATE ON public.grade_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_grade_levels_updated_at BEFORE UPDATE ON public.grade_levels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_guardians_updated_at BEFORE UPDATE ON public.guardians FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_homeworks_updated_at BEFORE UPDATE ON public.homeworks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_moratoriums_updated_at BEFORE UPDATE ON public.moratoriums FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_notification_outbox_updated_at BEFORE UPDATE ON public.notification_outbox FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_payment_reminders_updated_at BEFORE UPDATE ON public.payment_reminders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_platform_fee_ledger_updated_at BEFORE UPDATE ON public.platform_fee_ledger FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_platform_invoices_updated_at BEFORE UPDATE ON public.platform_invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_pre_enrollments_updated_at BEFORE UPDATE ON public.pre_enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_report_cards_updated_at BEFORE UPDATE ON public.report_cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_required_documents_updated_at BEFORE UPDATE ON public.required_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_school_payment_methods_updated_at BEFORE UPDATE ON public.school_payment_methods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_student_qr_codes_updated_at BEFORE UPDATE ON public.student_qr_codes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_spr_updated BEFORE UPDATE ON public.subscription_payment_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_transport_subs_updated_at BEFORE UPDATE ON public.transport_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_trouvetou_ads_updated_at BEFORE UPDATE ON public.trouvetou_ads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_trouvetou_reservations_updated_at BEFORE UPDATE ON public.trouvetou_reservations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


