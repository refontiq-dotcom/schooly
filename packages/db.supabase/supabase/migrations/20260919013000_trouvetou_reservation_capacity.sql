-- 20260919013000 — Trouvetou: disponibilité et réservation atomiques
-- A appliquer manuellement après 20260919010000_trouvetou_intelligent_media.sql.

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
  v_res record;
  v_capacity bigint;
  v_occupied bigint;
begin
  select * into v_res
    from public.trouvetou_reservations
   where id = p_reservation_id
   for update;

  if not found or v_res.status <> 'pending_payment' then
    return false;
  end if;

  -- Une réservation expirée ne bloque plus une place.
  update public.trouvetou_reservations
     set status = 'expired'
   where school_id = v_res.school_id
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
         qr_code_token = encode(gen_random_bytes(16), 'hex'),
         expires_at = now() + interval '72 hours'
   where id = p_reservation_id;

  return true;
end;
$$;

comment on function public.reserve_seat(uuid, text, bigint) is
  'Réserve une place Trouvetou après paiement en vérifiant la capacité réelle et les réservations encore valides.';
