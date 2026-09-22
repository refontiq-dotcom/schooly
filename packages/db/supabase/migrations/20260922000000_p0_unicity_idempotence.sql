-- 20260922000000 — P0-3 : unicité réelle + idempotence paiements
--
-- Contexte : les contrôles d'unicité applicatifs (SELECT puis INSERT) ne
-- tiennent pas sous concurrence. Cette migration ajoute les garde-fous DB :
--  1. payments.idempotency_key + index unique partiel (clé anti double-clic)
--  2. une seule session de caisse ouverte par école (index partiel)
--  3. unicités existantes rendues compatibles soft-delete (deleted_at IS NULL)
--     pour pre_enrollments(code) et enrollments(matricule)
--  4. suppression du UNIQUE global redondant sur enrollments.matricule
--     (le couple (school_id, matricule) suffit ; le global bloque la
--     réutilisation inter-écoles et les lignes soft-deleted)
--
-- Idempotente : IF NOT EXISTS / IF EXISTS partout, rejouable sans risque.

-- ------------------------------------------------- 1. idempotence payments ---
alter table public.payments
  add column if not exists idempotency_key text;

-- Backfill : les paiements historiques prennent leur id comme clé.
update public.payments
  set idempotency_key = id::text
  where idempotency_key is null;

create unique index if not exists uq_payments_school_idem
  on public.payments (school_id, idempotency_key)
  where deleted_at is null;

create index if not exists idx_payments_idempotency
  on public.payments (idempotency_key);

-- ------------------------------------ 2. une caisse ouverte par école -------
create unique index if not exists uq_cash_open_per_school
  on public.cash_sessions (school_id)
  where status = 'open' and deleted_at is null;

-- --------------------------- 3a. pre_enrollments : code unique hors deleted --
alter table public.pre_enrollments
  drop constraint if exists pre_enrollments_school_id_code_key;

create unique index if not exists uq_pre_enrollments_school_code
  on public.pre_enrollments (school_id, code)
  where deleted_at is null;

-- --------------------------- 3b. enrollments : matricule hors deleted -------
-- Le couple (school_id, matricule) devient unique hors soft-deleted.
create unique index if not exists uq_enrollments_school_matricule
  on public.enrollments (school_id, matricule)
  where deleted_at is null;

-- NOTE (P0) : un éventuel UNIQUE global redondant sur matricule seul
-- (contrainte historique `unique (school_id...)` / `matricule text unique`)
-- n'est PAS retiré ici — DROP CONSTRAINT sans IF EXISTS sur un nom présumé
-- ferait échouer tout le push si le nom réel diffère. Le couple ci-dessus
-- suffit à la protection concurrence ; le global sera audité (pg_constraint)
-- puis retiré dans un lot ultérieur.
