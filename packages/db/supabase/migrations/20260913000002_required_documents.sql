-- ============================================================================
-- 00015 — Documents requis à l'inscription (configurable par établissement)
-- Remplace la liste fixe (extrait acte de naissance, bulletin…) par une table
-- que chaque école définit : nom, obligatoire, applicable à un niveau/cycle.
-- Idempotent : IF NOT EXISTS + DROP TRIGGER / POLICY IF EXISTS.
-- Scope : une ligne par école. RLS scopée + grants service_role.
-- ============================================================================

create table if not exists public.required_documents (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  nom                text not null check (trim(nom) <> ''),
  obligatoire        boolean not null default true,
  applicable_to_level_id uuid references public.grade_levels(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (school_id, nom, applicable_to_level_id)
);

create index if not exists idx_required_documents_school
  on public.required_documents (school_id);
create index if not exists idx_required_documents_level
  on public.required_documents (school_id, applicable_to_level_id);

drop trigger if exists trg_required_documents_updated_at on public.required_documents;
create trigger trg_required_documents_updated_at
  before update on public.required_documents
  for each row execute function public.touch_updated_at();

alter table public.required_documents enable row level security;

drop policy if exists required_documents_read on public.required_documents;
create policy required_documents_read on public.required_documents for select
  using (deleted_at is null and (is_super_admin() or is_school_member(school_id)));

drop policy if exists required_documents_write on public.required_documents;
create policy required_documents_write on public.required_documents for insert
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

drop policy if exists required_documents_update on public.required_documents;
create policy required_documents_update on public.required_documents for update
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']))
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

drop policy if exists required_documents_delete on public.required_documents;
create policy required_documents_delete on public.required_documents for delete
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

grant all on public.required_documents to service_role;

-- ── Seed : documents par défaut réalistes ──
-- Extrait acte de naissance (toujours obligatoire), bulletin année précédente
-- (obligatoire seulement si réinscription — donc applicable aux niveaux existants).

insert into public.required_documents (school_id, nom, obligatoire, applicable_to_level_id)
  select id, 'Extrait acte de naissance', true, null from public.schools
  where not exists (select 1 from public.required_documents d where d.school_id = schools.id and d.nom = 'Extrait acte de naissance' and d.applicable_to_level_id is null)
  on conflict (school_id, nom, applicable_to_level_id) do nothing;

insert into public.required_documents (school_id, nom, obligatoire, applicable_to_level_id)
  select s.id, 'Bulletin de l''année précédente', true, level.id
  from public.schools s
  join public.grade_levels level on true
  where not exists (
    select 1 from public.required_documents d
    where d.school_id = s.id and d.nom = 'Bulletin de l''année précédente' and d.applicable_to_level_id = level.id
  )
  on conflict (school_id, nom, applicable_to_level_id) do nothing;
