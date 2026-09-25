-- 20260926000000 — S3 : recherche d'annuaire en base (pg_trgm)
--
-- Le ⌘K rapatriait l'école entière (élèves, tuteurs, inscriptions,
-- pré-inscriptions) en un snapshot pour classer côté client. Deux défauts :
-- le payload grossit avec l'école, et S2 a dû borner le snapshot — donc la
-- recherche locale perdait en couverture.
--
-- Ici, Postgres fait le FILTRAGE (index trigram) et le serveur fait le
-- CLASSEMENT sur une poignée de lignes, en réutilisant le moteur de ranking
-- existant. Le classement ne change donc pas pour l'utilisateur, mais le
-- trafic et la mémoire, si.
--
-- Les index sont « partiels » sur `deleted_at is null` : la recherche ne doit
-- jamais remonter une ligne supprimée, et l'index reste plus petit.
--
-- `similarity()` sert au tri de pertinence côté base ; le classement fin reste
-- côté serveur (il connaît la grammaire de tokens, les fautes de frappe et le
-- format des téléphones, que `similarity()` n'a pas).
--
-- Idempotent : IF NOT EXISTS sur l'extension et les index.

create extension if not exists pg_trgm;

-- Élèves : recherche sur le nom surtout, le prénom en complément.
create index if not exists idx_students_last_name_trgm
  on public.students using gin (last_name gin_trgm_ops)
  where deleted_at is null;
create index if not exists idx_students_first_name_trgm
  on public.students using gin (first_name gin_trgm_ops)
  where deleted_at is null;

-- Tuteurs : nom complet puis téléphone. Le téléphone est aussi indexé en btree
-- : la recherche par numéro est une égalité, pas un trigram.
create index if not exists idx_guardians_full_name_trgm
  on public.guardians using gin (full_name gin_trgm_ops)
  where deleted_at is null;
create index if not exists idx_guardians_phone
  on public.guardians (phone)
  where deleted_at is null;

-- Inscriptions : le matricule est ce qu'un parent saisit en premier.
create index if not exists idx_enrollments_matricule_trgm
  on public.enrollments using gin (matricule gin_trgm_ops)
  where deleted_at is null;

-- Pré-inscriptions : nom, prénom et code public.
create index if not exists idx_pre_enrollments_last_name_trgm
  on public.pre_enrollments using gin (last_name gin_trgm_ops)
  where deleted_at is null;
create index if not exists idx_pre_enrollments_first_name_trgm
  on public.pre_enrollments using gin (first_name gin_trgm_ops)
  where deleted_at is null;
create index if not exists idx_pre_enrollments_code
  on public.pre_enrollments (code)
  where deleted_at is null;
