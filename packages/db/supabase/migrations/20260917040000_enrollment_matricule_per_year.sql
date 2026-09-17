-- ============================================================================
-- 20260917040000 — Matricule d'État : unique par année, pas par inscription
--
-- Le matricule est attribué par l'État à l'élève. Il doit être recopié à
-- chaque réinscription (bascule), pas régénéré. Les contraintes UNIQUE
-- globales (`enrollments.matricule` et `(school_id, matricule)`) interdisaient
-- deux lignes vivantes avec le même matricule — donc toute bascule cassait.
--
-- Invariant : un matricule n'apparaît qu'UNE fois par (école, année).
-- Idempotent : drop if exists + create if not exists.
-- ============================================================================

alter table public.enrollments
  drop constraint if exists enrollments_matricule_key;

alter table public.enrollments
  drop constraint if exists enrollments_school_id_matricule_key;

create unique index if not exists enrollments_school_year_matricule_unique
  on public.enrollments (school_id, academic_year_id, matricule)
  where deleted_at is null and matricule is not null;
