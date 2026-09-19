-- 20260918234426 — Moratoires intelligents : échéancier, garde-fous et guidage
create table if not exists public.moratorium_installments (
  id uuid primary key default gen_random_uuid(),
  moratorium_id uuid not null references public.moratoriums(id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  due_date date not null,
  amount bigint not null check (amount > 0),
  paid_amount bigint not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','late','cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (moratorium_id, installment_no)
);
create index if not exists idx_moratorium_installments_moratorium on public.moratorium_installments(moratorium_id);
create index if not exists idx_moratorium_installments_due on public.moratorium_installments(due_date) where status in ('pending','late');

alter table public.moratorium_installments enable row level security;
drop policy if exists moratorium_installments_member_read on public.moratorium_installments;
create policy moratorium_installments_member_read on public.moratorium_installments for select
  using (
    is_super_admin() or exists (
      select 1 from public.moratoriums m
      where m.id = moratorium_id and is_school_member(m.school_id)
    )
  );
drop policy if exists moratorium_installments_finance_write on public.moratorium_installments;
create policy moratorium_installments_finance_write on public.moratorium_installments for all
  using (
    is_super_admin() or exists (
      select 1 from public.moratoriums m
      where m.id = moratorium_id
        and has_school_role(m.school_id, array['direction','compta','super_admin'])
    )
  )
  with check (
    is_super_admin() or exists (
      select 1 from public.moratoriums m
      where m.id = moratorium_id
        and has_school_role(m.school_id, array['direction','compta','super_admin'])
    )
  );
grant select on public.moratorium_installments to authenticated;

create or replace function public.sync_enrollment_fee_status_from_moratorium()
returns trigger language plpgsql as $$
declare v_enrollment uuid;
begin
  v_enrollment := coalesce(new.enrollment_id, old.enrollment_id);
  if v_enrollment is not null then
    update public.enrollments e
       set fee_status = case
         when e.fee_expected = 0 then 'non_genere'
         when exists (
           select 1 from public.moratoriums m
           where m.enrollment_id = e.id and m.status in ('pending','approved') and m.deleted_at is null
         ) then 'moratoire'
         when e.fee_expected - e.fee_paid > 0 then 'impaye'
         when e.fee_expected - e.fee_paid < 0 then 'avance'
         else 'soldé'
       end
     where e.id = v_enrollment;
  end if;
  return null;
end $$;

drop trigger if exists trg_sync_fee_status_moratoriums on public.moratoriums;
create trigger trg_sync_fee_status_moratoriums
after insert or update or delete on public.moratoriums
for each row execute function public.sync_enrollment_fee_status_from_moratorium();

-- Corrige le trigger Finance Phase 2 pour les DELETE (NEW n'existe pas en DELETE).
create or replace function public.sync_enrollment_fee_status()
returns trigger language plpgsql as $$
declare
  v_enrollment uuid;
  v_expected bigint;
  v_paid bigint;
  v_discount bigint;
  v_moratoire boolean;
begin
  v_enrollment := coalesce(new.enrollment_id, old.enrollment_id);
  select coalesce(sum(sfi.amount),0) into v_expected from public.student_fee_items sfi where sfi.enrollment_id=v_enrollment and sfi.deleted_at is null;
  select coalesce(sum(pay.amount),0) into v_paid from public.payments pay where pay.enrollment_id=v_enrollment and pay.deleted_at is null;
  select coalesce(sum(fd.amount),0) into v_discount from public.fee_discounts fd where fd.enrollment_id=v_enrollment and fd.deleted_at is null;
  select exists(select 1 from public.moratoriums m where m.enrollment_id=v_enrollment and m.status in ('pending','approved') and m.deleted_at is null) into v_moratoire;
  update public.enrollments e
     set fee_expected=greatest(0,v_expected-v_discount),
         fee_paid=v_paid,
         fee_balance=greatest(0,v_expected-v_discount)-v_paid,
         fee_status=case
           when v_expected=0 then 'non_genere'
           when v_moratoire then 'moratoire'
           when v_expected-v_discount-v_paid>0 then 'impaye'
           when v_expected-v_discount-v_paid<0 then 'avance'
           else 'soldé' end
   where e.id=v_enrollment;
  return null;
end $$;

comment on table public.moratorium_installments is 'Échéancier réel d’un moratoire approuvé. Chaque ligne représente une échéance traçable.';
