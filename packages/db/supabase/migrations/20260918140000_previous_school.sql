-- ============================================================================
-- 20260918140000 — Scolarité antérieure de l'élève (pré-inscription)
--
-- L'élève venant d'un autre établissement : nom de l'école précédente et
-- dernière classe fréquentée. Les deux colonnes restent NULL quand la case
-- « Première scolarisation » est cochée (élève jamais scolarisé).
--
-- Stockage : pre_enrollments pendant les 72h d'attente, puis
-- validatePreEnrollment transporte vers la fiche students à la validation
-- au guichet.
-- Idempotent : add column if not exists.
-- ============================================================================

alter table public.pre_enrollments
  add column if not exists previous_school text,
  add column if not exists previous_class text;

alter table public.students
  add column if not exists previous_school text,
  add column if not exists previous_class text;
