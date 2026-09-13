-- ============================================================================
-- 00013 — Checklist d'inscription par établissement (configurable)
-- Remplace la liste figée de fournitures (paper, feutres…) par une table
-- que chaque école gère elle-même : libellé, coût cash optionnel, obligatoire,
-- ordre d'affichage dans le formulaire d'inscription.
-- Idempotent : IF NOT EXISTS + DROP TRIGGER / POLICY IF EXISTS.
-- Scope : une ligne par école (school_id). RLS scopée + grants service_role.
-- ============================================================================

create table if not exists public.enrollment_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  nom             text not null check (trim(nom) <> ''),
  montant_cash   bigint default null check (montant_cash is null or montant_cash >= 0),
  obligatoire     boolean not null default true,
  ordre_affichage integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (school_id, ordre_affichage)
);

create index if not exists idx_enrollment_checklist_items_school
  on public.enrollment_checklist_items (school_id);
create index if not exists idx_enrollment_checklist_items_ordre
  on public.enrollment_checklist_items (school_id, ordre_affichage);

drop trigger if exists trg_enrollment_checklist_items_updated_at on public.enrollment_checklist_items;
create trigger trg_enrollment_checklist_items_updated_at
  before update on public.enrollment_checklist_items
  for each row execute function public.touch_updated_at();

alter table public.enrollment_checklist_items enable row level security;

drop policy if exists enrollment_checklist_items_read on public.enrollment_checklist_items;
create policy enrollment_checklist_items_read on public.enrollment_checklist_items for select
  using (deleted_at is null and (is_super_admin() or is_school_member(school_id)));

drop policy if exists enrollment_checklist_items_write on public.enrollment_checklist_items;
create policy enrollment_checklist_items_write on public.enrollment_checklist_items for insert
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

drop policy if exists enrollment_checklist_items_update on public.enrollment_checklist_items;
create policy enrollment_checklist_items_update on public.enrollment_checklist_items for update
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']))
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

drop policy if exists enrollment_checklist_items_delete on public.enrollment_checklist_items;
create policy enrollment_checklist_items_delete on public.enrollment_checklist_items for delete
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

grant all on public.enrollment_checklist_items to service_role;

-- ── Seed : checklist par défaut réaliste pour toute école sans configuration ──
-- (1 rame papier A4, 1 paquet feutres, 1 kit tenue scolaire — désactivable)

insert into public.enrollment_checklist_items (school_id, nom, montant_cash, obligatoire, ordre_affichage)
  select id, '1 rame de papier A4', 2500, true, 100 from public.schools
  where not exists (select 1 from public.enrollment_checklist_items e where e.school_id = schools.id)
  on conflict do nothing;

insert into public.enrollment_checklist_items (school_id, nom, montant_cash, obligatoire, ordre_affichage)
  select id, '1 paquet de feutres effaçables', 3500, true, 200 from public.schools
  where not exists (select 1 from public.enrollment_checklist_items e where e.school_id = schools.id and e.ordre_affichage = 200)
  on conflict (school_id, ordre_affichage) do nothing;

insert into public.enrollment_checklist_items (school_id, nom, montant_cash, obligatoire, ordre_affichage)
  select id, '1 kit de tenue scolaire', 12000, true, 300 from public.schools
  where not exists (select 1 from public.enrollment_checklist_items e where e.school_id = schools.id and e.ordre_affichage = 300)
  on conflict (school_id, ordre_affichage) do nothing;
