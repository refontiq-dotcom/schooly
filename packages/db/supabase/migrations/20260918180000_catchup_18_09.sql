-- ============================================================================
-- 20260918180000 — RATTRAPAGE du 18/09 : UN SEUL SCRIPT À COLLER
--
-- Ce fichier regroupe, dans l'ordre, les 6 migrations du 18/09 :
--   20260918120000  grants authenticated (socle tenancy & structure)
--   20260918130000  lien parent/tuteur + contact d'urgence
--   20260918140000  scolarité antérieure de l'élève
--   20260918150000  type d'inscription + orientation État
--   20260918160000  normalisation téléphone + accès parent + source
--   20260918170000  correctif finalize_reservation()
--
-- POURQUOI UN REGROUPEMENT : appliquer 6 fichiers à la main dans le SQL Editor
-- est une source d'oubli (une migration manquée = un formulaire qui échoue
-- silencieusement). Ce script est IDEMPOTENT : le coller une fois suffit, et le
-- recoller ne casse rien (utile si l'on ne sait plus ce qui a déjà été appliqué).
--
-- Les 6 migrations individuelles restent la référence pour un environnement
-- neuf ou pour l'outil de migration ; ce fichier est un raccourci d'exploitation.
--
-- À exécuter dans Supabase → SQL Editor, en une seule fois.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1/6 — GRANTS authenticated sur le socle tenancy & structure (20260918120000)
--
-- Cause racine du bug « Aucune école rattachée » : erreur 42501 permission
-- denied. Une policy RLS n'est évaluée qu'APRÈS le privilège SQL de base ; les
-- tables du socle (20260908090000, 20260908110000) n'avaient aucun GRANT, et
-- 20260912010000 n'avait couvert que service_role. Or la garde requireSchoolRole
-- lit user_school_roles avec le client de session (authenticated).
-- ════════════════════════════════════════════════════════════════════════════

-- Socle tenancy (20260908090000)
grant select on public.user_school_roles to authenticated;
grant select on public.roles to authenticated;
grant select, update on public.schools to authenticated;
grant select, update on public.users to authenticated;
grant select on public.school_features to authenticated;

-- Structure académique (20260908110000)
grant select on public.academic_years to authenticated;
grant select on public.grade_levels to authenticated;
grant select on public.classes to authenticated;
grant select on public.subjects to authenticated;
grant select on public.class_subject_assignments to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2/6 — Lien tuteur/élève + contact d'urgence (20260918130000)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pre_enrollments
  add column if not exists guardian_relation text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

alter table public.guardians
  add column if not exists relation text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;


-- ════════════════════════════════════════════════════════════════════════════
-- 3/6 — Scolarité antérieure (20260918140000)
-- NULL quand « Première scolarisation » est cochée.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pre_enrollments
  add column if not exists previous_school text,
  add column if not exists previous_class text;

alter table public.students
  add column if not exists previous_school text,
  add column if not exists previous_class text;


-- ════════════════════════════════════════════════════════════════════════════
-- 4/6 — Type d'inscription & orientation État (20260918150000)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pre_enrollments
  add column if not exists enrollment_type text
    check (enrollment_type in ('nouvelle', 'reinscription')),
  add column if not exists state_orientation text
    check (state_orientation in ('oriente_etat', 'non_oriente')),
  add column if not exists orientation_number text,
  add column if not exists previous_matricule text;

alter table public.enrollments
  add column if not exists enrollment_type text
    check (enrollment_type in ('nouvelle', 'reinscription')),
  add column if not exists state_orientation text
    check (state_orientation in ('oriente_etat', 'non_oriente')),
  add column if not exists orientation_number text;


-- ════════════════════════════════════════════════════════════════════════════
-- 5/6 — Normalisation téléphone, accès parent, origine (20260918160000)
--
-- `guardians.phone` est écrit dans des formats DIFFÉRENTS selon le canal :
--   • formulaire public  → formatGuardianPhone → « +225 07 00 00 00 00 »
--   • guichet / Trouvetou → saisie brute       → « 0700000000 »
-- Un `where phone = $1` ne retrouve donc PAS le parent selon le canal d'origine.
-- La recherche passe désormais par `phone_norm`, jamais par `phone`.
-- ════════════════════════════════════════════════════════════════════════════

-- 5.1 Normalisation (source unique de vérité, côté SQL).
-- Miroir JS : apps/schooly/src/lib/reinscription.ts → normalizePhone().
create or replace function public.normalize_phone(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p_raw is null then
    return null;
  end if;

  d := regexp_replace(p_raw, '\D', '', 'g');
  if d = '' then
    return null;
  end if;

  -- « 00225XXXXXXXXXX » → retrait du préfixe international « 00225 »
  if d like '00225%' then
    d := substr(d, 6);
  -- « 225XXXXXXXXXX » (indicatif sans « + ») → retrait de « 225 »
  elsif d like '225%' and length(d) > 10 then
    d := substr(d, 4);
  end if;

  return '+225' || d;
end;
$$;

comment on function public.normalize_phone(text) is
  'Format canonique d''un numéro ivoirien : « +225 » + chiffres, sans espaces. Null si aucun chiffre.';

-- 5.2 Colonne dérivée + trigger sur guardians
alter table public.guardians
  add column if not exists phone_norm text;

create or replace function public.set_guardian_phone_norm()
returns trigger
language plpgsql
as $$
begin
  new.phone_norm := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_guardians_phone_norm on public.guardians;
create trigger trg_guardians_phone_norm
  before insert or update of phone on public.guardians
  for each row execute function public.set_guardian_phone_norm();

-- Backfill des lignes existantes (ne touche que celles divergentes)
update public.guardians
   set phone_norm = public.normalize_phone(phone)
 where phone_norm is distinct from public.normalize_phone(phone);

create index if not exists idx_guardians_phone_norm
  on public.guardians (phone_norm)
  where phone_norm is not null and deleted_at is null;

-- 5.3 Accès du parent à son tableau de bord par le téléphone.
-- Le même numéro qui a servi à l'inscription ouvre le tableau de bord parent
-- (apps/pwa-parent) : ce lien rattache la fiche `guardians` à un compte Auth.
alter table public.guardians
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists guardians_user_id_unique
  on public.guardians (user_id)
  where user_id is not null and deleted_at is null;

comment on column public.guardians.user_id is
  'Compte Auth du parent (accès PWA parent). Rattrapé par téléphone : guardians.phone_norm.';

-- 5.4 Origine d'une pré-inscription (traçabilité)
alter table public.pre_enrollments
  add column if not exists source text not null default 'form';

alter table public.pre_enrollments
  drop constraint if exists pre_enrollments_source_check;

alter table public.pre_enrollments
  add constraint pre_enrollments_source_check
  check (source in ('form', 'trouvetou', 'counter'));

create index if not exists idx_pre_enrollments_source
  on public.pre_enrollments (school_id, source)
  where deleted_at is null;

-- 5.5 Droits du socle (cf. 1/6)
grant execute on function public.normalize_phone(text) to authenticated;
grant select on public.guardians to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6/6 — Correctif finalize_reservation() (20260918170000)
--
-- La version de 20260910030000 écrivait dans `students (birth_date)` — colonne
-- INEXISTANTE (la vraie est `date_of_birth`, et elle est NOT NULL). Toute
-- finalisation d'une réservation Trouvetou échouait donc en 500 sans indice.
-- Trois fragilités silencieuses corrigées au passage : date de naissance
-- manquante, absence d'année active, découpage du nom. + anti-doublon élève.
-- Signature inchangée (`uuid → boolean`) : la route de finalisation est intacte.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.finalize_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_guardian_id uuid;
  v_student_id uuid;
  v_year_id uuid;
  v_first text;
  v_last text;
begin
  select * into v_res
    from public.trouvetou_reservations
   where id = p_reservation_id
   for update;

  if not found then return false; end if;
  if v_res.status <> 'reserved' then return false; end if;

  -- 1. Année active de l'école (obligatoire : enrollments.academic_year_id not null)
  select id into v_year_id
    from public.academic_years
   where school_id = v_res.school_id
     and status = 'active'
     and deleted_at is null
   order by created_at desc
   limit 1;

  if v_year_id is null then return false; end if;

  -- 2. Date de naissance obligatoire (students.date_of_birth not null).
  --    On refuse plutôt que d'inventer une date : la réservation reste
  --    'reserved', le secrétariat peut la compléter et relancer.
  if v_res.student_birthdate is null then return false; end if;

  -- 3. Découpage du nom complet : premier mot = prénom, reste = nom.
  v_first := split_part(btrim(v_res.student_full_name), ' ', 1);
  v_last  := btrim(substr(btrim(v_res.student_full_name), length(v_first) + 1));
  if v_last = '' then
    v_last := v_first;
  end if;

  -- 4. Tuteur : réutilisé par téléphone normalisé, sinon créé
  select id into v_guardian_id
    from public.guardians
   where public.normalize_phone(phone) = public.normalize_phone(v_res.parent_phone)
     and deleted_at is null
   limit 1;

  if v_guardian_id is null then
    insert into public.guardians (full_name, phone, email)
    values (v_res.parent_full_name, v_res.parent_phone, v_res.parent_email)
    returning id into v_guardian_id;
  end if;

  -- 5. Élève : réutilisé si la même identité existe déjà dans l'école
  select id into v_student_id
    from public.students
   where school_id = v_res.school_id
     and deleted_at is null
     and lower(btrim(first_name)) = lower(v_first)
     and lower(btrim(last_name)) = lower(v_last)
     and date_of_birth = v_res.student_birthdate
   limit 1;

  if v_student_id is null then
    insert into public.students (school_id, first_name, last_name, date_of_birth)
    values (v_res.school_id, v_first, v_last, v_res.student_birthdate)
    returning id into v_student_id;
  end if;

  -- 6. Inscription confirmée
  insert into public.enrollments (
    school_id, student_id, guardian_id, grade_level_id, academic_year_id,
    status, enrollment_date, enrollment_type, state_orientation
  )
  values (
    v_res.school_id, v_student_id, v_guardian_id, v_res.grade_level_id, v_year_id,
    'confirmed', current_date, 'nouvelle', 'non_oriente'
  );

  -- 7. Clôture de la réservation
  update public.trouvetou_reservations
     set status = 'confirmed'
   where id = p_reservation_id;

  return true;
end;
$$;

comment on function public.finalize_reservation(uuid) is
  'Finalise une réservation Trouvetou : crée (ou réutilise) tuteur et élève, puis l''inscription. false si année active absente ou date de naissance manquante.';


-- ════════════════════════════════════════════════════════════════════════════
-- FIN — Contrôle rapide après exécution
-- ════════════════════════════════════════════════════════════════════════════
-- Les 5 colonnes doivent être présentes, et phone_norm rempli :
--
--   select column_name, table_name
--     from information_schema.columns
--    where (table_name = 'pre_enrollments'
--           and column_name in ('guardian_relation','previous_school',
--               'enrollment_type','state_orientation','source'))
--       or (table_name = 'guardians'
--           and column_name in ('phone_norm','user_id','relation'));
--
--   select count(*) filter (where phone_norm is not null) as normalises,
--          count(*) as total
--     from public.guardians;
-- ============================================================================
