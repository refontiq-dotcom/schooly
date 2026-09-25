-- 20260925000000 — S1 (suite) : soldes, encours et total de session en base
--
-- La première migration (`get_direction_financial_kpis`) déportait le cumul de
-- l'exercice, la comparaison M / M-1, la ventilation par mode et la série
-- journalière. Elle ne suffisait pas : le loader rapatriait encore TOUTES les
-- lignes `payments` pour en déduire les soldes par inscription (débiteurs,
-- encours, taux de recouvrement) et le total encaissé dans la session de caisse
-- ouverte. Ce rapatriement reste le point noir d'échelle du dashboard.
--
-- Cette fonction renvoie, déjà agrégés :
-- - `enrollment_paid` : total encaissé par inscription de l'exercice, pour les
--   seules inscriptions porteuses d'au moins un encaissement (les autres valent
--   0 côté appelant) — le volume transporté suit le nombre d'élèves et non le
--   nombre de lignes de paiement ;
-- - `session_paid` : total encaissé dans la session de caisse demandée, tous
--   exercices confondus, comme le calcul historique côté application.
--
-- Même convention de sécurité que la fonction précédente : `security definer`,
-- `search_path` figé, `execute` révoqué pour `public` / `anon` / `authenticated`
-- et accordé au seul `service_role` (agrégats de pilotage, pas un endpoint
-- public). Les lignes jointes sont filtrées sur `deleted_at` des deux côtés :
-- une inscription ou un paiement annulé ne doit jamais gonfler un solde.
--
-- Idempotent : CREATE OR REPLACE FUNCTION.

create or replace function public.get_direction_balance_kpis(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_cash_session_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enrollment_paid', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('enrollment_id', totals.enrollment_id, 'paid', totals.paid)
                 order by totals.enrollment_id
               )
        from (
          select
            p.enrollment_id,
            sum(p.amount)::bigint as paid
          from public.payments p
          join public.enrollments e on e.id = p.enrollment_id
          where p.school_id = p_school_id
            and p.deleted_at is null
            and e.academic_year_id = p_academic_year_id
            and e.deleted_at is null
          group by p.enrollment_id
          having sum(p.amount) <> 0
        ) totals
      ),
      '[]'::jsonb
    ),
    'session_paid', coalesce(
      (
        select sum(p.amount)::bigint
        from public.payments p
        where p.school_id = p_school_id
          and p.deleted_at is null
          and p.cash_session_id = p_cash_session_id
      ),
      0
    )
  );
$$;

revoke execute on function public.get_direction_balance_kpis(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_direction_balance_kpis(uuid, uuid, uuid)
  to service_role;

comment on function public.get_direction_balance_kpis is
  'S1 (suite) : soldes par inscription (encours, débiteurs) et total de session de caisse agrégés en base.';