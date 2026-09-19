-- 20260919010000 — Trouvetou profil public intelligent
-- A appliquer manuellement après les migrations Trouvetou existantes.

alter table public.schools
  add column if not exists cover_photo_url text,
  add column if not exists gallery_photos jsonb not null default '[]'::jsonb,
  add column if not exists public_address text,
  add column if not exists public_phone text,
  add column if not exists public_email text,
  add column if not exists public_website_url text,
  add column if not exists public_highlights jsonb not null default '[]'::jsonb,
  add column if not exists admission_notes text;

create index if not exists idx_schools_trouvetou_published_city
  on public.schools (city)
  where published_to_trouvetou = true and deleted_at is null;

insert into storage.buckets (id, name, public)
values ('trouvetou-media', 'trouvetou-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Trouvetou public media read" on storage.objects;
create policy "Trouvetou public media read"
on storage.objects for select
using (bucket_id = 'trouvetou-media');

comment on column public.schools.cover_photo_url is 'Main public photo displayed on Trouvetou.';
comment on column public.schools.gallery_photos is 'Public school photo gallery URLs for Trouvetou.';
comment on column public.schools.public_highlights is 'Structured public highlights/services shown by Trouvetou.';
comment on column public.schools.admission_notes is 'Public admission guidance shown to families on Trouvetou.';
