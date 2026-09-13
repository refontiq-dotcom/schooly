-- ============================================================================
-- 00011 — Intégration Trouvetou (Phase 10)
-- Regroupe les 3 migrations décrites dans TROUVETOU_INTEGRATION.md :
-- 1. published_to_trouvetou + reserve_seat / finalize_reservation
-- 2. trouvetou_ads + RLS
-- ============================================================================

-- 1. Statut de publication
alter table public.schools
  add column if not exists published_to_trouvetou boolean not null default false;

-- 2. Table pour les publicités Trouvetou
create table if not exists public.trouvetou_ads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  message text not null,
  image_url text,
  target_url text,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_trouvetou_ads_updated_at on public.trouvetou_ads;
create trigger trg_trouvetou_ads_updated_at before update on public.trouvetou_ads
  for each row execute function public.touch_updated_at();

create index if not exists idx_trouvetou_ads_school on public.trouvetou_ads (school_id);
create index if not exists idx_trouvetou_ads_active on public.trouvetou_ads (school_id, is_active, start_date, end_date);

alter table public.trouvetou_ads enable row level security;

drop policy if exists trouvetou_ads_member_read on public.trouvetou_ads;
create policy trouvetou_ads_member_read on public.trouvetou_ads for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists trouvetou_ads_write on public.trouvetou_ads;
create policy trouvetou_ads_write on public.trouvetou_ads for all
  using (is_super_admin() or has_school_role(school_id, array['direction', 'super_admin']));

-- 3. Dossiers de réservation (pending_payment / reserved)
create table if not exists public.trouvetou_reservations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_level_id uuid not null references public.grade_levels(id) on delete cascade,
  student_full_name text not null,
  student_birthdate date,
  parent_full_name text not null,
  parent_phone text not null,
  parent_email text,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'reserved', 'confirmed', 'expired')),
  payment_reference text,
  amount_paid bigint,
  qr_code_token text unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_trouvetou_reservations_updated_at on public.trouvetou_reservations;
create trigger trg_trouvetou_reservations_updated_at before update on public.trouvetou_reservations
  for each row execute function public.touch_updated_at();

alter table public.trouvetou_reservations enable row level security;

drop policy if exists trouvetou_reservations_member_read on public.trouvetou_reservations;
create policy trouvetou_reservations_member_read on public.trouvetou_reservations for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists trouvetou_reservations_write on public.trouvetou_reservations;
create policy trouvetou_reservations_write on public.trouvetou_reservations for all
  using (is_super_admin() or has_school_role(school_id, array['direction', 'secretariat', 'super_admin']));

-- 4. Fonction reserve_seat (appelée post-paiement)
create or replace function public.reserve_seat(p_reservation_id uuid, p_payment_ref text, p_amount bigint)
returns boolean
language plpgsql
security definer
as $$
declare
  v_res record;
begin
  select * into v_res from public.trouvetou_reservations where id = p_reservation_id for update;
  if not found then return false; end if;
  if v_res.status <> 'pending_payment' then return false; end if;
  
  update public.trouvetou_reservations 
  set status = 'reserved', 
      payment_reference = p_payment_ref, 
      amount_paid = p_amount,
      qr_code_token = encode(gen_random_bytes(16), 'hex'),
      expires_at = now() + interval '72 hours'
  where id = p_reservation_id;
  
  return true;
end;
$$;

-- 5. Fonction finalize_reservation (appelée par l'admin)
create or replace function public.finalize_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_res record;
  v_guardian_id uuid;
  v_student_id uuid;
  v_year_id uuid;
begin
  select * into v_res from public.trouvetou_reservations where id = p_reservation_id for update;
  if not found then return false; end if;
  if v_res.status <> 'reserved' then return false; end if;

  -- 1. Chercher l'année active
  select id into v_year_id from public.academic_years where school_id = v_res.school_id and status = 'active' limit 1;
  
  -- 2. Créer/Trouver tuteur
  select id into v_guardian_id from public.guardians where phone = v_res.parent_phone limit 1;
  if not found then
    insert into public.guardians (full_name, phone, email) values (v_res.parent_full_name, v_res.parent_phone, v_res.parent_email) returning id into v_guardian_id;
  end if;

  -- 3. Créer étudiant
  insert into public.students (school_id, first_name, last_name, birth_date) 
  values (v_res.school_id, split_part(v_res.student_full_name, ' ', 1), substring(v_res.student_full_name from position(' ' in v_res.student_full_name) + 1), v_res.student_birthdate)
  returning id into v_student_id;

  -- 4. Inscription
  insert into public.enrollments (school_id, student_id, guardian_id, grade_level_id, academic_year_id, status, enrollment_date)
  values (v_res.school_id, v_student_id, v_guardian_id, v_res.grade_level_id, v_year_id, 'confirmed', current_date);

  -- 5. Mettre à jour réservation
  update public.trouvetou_reservations set status = 'confirmed' where id = p_reservation_id;
  
  return true;
end;
$$;
