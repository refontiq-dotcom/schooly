-- Schooly ↔ Trouvetou : réservation sans paiement en ligne.
-- Une place disponible est réservée immédiatement ; l'inscription définitive
-- reste effectuée plus tard directement auprès de l'établissement.
begin;

alter table public.trouvetou_reservations
  drop constraint if exists trouvetou_reservations_status_check;

alter table public.trouvetou_reservations
  add constraint trouvetou_reservations_status_check
  check (status in ('pending_payment', 'requested', 'reserved', 'confirmed', 'expired'));

alter table public.trouvetou_reservations
  add column if not exists external_idempotency_key uuid null;

create unique index if not exists trouvetou_reservations_school_external_idempotency_key
  on public.trouvetou_reservations (school_id, external_idempotency_key)
  where external_idempotency_key is not null;

-- Sérialise les réservations concurrentes du même niveau en verrouillant
-- la ligne grade_levels avant de recalculer la capacité réelle.
-- p_payment_ref et p_amount peuvent être NULL : aucune transaction en ligne
-- n'est exigée pour le parcours Trouvetou actuel.
create or replace function public.reserve_seat(
  p_reservation_id uuid,
  p_payment_ref text,
  p_amount bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.trouvetou_reservations%rowtype;
  v_locked_grade_level uuid;
  v_capacity bigint;
  v_occupied bigint;
begin
  select *
    into v_res
    from public.trouvetou_reservations
   where id = p_reservation_id
   for update;

  if not found or v_res.status <> 'pending_payment' then
    return false;
  end if;

  -- Point de verrou partagé par toutes les demandes du même niveau.
  select gl.id
    into v_locked_grade_level
    from public.grade_levels gl
   where gl.id = v_res.grade_level_id
     and gl.school_id = v_res.school_id
     and gl.deleted_at is null
   for update;

  if not found then
    return false;
  end if;

  update public.trouvetou_reservations
     set status = 'expired'
   where school_id = v_res.school_id
     and grade_level_id = v_res.grade_level_id
     and status = 'reserved'
     and expires_at is not null
     and expires_at <= now();

  select coalesce(sum(c.capacity), 0)
    into v_capacity
    from public.classes c
   where c.school_id = v_res.school_id
     and c.grade_level_id = v_res.grade_level_id
     and c.deleted_at is null;

  if v_capacity <= 0 then
    return false;
  end if;

  select
    coalesce((
      select count(*)
        from public.enrollments e
       where e.school_id = v_res.school_id
         and e.grade_level_id = v_res.grade_level_id
         and e.status in ('confirmed', 'active')
         and e.deleted_at is null
    ), 0)
    +
    coalesce((
      select count(*)
        from public.trouvetou_reservations r
       where r.school_id = v_res.school_id
         and r.grade_level_id = v_res.grade_level_id
         and r.status = 'reserved'
         and r.expires_at > now()
         and r.id <> v_res.id
    ), 0)
    into v_occupied;

  if v_occupied >= v_capacity then
    return false;
  end if;

  update public.trouvetou_reservations
     set status = 'reserved',
         payment_reference = p_payment_ref,
         amount_paid = p_amount,
         qr_code_token = encode(extensions.gen_random_bytes(16), 'hex'),
         expires_at = now() + interval '72 hours'
   where id = p_reservation_id;

  return true;
end;
$$;

revoke execute on function public.reserve_seat(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.reserve_seat(uuid, text, bigint) to service_role;

comment on function public.reserve_seat(uuid, text, bigint) is
  'Réserve atomiquement une place Trouvetou pour 72 heures. Le paiement est facultatif ; appeler avec NULL et NULL pour une réservation sans paiement en ligne. Appel serveur uniquement.';

commit;
