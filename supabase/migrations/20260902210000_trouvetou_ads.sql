-- Campagnes publicitaires optionnelles publiées sur Trouvetou.
create table if not exists public.trouvetou_ads (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  target_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint trouvetou_ads_dates_chk check (ends_at is null or ends_at > starts_at)
);

create index if not exists idx_trouvetou_ads_active
  on public.trouvetou_ads (establishment_id, active, starts_at, ends_at);

alter table public.trouvetou_ads enable row level security;
grant select, insert, update, delete on public.trouvetou_ads to authenticated;
grant select on public.trouvetou_ads to anon;

drop policy if exists "Admin gère ses publicités Trouvetou" on public.trouvetou_ads;
create policy "Admin gère ses publicités Trouvetou"
  on public.trouvetou_ads for all
  using (
    establishment_id in (select establishment_id from public.my_profile() where role = 'admin')
  )
  with check (
    establishment_id in (select establishment_id from public.my_profile() where role = 'admin')
  );
