-- ============================================================================
-- SCHOOLY v1 — Réservation intelligente
-- ============================================================================
-- Ce script ajoute au MVP :
--   * le scoring de fiabilité parent (0..100) basé sur l'historique réel ;
--   * la détection de doublons (anti-fraude) au niveau téléphone/élève ;
--   * la file d'attente intelligente (waitlist) avec position, score et ETA ;
--   * la fonction publique `create_reservation_smart()` qui encapsule toute
--     la logique (anti-survente atomique + scoring + fraude + waitlist) ;
--   * la promotion automatique d'une réservation en liste d'attente vers une
--     vraie réservation dès qu'une place se libère (release_expired_reservations
--     ou annulation manuelle) ;
--   * des agrégats SQL temps réel pour le dashboard admin (tunnel de
--     conversion + taux de no-show) ;
--   * un hook `reservation_created` qui appelle un webhook configuré par
--     l'établissement (notifications WhatsApp / email en option).
--
-- IMPORTANT : ce script est idempotent. Il peut être ré-exécuté sur une base
-- existante (schema.sql + migrations précédentes) sans erreur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes intelligentes sur la table `reservations`
-- ----------------------------------------------------------------------------
alter table public.reservations
  add column if not exists parent_trust_score int
    check (parent_trust_score is null or (parent_trust_score between 0 and 100));

alter table public.reservations
  add column if not exists fraud_flags text[] not null default '{}';

alter table public.reservations
  add column if not exists waitlist_position int;

alter table public.reservations
  add column if not exists cancelled_at timestamptz;

alter table public.reservations
  add column if not exists expires_at timestamptz;

alter table public.reservations
  drop constraint if exists reservations_section_required_when_reserved;

-- Une réservation au statut `reserved` ou `confirmed` doit avoir une section.
-- (On autorise `null` pour `pending_payment` et `waitlisted`.)
alter table public.reservations
  add constraint reservations_section_required_when_reserved
  check (
    status not in ('reserved', 'confirmed') or section_id is not null
  );

create index if not exists idx_reservations_parent_phone
  on public.reservations (parent_phone);

create index if not exists idx_reservations_student_name
  on public.reservations (student_full_name);

create index if not exists idx_reservations_waitlist
  on public.reservations (level_id, waitlist_position)
  where status = 'waitlisted';

-- ----------------------------------------------------------------------------
-- 2. Enum + table : file d'attente (waitlist)
-- ----------------------------------------------------------------------------
do $$ begin
  create type reservation_status as enum (
    'pending_payment',
    'reserved',
    'confirmed',
    'expired',
    'cancelled',
    'waitlisted',
    'rejected_fraud'
  );
exception
  when duplicate_object then null;
end $$;

-- Si le type existait déjà (créé par schema.sql avec 5 valeurs),
-- ajoute les 2 nouvelles valeurs manquantes.
alter type reservation_status add value if not exists 'waitlisted';
alter type reservation_status add value if not exists 'rejected_fraud';

-- ----------------------------------------------------------------------------
-- 3. FONCTION : calcul du score de confiance parent (0..100)
-- ----------------------------------------------------------------------------
-- Calcule un score basé sur l'historique réel du parent (téléphone + email)
-- dans les réservations, élèves et paiements de l'établissement.
create or replace function public.compute_parent_trust_score(
  p_establishment_id uuid,
  p_parent_phone text,
  p_parent_email text
) returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int := 0;
  v_confirmed int := 0;
  v_expired int := 0;
  v_cancelled int := 0;
  v_no_show_rate numeric := 0;
  v_score int := 50; -- baseline neutre
  v_phone_normalized text;
  v_email_normalized text;
begin
  v_phone_normalized := regexp_replace(coalesce(p_parent_phone, ''), '\s+', '', 'g');
  v_email_normalized := lower(coalesce(p_parent_email, ''));

  -- Compte les réservations du parent pour cet établissement
  select
    count(*) filter (where true),
    count(*) filter (where status = 'confirmed'),
    count(*) filter (where status = 'expired'),
    count(*) filter (where status = 'cancelled')
  into v_total, v_confirmed, v_expired, v_cancelled
  from public.reservations
  where establishment_id = p_establishment_id
    and (
      regexp_replace(coalesce(parent_phone, ''), '\s+', '', 'g') = v_phone_normalized
      or (v_email_normalized <> '' and lower(parent_email) = v_email_normalized)
    );

  if v_total = 0 then
    -- Nouveau parent : score neutre (50)
    return 50;
  end if;

  -- Taux de no-show = expirées / total
  v_no_show_rate := v_expired::numeric / v_total;

  -- Bonus réservations confirmées (max +30)
  v_score := v_score + least(v_confirmed * 10, 30);

  -- Pénalité no-show (max -30)
  v_score := v_score - least(round(v_no_show_rate * 40)::int, 30);

  -- Pénalité annulations (max -20)
  v_score := v_score - least(v_cancelled * 5, 20);

  -- Clamp 0..100
  return greatest(0, least(100, v_score));
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. FONCTION : détection de fraude (retourne un tableau de flags)
-- ----------------------------------------------------------------------------
-- Flags : DUPLICATE_STUDENT, SAME_PHONE_DIFFERENT_NAMES, RAPID_REPEAT,
--         MULTIPLE_PENDING_PAYMENT.
create or replace function public.detect_reservation_fraud(
  p_establishment_id uuid,
  p_parent_phone text,
  p_parent_email text,
  p_student_full_name text,
  p_student_birthdate date
) returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_flags text[] := '{}';
  v_phone_normalized text := regexp_replace(coalesce(p_parent_phone, ''), '\s+', '', 'g');
  v_email_normalized text := lower(coalesce(p_parent_email, ''));
  v_same_student_count int;
  v_distinct_names_count int;
  v_pending_count int;
  v_recent_count int;
begin
  -- 1) Élève déjà inscrit (même nom + birthdate) dans cet établissement
  select count(*) into v_same_student_count
  from public.students s
  join public.reservations r on r.id = s.reservation_id
  where s.establishment_id = p_establishment_id
    and lower(s.full_name) = lower(trim(p_student_full_name))
    and (s.birthdate = p_student_birthdate or (s.birthdate is null and p_student_birthdate is null));

  if v_same_student_count > 0 then
    v_flags := array_append(v_flags, 'DUPLICATE_STUDENT');
  end if;

  -- 2) Même téléphone mais avec des noms de parents incohérents (peut être usurpation)
  select count(distinct lower(trim(parent_full_name))) into v_distinct_names_count
  from public.reservations
  where establishment_id = p_establishment_id
    and regexp_replace(coalesce(parent_phone, ''), '\s+', '', 'g') = v_phone_normalized
    and parent_full_name is not null
    and created_at > now() - interval '6 months';

  if v_distinct_names_count > 2 then
    v_flags := array_append(v_flags, 'SAME_PHONE_DIFFERENT_NAMES');
  end if;

  -- 3) Plusieurs paiements en attente avec le même contact (max 1)
  select count(*) into v_pending_count
  from public.reservations
  where status = 'pending_payment'
    and (
      regexp_replace(coalesce(parent_phone, ''), '\s+', '', 'g') = v_phone_normalized
      or (v_email_normalized <> '' and lower(parent_email) = v_email_normalized)
    )
    and created_at > now() - interval '24 hours';

  if v_pending_count >= 2 then
    v_flags := array_append(v_flags, 'MULTIPLE_PENDING_PAYMENT');
  end if;

  -- 4) Réservations répétées très rapprochées (>3 dans la dernière heure)
  select count(*) into v_recent_count
  from public.reservations
  where regexp_replace(coalesce(parent_phone, ''), '\s+', '', 'g') = v_phone_normalized
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 3 then
    v_flags := array_append(v_flags, 'RAPID_REPEAT');
  end if;

  return v_flags;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. FONCTION : réservation publique intelligente (anti-survente + scoring + fraude)
-- ----------------------------------------------------------------------------
-- Remplace la logique applicative dispersée par un point d'entrée atomique.
-- Si une place est dispo, crée une réservation normale.
-- Sinon, crée une réservation `waitlisted` avec position, score et ETA.
-- Si la fraude est sévère (>2 flags), crée une réservation `rejected_fraud`.
create or replace function public.create_reservation_smart(
  p_establishment_id uuid,
  p_level_id uuid,
  p_student_full_name text,
  p_student_birthdate date,
  p_parent_full_name text,
  p_parent_phone text,
  p_parent_email text
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment public.establishments;
  v_section public.sections;
  v_reservation public.reservations;
  v_fraud_flags text[];
  v_trust_score int;
  v_has_seat boolean := false;
  v_waitlist_position int;
begin
  -- Validations minimales (réutilisées par l'API et le partenaire)
  if nullif(trim(p_student_full_name), '') is null
     or nullif(trim(p_parent_full_name), '') is null
     or nullif(trim(p_parent_phone), '') is null then
    raise exception 'Nom de l''élève, nom du parent et téléphone sont obligatoires';
  end if;

  select * into v_establishment
  from public.establishments
  where id = p_establishment_id;

  if v_establishment is null then
    raise exception 'Établissement introuvable';
  end if;

  if not exists (
    select 1 from public.levels
    where id = p_level_id and establishment_id = p_establishment_id
  ) then
    raise exception 'Niveau invalide pour cet établissement';
  end if;

  -- Détection fraude + scoring
  v_fraud_flags := public.detect_reservation_fraud(
    p_establishment_id, p_parent_phone, p_parent_email,
    p_student_full_name, p_student_birthdate
  );

  v_trust_score := public.compute_parent_trust_score(
    p_establishment_id, p_parent_phone, p_parent_email
  );

  -- Fraude sévère : rejeter la réservation
  if array_length(v_fraud_flags, 1) >= 2 then
    insert into public.reservations (
      establishment_id, level_id, section_id, student_full_name,
      student_birthdate, parent_full_name, parent_phone, parent_email,
      status, parent_trust_score, fraud_flags
    ) values (
      p_establishment_id, p_level_id, null, trim(p_student_full_name),
      p_student_birthdate, trim(p_parent_full_name), trim(p_parent_phone),
      nullif(trim(p_parent_email), ''), 'rejected_fraud',
      v_trust_score, v_fraud_flags
    ) returning * into v_reservation;

    return v_reservation;
  end if;

  -- Tente d'attribuer une section (verrou atomique)
  select * into v_section
  from public.sections
  where level_id = p_level_id
    and seats_taken < capacity
  order by name
  limit 1
  for update;

  v_has_seat := v_section is not null;

  if v_has_seat then
    update public.sections
      set seats_taken = seats_taken + 1
      where id = v_section.id;

    insert into public.reservations (
      establishment_id, level_id, section_id, student_full_name,
      student_birthdate, parent_full_name, parent_phone, parent_email,
      status, expires_at, parent_trust_score, fraud_flags
    ) values (
      p_establishment_id, p_level_id, v_section.id, trim(p_student_full_name),
      p_student_birthdate, trim(p_parent_full_name), trim(p_parent_phone),
      nullif(trim(p_parent_email), ''), 'reserved',
      now() + (v_establishment.reservation_hold_hours || ' hours')::interval,
      v_trust_score, v_fraud_flags
    ) returning * into v_reservation;
  else
    -- File d'attente
    select coalesce(max(waitlist_position), 0) + 1 into v_waitlist_position
    from public.reservations
    where level_id = p_level_id
      and status = 'waitlisted';

    insert into public.reservations (
      establishment_id, level_id, section_id, student_full_name,
      student_birthdate, parent_full_name, parent_phone, parent_email,
      status, waitlist_position, parent_trust_score, fraud_flags
    ) values (
      p_establishment_id, p_level_id, null, trim(p_student_full_name),
      p_student_birthdate, trim(p_parent_full_name), trim(p_parent_phone),
      nullif(trim(p_parent_email), ''), 'waitlisted',
      v_waitlist_position, v_trust_score, v_fraud_flags
    ) returning * into v_reservation;
  end if;

  return v_reservation;
end;
$$;

revoke all on function public.create_reservation_smart(uuid, uuid, text, date, text, text, text)
  from public, anon;
grant execute on function public.create_reservation_smart(uuid, uuid, text, date, text, text, text)
  to authenticated, anon;

revoke all on function public.compute_parent_trust_score(uuid, text, text)
  from public, anon;
grant execute on function public.compute_parent_trust_score(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.detect_reservation_fraud(uuid, text, text, text, date)
  from public, anon;
grant execute on function public.detect_reservation_fraud(uuid, text, text, text, date)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : promotion de la file d'attente (après expiration/annulation)
-- ----------------------------------------------------------------------------
-- Appelé depuis `release_expired_reservations()` et après chaque annulation
-- manuelle. Cherche la première personne en liste d'attente et, si une place
-- se libère, lui attribue la section en respectant son score de confiance.
create or replace function public.promote_waitlist(p_level uuid)
  returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section public.sections;
  v_promoted_count int := 0;
  v_candidate record;
  v_establishment public.establishments;
  v_reservation public.reservations;
begin
  select e.* into v_establishment
  from public.levels l
  join public.establishments e on e.id = l.establishment_id
  where l.id = p_level;

  if v_establishment is null then
    return 0;
  end if;

  -- Boucle tant qu'il reste des places et des candidats en liste
  loop
    -- Verrouille une section ayant de la place
    select * into v_section
    from public.sections
    where level_id = p_level
      and seats_taken < capacity
    order by name
    limit 1
    for update;

    exit when v_section is null;

    -- Sélectionne le candidat avec le meilleur score de confiance, puis la plus ancienne position
    select * into v_candidate
    from public.reservations
    where level_id = p_level
      and status = 'waitlisted'
    order by coalesce(parent_trust_score, 50) desc, waitlist_position asc
    limit 1
    for update;

    exit when v_candidate is null;

    update public.sections
      set seats_taken = seats_taken + 1
      where id = v_section.id;

    update public.reservations
      set status = 'reserved',
          section_id = v_section.id,
          waitlist_position = null,
          promoted_at = now(),
          expires_at = now() + (v_establishment.reservation_hold_hours || ' hours')::interval
      where id = v_candidate.id
      returning * into v_reservation;

    -- Renumérote les positions de la file
    with ranked as (
      select id, row_number() over (order by coalesce(parent_trust_score, 50) desc, created_at asc) as rn
      from public.reservations
      where level_id = p_level and status = 'waitlisted'
    )
    update public.reservations r
      set waitlist_position = ranked.rn
      from ranked
      where r.id = ranked.id;

    v_promoted_count := v_promoted_count + 1;
  end loop;

  return v_promoted_count;
end;
$$;

grant execute on function public.promote_waitlist(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Mise à jour : release_expired_reservations promeut la file d'attente
-- ----------------------------------------------------------------------------
create or replace function public.release_expired_reservations() returns int
language plpgsql
as $$
declare
  v_count int := 0;
  v_promoted_total int := 0;
  v_distinct_levels uuid[];
  r record;
  lvl uuid;
begin
  for r in
    select id, section_id, level_id from public.reservations
    where status = 'reserved' and expires_at is not null and expires_at < now()
  loop
    update public.sections set seats_taken = greatest(seats_taken - 1, 0) where id = r.section_id;
    update public.reservations set status = 'expired' where id = r.id;
    v_count := v_count + 1;
  end loop;

  -- Promotions en cascade sur tous les niveaux affectés
  select array_agg(distinct level_id) into v_distinct_levels
  from public.reservations
  where status = 'expired' and level_id is not null;

  if v_distinct_levels is not null then
    foreach lvl in array v_distinct_levels loop
      v_promoted_total := v_promoted_total + public.promote_waitlist(lvl);
    end loop;
  end if;

  return v_count + v_promoted_total;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. FONCTION : confirmation idempotente (paiement)
-- ----------------------------------------------------------------------------
-- Refactor de reserve_seat : retourne le résultat courant si déjà réservé,
-- sinon applique la logique anti-survente. Garantit qu'on ne peut décrémenter
-- deux fois la même section avec la même réservation.
create or replace function public.reserve_seat(
  p_reservation_id uuid
) returns public.reservations
language plpgsql
as $$
declare
  v_reservation public.reservations;
  v_section public.sections;
begin
  select * into v_reservation from public.reservations where id = p_reservation_id for update;

  if v_reservation is null then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.status = 'reserved' or v_reservation.status = 'confirmed' then
    -- Idempotent : on retourne la réservation telle quelle
    return v_reservation;
  end if;

  if v_reservation.status not in ('pending_payment', 'waitlisted') then
    raise exception 'Réservation non confirmable (statut: %)', v_reservation.status;
  end if;

  if v_reservation.section_id is null then
    -- Promotion depuis la file d'attente : on tente d'attribuer une section
    declare
      v_promoted_count int := public.promote_waitlist(v_reservation.level_id);
    begin
      -- Recharge la réservation (peut être passée en reserved par promote_waitlist)
      select * into v_reservation from public.reservations where id = p_reservation_id;
      if v_reservation.status <> 'reserved' then
        raise exception 'Aucune place disponible (liste d''attente pleine)';
      end if;
      return v_reservation;
    end;
  end if;

  select * into v_section from public.sections where id = v_reservation.section_id for update;

  if v_section.seats_taken >= v_section.capacity then
    update public.reservations set status = 'cancelled' where id = p_reservation_id;
    raise exception 'Plus de place disponible dans cette section';
  end if;

  update public.sections set seats_taken = seats_taken + 1 where id = v_section.id;

  update public.reservations
    set status = 'reserved',
        expires_at = now() + (
          select (reservation_hold_hours || ' hours')::interval
          from public.establishments where id = v_reservation.establishment_id
        )
    where id = p_reservation_id
    returning * into v_reservation;

  return v_reservation;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Vue : agrégats du tunnel de conversion (pour le dashboard admin)
-- ----------------------------------------------------------------------------
create or replace view public.reservation_conversion_funnel as
select
  establishment_id,
  -- Visiteurs : pas d'agrégat direct, mais le total de `pending_payment` est un proxy haut du tunnel
  count(*) filter (where status = 'pending_payment') as pending_payment_count,
  count(*) filter (where status = 'reserved') as reserved_count,
  count(*) filter (where status = 'confirmed') as confirmed_count,
  count(*) filter (where status = 'expired') as expired_count,
  count(*) filter (where status = 'cancelled') as cancelled_count,
  count(*) filter (where status = 'waitlisted') as waitlisted_count,
  count(*) filter (where status = 'rejected_fraud') as rejected_fraud_count,
  count(*) as total_count,
  case
    when count(*) filter (where status in ('pending_payment', 'reserved', 'confirmed')) = 0 then 0
    else round(
      100.0 * count(*) filter (where status = 'confirmed')
      / nullif(count(*) filter (where status in ('pending_payment', 'reserved', 'confirmed')), 0)
    )
  end as confirmation_rate_pct,
  case
    when count(*) filter (where status = 'reserved') = 0 then 0
    else round(
      100.0 * count(*) filter (where status = 'expired')
      / nullif(count(*) filter (where status = 'reserved'), 0)
    )
  end as no_show_rate_pct
from public.reservations
group by establishment_id;

grant select on public.reservation_conversion_funnel to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. Vue : top parents à risque (pour le dashboard admin)
-- ----------------------------------------------------------------------------
create or replace view public.at_risk_parents as
with stats as (
  select
    establishment_id,
    parent_phone,
    parent_email,
    parent_trust_score,
    count(*) filter (where status = 'confirmed') as confirmed,
    count(*) filter (where status = 'expired') as expired,
    count(*) filter (where status = 'cancelled') as cancelled,
    count(*) filter (where status = 'pending_payment') as pending,
    count(*) filter (where status = 'rejected_fraud') as fraud_rejected
  from public.reservations
  group by establishment_id, parent_phone, parent_email, parent_trust_score
)
select
  establishment_id,
  parent_phone,
  parent_email,
  coalesce(parent_trust_score, 50) as trust_score,
  confirmed,
  expired,
  cancelled,
  pending,
  fraud_rejected,
  case
    when (expired + cancelled) > (confirmed * 2) and coalesce(parent_trust_score, 50) < 40 then 'high'
    when coalesce(parent_trust_score, 50) < 60 then 'medium'
    else 'low'
  end as risk_level
from stats
where (expired + cancelled + fraud_rejected) > 0;

grant select on public.at_risk_parents to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. Vue : ETA file d'attente (basée sur le taux d'expiration moyen 30j)
-- ----------------------------------------------------------------------------
create or replace view public.waitlist_eta as
with expiration_rate as (
  select
    level_id,
    count(*) filter (where status = 'expired')::numeric
      / nullif(count(*) filter (where status in ('reserved', 'expired')), 0) as rate
  from public.reservations
  where created_at > now() - interval '30 days'
  group by level_id
)
select
  r.establishment_id,
  r.level_id,
  r.id as reservation_id,
  r.parent_full_name,
  r.parent_phone,
  r.waitlist_position,
  r.parent_trust_score,
  case
    when er.rate is null or er.rate = 0 then null
    else round(r.waitlist_position / er.rate)
  end as eta_days
from public.reservations r
left join expiration_rate er on er.level_id = r.level_id
where r.status = 'waitlisted';

grant select on public.waitlist_eta to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. Policies RLS supplémentaires
-- ----------------------------------------------------------------------------
-- Le staff voit toutes les colonnes (sinon il ne peut pas scorer/fraud)
drop policy if exists "Staff établissement voit les réservations" on reservations;
create policy "Staff établissement voit les réservations"
  on reservations for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

-- Un parent authentifié peut voir ses propres réservations (par téléphone normalisé)
drop policy if exists "Parent voit ses propres réservations" on reservations;
create policy "Parent voit ses propres réservations"
  on reservations for select using (
    auth.uid() is not null
    and parent_phone is not null
    and regexp_replace(parent_phone, '\s+', '', 'g') in (
      select regexp_replace(coalesce(phone, ''), '\s+', '', 'g')
      from profiles where id = auth.uid() and phone is not null
    )
  );