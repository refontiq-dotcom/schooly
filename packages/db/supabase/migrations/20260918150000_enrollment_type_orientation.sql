-- ============================================================================
-- 20260918150000 — Type d'inscription & orientation État (pré-inscription)
--
-- 1. enrollment_type : nouvelle inscription vs réinscription (élève déjà
--    connu de l'établissement). Sur la pré-inscription, un matricule
--    facultatif (previous_matricule) permet au guichet de retrouver la fiche
--    existante et de réinscrire SANS créer de doublon d'élève.
-- 2. state_orientation : orienté par l'État (affectation DECO/notification)
--    ou non orienté — + orientation_number (n° de notification, facultatif).
--
-- Transport : validatePreEnrollment recopie enrollment_type / state_orientation
-- / orientation_number sur enrollments (traçabilité de l'origine par année).
-- Idempotent : add column if not exists.
-- ============================================================================

alter table public.pre_enrollments
  add column if not exists enrollment_type text
    check (enrollment_type in ('nouvelle', 'reinscription')),
  add column if not exists state_orientation text
    check (state_orientation in ('oriente_etat', 'non_oriente')),
  add column if not exists orientation_number text,
  add column if not exists previous_matricule text;

alter table public.enrollments
  add column if not exists enrollment_type text
    check (enrollment_type in ('nouvelle', 'reinscription')),
  add column if not exists state_orientation text
    check (state_orientation in ('oriente_etat', 'non_oriente')),
  add column if not exists orientation_number text;
