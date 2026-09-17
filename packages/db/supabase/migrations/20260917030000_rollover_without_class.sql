-- ============================================================================
-- 20260917030000 — Journal de bascule : élèves réinscrits sans classe
--
-- Constat d'audit : `executeRollover` ne renseignait jamais `class_id` sur les
-- nouvelles inscriptions. Or la classe est l'objet d'école réutilisé d'année en
-- année (pas d'`academic_year_id` sur `classes`), et les fonctions de classe
-- (moyennes de classe, appel) lisent les inscriptions PAR `class_id` : chaque
-- élève basculé devenait invisible de ces écrans jusqu'à une réaffectation
-- manuelle, élève par élève.
--
-- Le code affecte désormais la classe de destination (parallèle « A » → « A »
-- si non ambigu, sinon la seule classe du niveau). Quand l'affectation reste
-- ambiguë, l'élève est réinscrit SANS classe et compté ici : la direction sait
-- exactement combien d'élèves restent à placer, au lieu de le découvrir en
-- préparant l'appel.
--
-- Idempotent : `add column if not exists`.
-- ============================================================================

alter table public.year_rollover_logs
  add column if not exists students_without_class integer not null default 0;

comment on column public.year_rollover_logs.students_without_class is
  'Élèves réinscrits sans classe (appariement de parallèle ambigu) — à affecter manuellement.';
