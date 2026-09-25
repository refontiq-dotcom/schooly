-- R6 — Endurance du dashboard Direction à l'échelle.
--
-- Ce que S1 a déplacé en base ne vaut que si les RPC tiennent quand la table
-- `payments` grossit. On mesure donc les deux agrégats sur un jeu synthétique
-- de 10 000 encaissements (500 élèves), et on regarde aussi le plan d'exécution
-- pour vérifier que les index de la vague sont bien empruntés.
--
-- Sécurité : TOUT est fait dans une transaction annulée en fin de script
-- (`rollback`). Aucune donnée ne subsiste, même en cas d'échoint.
--
-- Prérequis : les migrations S1 doivent être jouées
-- (20260924000000 et 20260925000000), sinon les appels de fonction échouent.
--
-- Usage (base locale Supabase) :
--   npm run db:bench
-- ou explicitement :
--   psql "$DATABASE_URL" -f packages/db/scripts/bench_dashboard.sql
--
-- Seuils de lecture (à ajuster selon la machine) : les deux agrégats doivent
-- rester largement sous 100 ms, et le plan ne doit jamais.seq Scan sur
-- `payments`.

\set ON_ERROR_STOP on
\timing on

begin;

-- ── 1. Socle : une école, un exercice, un niveau ────────────────────────────
-- On réutilise l'école existante (le script ne crée pas de tenant) et on
-- fabrique des données jetables autour, supprimées par le rollback.

create temporary table bench_context on commit drop as
select
  (select id from public.schools limit 1) as school_id;

do $$
declare
  v_school uuid;
  v_year   uuid := 'f0000000-0000-4000-8000-000000000001';
  v_grade  uuid := 'f0000000-0000-4000-8000-000000000002';
begin
  select school_id into v_school from bench_context;

  -- Statut non actif : la base impose une seule année « en_cours » par école
  -- (`academic_years_school_one_active`), et les RPC ne filtrent pas sur le
  -- statut. Un exercice planifié suffit donc à la mesure.
  insert into public.academic_years (id, school_id, label, start_date, end_date, status)
  values (v_year, v_school, 'BENCH-2025', date '2025-09-01', date '2026-06-30', 'planifiee')
  on conflict (id) do nothing;

  insert into public.grade_levels (id, school_id, name, level, cycle)
  values (v_grade, v_school, 'Bench 6e', 6, 'college')
  on conflict (id) do nothing;
end $$;

-- ── 2. 500 élèves + tuteurs + inscriptions ───────────────────────────────────
insert into public.students (id, school_id, first_name, last_name, date_of_birth)
select
  ('f0000000-0000-4000-8000-' || lpad((i + 1)::text, 12, '0'))::uuid,
  school_id,
  'Prenom' || i,
  'Nom' || i,
  date '2012-01-01'
from bench_context, generate_series(1, 500) as i;

insert into public.guardians (id, phone, full_name)
select
  ('f1000000-0000-4000-8000-' || lpad((i + 1)::text, 12, '0'))::uuid,
  -- Numéro unique par ligne : `phone` porte une contrainte d'unicité, un
  -- modulo_repéterait les mêmes numéros et ferait échouer le seed.
  '+22507' || lpad(i::text, 6, '0'),
  'Tuteur ' || i
from generate_series(1, 500) as i;

insert into public.enrollments (
  id, school_id, academic_year_id, grade_level_id, student_id, guardian_id, matricule
)
select
  ('f2000000-0000-4000-8000-' || lpad((i + 1)::text, 12, '0'))::uuid,
  school_id,
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  ('f0000000-0000-4000-8000-' || lpad((i + 1)::text, 12, '0'))::uuid,
  ('f1000000-0000-4000-8000-' || lpad((i + 1)::text, 12, '0'))::uuid,
  'BENCH-' || i
from bench_context, generate_series(1, 500) as i;

-- ── 3. 10 000 encaissements répartis sur 12 mois ───────────────────────────
-- `payment_method` est NOT NULL : on alterne les modes réellement acceptés.
insert into public.payments (
  id, school_id, enrollment_id, amount, payment_method, received_at
)
-- Les inscriptions sont créées pour i ∈ [1..500] avec le suffixe `i + 1`
-- (suffixes 2..501). La répartition doit donc tomber dans cette plage :
-- ((i - 1) % 500) + 2 ∈ [2..501] pour tout i.
select
  ('f3000000-0000-4000-8000-' || lpad((i + 1)::text, 12, '0'))::uuid,
  c.school_id,
  ('f2000000-0000-4000-8000-' || lpad((((i - 1) % 500) + 2)::text, 12, '0'))::uuid,
  case when i % 10 = 0 then 50000 else (10000 + (i % 17) * 500) end,
  case i % 3 when 0 then 'cash' when 1 then 'mobile_money' else 'check' end,
  timestamptz '2025-09-01' + ((i % 365) || ' days')::interval
         + (((i % 24) || ' hours')::interval)
from bench_context c, generate_series(1, 10000) as i;

analyze public.payments;
analyze public.enrollments;

\echo ''
\echo '── Volume injecté ──'
select
  (select count(*) from public.payments)  as paiements,
  (select count(*) from public.enrollments) as inscriptions,
  (select pg_size_pretty(pg_total_relation_size('public.payments'))) as taille_payments;

-- ── 4. Agrégats du dashboard (S1) ──────────────────────────────────────────
\echo ''
\echo '── get_direction_financial_kpis (cumul exercice, M/M-1, ventilation, série) ──'
-- La durée fait foi dans la sortie `\timing` de psql : tenter de la mesurer
-- dans la même requête donne un chiffre faux (clock_timestamp est évalué par
-- ligne, pas autour de l'appel de fonction).
select
  (k->>'collected_this_year')::bigint        as cumul_exercice,
  (k->>'collected_this_month')::bigint      as mois_courant,
  (k->>'collected_previous_month')::bigint  as mois_precedent,
  jsonb_array_length(k->'by_method')         as modes,
  jsonb_array_length(k->'daily_series')      as jours_serie
from (
  select
    public.get_direction_financial_kpis(
      (select school_id from bench_context),
      'f0000000-0000-4000-8000-000000000001',
      now(),
      30
    ) as k
) s;

\echo ''
\echo '── get_direction_balance_kpis (soldes par inscription, session) ──'
select
  jsonb_array_length(b->'enrollment_paid')   as inscriptions_encaissee,
  (b->>'session_paid')::bigint              as total_session
from (
  select
    public.get_direction_balance_kpis(
      (select school_id from bench_context),
      'f0000000-0000-4000-8000-000000000001',
      null
    ) as b
) s;

-- ── 5. Plan d'exécution : les index de la vague servent-ils vraiment ? ─────
\echo ''
\echo '── Plan : agrégats financiers ──'
explain (analyze, buffers, timing off)
select public.get_direction_financial_kpis(
  (select school_id from bench_context),
  'f0000000-0000-4000-8000-000000000001',
  now(),
  30
);

\echo ''
\echo '── Plan : soldes ──'
explain (analyze, buffers, timing off)
select public.get_direction_balance_kpis(
  (select school_id from bench_context),
  'f0000000-0000-4000-8000-000000000001',
  null
);

-- ── 6. Repli : le scan complet que S1 a supprimé (pour comparaison) ────────
-- On mesure l'agrégation « à la ancienne » : somme par inscription sur toute
-- la table. C'est le coût que le dashboard ne paie plus sur son chemin nominal.
\echo ''
\echo '── Comparaison : agrégation manuelle (ce que S1 a supprimé) ──'
select count(*) as inscriptions_encaissee, sum(paid) as total
from (
  select enrollment_id, sum(amount)::bigint as paid
  from public.payments
  where deleted_at is null
  group by enrollment_id
) t;

rollback;
