-- Trouvetou — facturation des publicités
alter table public.trouvetou_ads
  add column if not exists duration_days integer,
  add column if not exists daily_rate numeric(12,2),
  add column if not exists total_amount numeric(12,2),
  add column if not exists payment_status text not null default 'draft',
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists contact_phone text,
  add column if not exists cta_label text;

update public.trouvetou_ads
set duration_days = (end_date - start_date) + 1,
    daily_rate = case when ((end_date - start_date) + 1) <= 6 then 1000 when ((end_date - start_date) + 1) <= 13 then 900 when ((end_date - start_date) + 1) <= 29 then 800 else 700 end,
    total_amount = ((end_date - start_date) + 1) * case when ((end_date - start_date) + 1) <= 6 then 1000 when ((end_date - start_date) + 1) <= 13 then 900 when ((end_date - start_date) + 1) <= 29 then 800 else 700 end,
    payment_status = 'draft',
    is_active = false
where duration_days is null or daily_rate is null or total_amount is null;

alter table public.trouvetou_ads
  alter column duration_days set not null,
  alter column daily_rate set not null,
  alter column total_amount set not null;

alter table public.trouvetou_ads
  drop constraint if exists trouvetou_ads_duration_days_check,
  drop constraint if exists trouvetou_ads_daily_rate_check,
  drop constraint if exists trouvetou_ads_total_amount_check,
  drop constraint if exists trouvetou_ads_dates_check,
  drop constraint if exists trouvetou_ads_payment_status_check;

alter table public.trouvetou_ads
  add constraint trouvetou_ads_duration_days_check check (duration_days > 0),
  add constraint trouvetou_ads_daily_rate_check check (daily_rate > 0),
  add constraint trouvetou_ads_total_amount_check check (total_amount >= 0),
  add constraint trouvetou_ads_dates_check check (end_date >= start_date),
  add constraint trouvetou_ads_payment_status_check check (payment_status in ('draft','pending_payment','paid','active','expired','cancelled'));

create index if not exists idx_trouvetou_ads_payment_status on public.trouvetou_ads(payment_status);
create index if not exists idx_trouvetou_ads_school_payment on public.trouvetou_ads(school_id, payment_status);
