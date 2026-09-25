-- 20260924000000 — S1 : KPI financiers direction en base (RPC native)
--
-- Offload des calculs analytiques de dashboard-data.ts (cumul annuel,
-- comparaisons mensuelles M/M-1, répartition par méthode et série journalière
-- via generate_series) vers une fonction Postgres exécutée directement en base.
-- Évite le rapatriement et le parcours JS non borné de la table payments.
--
-- Idempotent : CREATE OR REPLACE FUNCTION + IF NOT EXISTS sur les index.

-- 1. Index optimisés pour les requêtes analytiques sur payments
create index if not exists idx_payments_school_received_at
  on public.payments (school_id, received_at)
  where deleted_at is null;

create index if not exists idx_payments_session_id
  on public.payments (cash_session_id)
  where deleted_at is null and cash_session_id is not null;

-- 2. Fonction RPC retournant les KPI financiers agrégés
create or replace function public.get_direction_financial_kpis(
  p_school_id uuid,
  p_academic_year_id uuid default null,
  p_now timestamptz default now(),
  p_daily_window int default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_date date;
  v_cur_month_start timestamptz;
  v_next_month_start timestamptz;
  v_prev_month_start timestamptz;
  v_collected_this_year bigint;
  v_collected_this_month bigint;
  v_collected_prev_month bigint;
  v_by_method jsonb;
  v_daily_series jsonb;
begin
  -- Bornes temporelles basées sur p_now
  v_ref_date := (p_now at time zone 'UTC')::date;
  v_cur_month_start := date_trunc('month', p_now at time zone 'UTC') at time zone 'UTC';
  v_next_month_start := (v_cur_month_start + interval '1 month');
  v_prev_month_start := (v_cur_month_start - interval '1 month');

  -- Si aucune année scolaire n'est fournie, totaux à zéro et série vide
  if p_academic_year_id is null then
    return jsonb_build_object(
      'collected_this_year', 0,
      'collected_this_month', 0,
      'collected_previous_month', 0,
      'by_method', '[]'::jsonb,
      'daily_series', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'date', to_char(d.day, 'YYYY-MM-DD'),
              'total', 0
            ) order by d.day asc
          )
          from generate_series(
            v_ref_date - ((p_daily_window - 1) || ' days')::interval,
            v_ref_date,
            '1 day'::interval
          ) as d(day)
        ),
        '[]'::jsonb
      )
    );
  end if;

  -- 1. Totaux globaux de l'année et comparatifs mensuels
  select
    coalesce(sum(p.amount), 0),
    coalesce(sum(case when p.received_at >= v_cur_month_start and p.received_at < v_next_month_start then p.amount else 0 end), 0),
    coalesce(sum(case when p.received_at >= v_prev_month_start and p.received_at < v_cur_month_start then p.amount else 0 end), 0)
  into
    v_collected_this_year,
    v_collected_this_month,
    v_collected_prev_month
  from public.payments p
  join public.enrollments e on e.id = p.enrollment_id
  where p.school_id = p_school_id
    and p.deleted_at is null
    and e.academic_year_id = p_academic_year_id
    and e.deleted_at is null;

  -- 2. Répartition par méthode de paiement
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'method', m.method,
        'total', m.total
      ) order by m.total desc
    ),
    '[]'::jsonb
  )
  into v_by_method
  from (
    select
      coalesce(p.payment_method, 'autre') as method,
      sum(p.amount)::bigint as total
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where p.school_id = p_school_id
      and p.deleted_at is null
      and e.academic_year_id = p_academic_year_id
      and e.deleted_at is null
    group by coalesce(p.payment_method, 'autre')
  ) m;

  -- 3. Série journalière continue (fenêtre p_daily_window jours terminée à v_ref_date)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(days.day, 'YYYY-MM-DD'),
        'total', coalesce(agg.total, 0)
      ) order by days.day asc
    ),
    '[]'::jsonb
  )
  into v_daily_series
  from (
    select generate_series(
      v_ref_date - ((p_daily_window - 1) || ' days')::interval,
      v_ref_date,
      '1 day'::interval
    )::date as day
  ) days
  left join (
    select
      (p.received_at at time zone 'UTC')::date as p_day,
      sum(p.amount)::bigint as total
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where p.school_id = p_school_id
      and p.deleted_at is null
      and e.academic_year_id = p_academic_year_id
      and e.deleted_at is null
      and (p.received_at at time zone 'UTC')::date >= (v_ref_date - (p_daily_window - 1))
      and (p.received_at at time zone 'UTC')::date <= v_ref_date
    group by (p.received_at at time zone 'UTC')::date
  ) agg on agg.p_day = days.day;

  return jsonb_build_object(
    'collected_this_year', v_collected_this_year,
    'collected_this_month', v_collected_this_month,
    'collected_previous_month', v_collected_prev_month,
    'by_method', v_by_method,
    'daily_series', v_daily_series
  );
end;
$$;

revoke execute on function public.get_direction_financial_kpis(uuid, uuid, timestamptz, int)
  from public, anon, authenticated;
grant execute on function public.get_direction_financial_kpis(uuid, uuid, timestamptz, int)
  to service_role;

comment on function public.get_direction_financial_kpis is
  'S1 : KPI financiers direction agrégés en base (totaux exercice, M vs M-1, ventilation par mode, série N jours sans trou).';
