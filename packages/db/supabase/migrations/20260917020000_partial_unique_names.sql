-- ============================================================================
-- 20260917020000 — Référentiel : une ligne supprimée ne réserve plus son nom
--
-- Constat d'audit : les contraintes d'unicité du référentiel structurel portent
-- sur TOUTES les lignes, y compris celles supprimées logiquement (deleted_at
-- non nul). Conséquence : après suppression logique d'une classe « 6ème A »,
-- impossible de recréer une classe de ce nom — l'insert échoue sur une
-- contrainte visant une ligne que l'utilisateur ne voit plus. C'est l'inverse
-- du principe « toute suppression est un soft-delete tracé » : on subit la trace
-- sans pouvoir la contourner.
--
-- Correctif : ces contraintes deviennent des index uniques PARTIELS
-- (`where deleted_at is null`). Sémantique inchangée pour les lignes vivantes.
--
-- Aucune réparation de données n'est nécessaire : l'ancienne contrainte, plus
-- stricte (toutes lignes confondues), garantit déjà l'absence de doublon, donc
-- l'index partiel ne peut pas échouer à la création.
--
-- Idempotent : `drop constraint if exists` + `create index if not exists`.
-- ============================================================================

-- academic_years (school_id, label)
alter table public.academic_years
  drop constraint if exists academic_years_school_id_label_key;
create unique index if not exists academic_years_school_label_unique
  on public.academic_years (school_id, label)
  where deleted_at is null;

-- grade_levels (school_id, name)
alter table public.grade_levels
  drop constraint if exists grade_levels_school_id_name_key;
create unique index if not exists grade_levels_school_name_unique
  on public.grade_levels (school_id, name)
  where deleted_at is null;

-- classes (school_id, name)
alter table public.classes
  drop constraint if exists classes_school_id_name_key;
create unique index if not exists classes_school_name_unique
  on public.classes (school_id, name)
  where deleted_at is null;

-- subjects (school_id, name)
alter table public.subjects
  drop constraint if exists subjects_school_id_name_key;
create unique index if not exists subjects_school_name_unique
  on public.subjects (school_id, name)
  where deleted_at is null;

-- class_subject_assignments (school_id, class_id, subject_id)
alter table public.class_subject_assignments
  drop constraint if exists class_subject_assignments_school_id_class_id_subject_id_key;
create unique index if not exists csa_school_class_subject_unique
  on public.class_subject_assignments (school_id, class_id, subject_id)
  where deleted_at is null;
