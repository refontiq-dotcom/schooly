-- 20260923000000 — P2-1 : drain outbox (claim atomique + index)
--
-- Le worker /api/cron/outbox-drain réclame ses lignes via
-- claim_outbox_batch (FOR UPDATE SKIP LOCKED) : deux instances Vercel qui
-- se chevauchent ne traitent jamais la même ligne deux fois.
-- p_channel : le worker WhatsApp ne réclame que ses lignes — les canaux
-- non gérés (sms/email) restent pending intacts (attempts non incrémentés)
-- pour un futur worker dédié, et ne peuvent pas affamer le batch.
-- L'index partiel évite le full scan toutes les 5 minutes.
--
-- Idempotent : OR REPLACE + IF NOT EXISTS, rejouable sans risque.

create or replace function public.claim_outbox_batch(
  p_limit int default 25,
  p_channel text default null
)
returns table (
  id uuid,
  school_id uuid,
  recipient_phone text,
  channel text,
  template_key text,
  payload jsonb,
  attempts int,
  max_attempts int
)
language sql
security definer
set search_path = public
as $$
  update public.notification_outbox o
    set attempts = o.attempts + 1
    where o.id in (
      select q.id
        from public.notification_outbox q
        where q.status = 'pending'
          and q.scheduled_at <= now()
          and q.attempts < q.max_attempts
          and q.deleted_at is null
          and (p_channel is null or q.channel = p_channel)
        order by q.scheduled_at asc
        limit p_limit
        for update skip locked
    )
  returning
    o.id, o.school_id, o.recipient_phone, o.channel,
    o.template_key, o.payload, o.attempts, o.max_attempts;
$$;

revoke execute on function public.claim_outbox_batch(int, text)
  from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(int, text)
  to service_role;

create index if not exists idx_outbox_drain
  on public.notification_outbox (scheduled_at)
  where status = 'pending' and deleted_at is null;
