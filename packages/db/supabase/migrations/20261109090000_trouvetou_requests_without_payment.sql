-- Schooly ↔ Trouvetou : demandes de place sans paiement en ligne.
-- Les demandes ne bloquent pas une place et sont traitées ensuite par l'école.
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

commit;
