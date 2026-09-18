-- ============================================================================
-- 20260918130000 — Lien tuteur/élève + contact d'urgence (pré-inscription)
--
-- Le formulaire public de pré-inscription demande désormais :
--   1. le lien du parent/tuteur avec l'élève (Père, Mère, Tuteur légal,
--      Autre parent, ou texte libre si « Autre ») ;
--   2. qui appeler en cas d'urgence (nom + téléphone), pré-rempli avec le
--      parent si c'est la même personne.
--
-- Stockage : les 3 valeurs vivent dans pre_enrollments pendant les 72h
-- d'attente, puis completeCounterEnrollment les transporte vers la fiche
-- guardians (relation, emergency_contact_*) à la validation au guichet.
-- Idempotent : add column if not exists.
-- ============================================================================

alter table public.pre_enrollments
  add column if not exists guardian_relation text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

alter table public.guardians
  add column if not exists relation text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
