-- ============================================================================
-- 20260917050000 — Champs guichet sur pre_enrollments
-- Nom tuteur, n acte de naissance, moyen de paiement, pieces / fournitures.
-- ============================================================================

alter table public.pre_enrollments
  add column if not exists guardian_name text,
  add column if not exists birth_certificate_number text,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists accepted_checklist jsonb not null default '[]'::jsonb,
  add column if not exists provided_documents jsonb not null default '[]'::jsonb;

alter table public.pre_enrollments
  drop constraint if exists pre_enrollments_payment_method_check;

alter table public.pre_enrollments
  add constraint pre_enrollments_payment_method_check
  check (
    payment_method is null
    or payment_method in ('cash', 'mobile_money', 'check', 'transfer')
  );
