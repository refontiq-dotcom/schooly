-- Schooly — accès de service piloté par le recouvrement.
-- Une inscription confirmée crée une créance de 1 000 FCFA.
-- Le délai est calculé par créance, ce qui couvre les inscriptions tardives
-- pouvant se poursuivre jusqu'en février de la même année scolaire.

create extension if not exists pg_cron;

create table if not exists public.school_billing_access (
  school_id uuid primary key references public.schools(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','grace','restricted','suspended')),
  billable_students integer not null default 0,
  billed_amount bigint not null default 0,
  covered_amount bigint not null default 0,
  remaining_amount bigint not null default 0,
  oldest_unpaid_at timestamptz,
  days_overdue integer not null default 0,
  last_evaluated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_school_billing_access_status
  on public.school_billing_access(status);
create index if not exists idx_school_billing_access_oldest
  on public.school_billing_access(oldest_unpaid_at);

alter table public.school_billing_access enable row level security;

drop policy if exists school_billing_access_select on public.school_billing_access;
create policy school_billing_access_select
  on public.school_billing_access
  for select to authenticated
  using (
    exists (
      select 1 from public.user_school_roles usr
      where usr.school_id = school_billing_access.school_id
        and usr.user_id = (select auth.uid())
        and usr.is_active = true
    )
  );

create or replace function public.refresh_school_billing_access()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with ledger as (
    select
      pfl.tenant_id as school_id,
      pfl.id,
      pfl.amount,
      pfl.created_at,
      sum(pfl.amount) over (
        partition by pfl.tenant_id
        order by pfl.created_at, pfl.id
        rows between unbounded preceding and current row
      ) as cumulative_amount
    from public.platform_fee_ledger pfl
    where pfl.product_id = 'schooly'
      and pfl.event_type = 'enrollment_confirmed'
  ),
  coverage as (
    select
      s.id as school_id,
      count(l.id)::integer as billable_students,
      coalesce(sum(l.amount), 0)::bigint as billed_amount,
      coalesce((
        select sum(spr.amount)
        from public.subscription_payment_requests spr
        where spr.product_id = 'schooly'
          and spr.tenant_id = s.id
          and spr.status in ('validated', 'pending')
      ), 0)::bigint as covered_amount
    from public.schools s
    left join ledger l on l.school_id = s.id
    where s.deleted_at is null
    group by s.id
  ),
  evaluated as (
    select
      c.*,
      greatest(0::bigint, c.billed_amount - c.covered_amount) as remaining_amount,
      (
        select min(l.created_at)
        from ledger l
        where l.school_id = c.school_id
          and l.cumulative_amount > c.covered_amount
      ) as oldest_unpaid_at
    from coverage c
  )
  insert into public.school_billing_access (
    school_id, status, billable_students, billed_amount, covered_amount,
    remaining_amount, oldest_unpaid_at, days_overdue, last_evaluated_at, updated_at
  )
  select
    e.school_id,
    case
      when e.remaining_amount <= 0 or e.oldest_unpaid_at is null then 'active'
      when now() < e.oldest_unpaid_at + interval '7 days' then 'grace'
      when now() < e.oldest_unpaid_at + interval '30 days' then 'restricted'
      else 'suspended'
    end,
    e.billable_students,
    e.billed_amount,
    least(e.covered_amount, e.billed_amount),
    e.remaining_amount,
    e.oldest_unpaid_at,
    case
      when e.oldest_unpaid_at is null then 0
      else greatest(
        0,
        floor(extract(epoch from (now() - (e.oldest_unpaid_at + interval '7 days'))) / 86400)::integer
      )
    end,
    now(),
    now()
  from evaluated e
  on conflict (school_id) do update set
    status = excluded.status,
    billable_students = excluded.billable_students,
    billed_amount = excluded.billed_amount,
    covered_amount = excluded.covered_amount,
    remaining_amount = excluded.remaining_amount,
    oldest_unpaid_at = excluded.oldest_unpaid_at,
    days_overdue = excluded.days_overdue,
    last_evaluated_at = excluded.last_evaluated_at,
    updated_at = excluded.updated_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_school_billing_access() from public, anon, authenticated;

select cron.schedule(
  'schooly-billing-access-refresh',
  '15 * * * *',
  $$select public.refresh_school_billing_access();$$
)
where not exists (
  select 1 from cron.job where jobname = 'schooly-billing-access-refresh'
);

select public.refresh_school_billing_access();
