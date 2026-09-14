-- ============================================================================
-- SCHOOLY v1 — Messagerie intelligence
-- ============================================================================
-- Ajoute au module Messagerie :
--   * vue résumé non-lus par destinataire ;
--   * vue dashboard d'activité (volume, fréquence) ;
--   * vue threads (dernier message par conversation sender↔recipient) ;
--   * vue engagement (% lecture par parent) ;
--   * vue messages urgents non répondus ;
--   * fonction de marquage en lot (read receipts).
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : résumé non-lus par destinataire
-- ----------------------------------------------------------------------------
create or replace view public.messages_unread_summary as
select
  m.recipient_id,
  p.full_name as recipient_name,
  p.role as recipient_role,
  p.establishment_id,
  count(*) as unread_count,
  max(m.created_at) as last_unread_at
from public.messages m
join public.profiles p on p.id = m.recipient_id
where m.read_at is null
group by m.recipient_id, p.full_name, p.role, p.establishment_id
order by unread_count desc;

grant select on public.messages_unread_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : dashboard d'activité messagerie
-- ----------------------------------------------------------------------------
create or replace view public.messages_activity_dashboard as
with per_est as (
  select
    establishment_id,
    count(*) as total_messages,
    count(*) filter (where created_at > current_date - interval '24 hours') as messages_24h,
    count(*) filter (where created_at > current_date - interval '7 days') as messages_7d,
    count(*) filter (where created_at > current_date - interval '30 days') as messages_30d,
    count(*) filter (where read_at is not null) as read_count,
    count(*) filter (where read_at is null) as unread_count,
    count(*) filter (where read_at is not null and created_at < current_date - interval '7 days') as late_reads,
    count(*) filter (where read_at is null and created_at < current_date - interval '48 hours') as unanswered_48h
  from public.messages
  group by establishment_id
)
select
  e.id as establishment_id,
  e.name as establishment_name,
  coalesce(pe.total_messages, 0) as total_messages,
  coalesce(pe.messages_24h, 0) as messages_24h,
  coalesce(pe.messages_7d, 0) as messages_7d,
  coalesce(pe.messages_30d, 0) as messages_30d,
  coalesce(pe.read_count, 0) as read_count,
  coalesce(pe.unread_count, 0) as unread_count,
  case when coalesce(pe.total_messages, 0) = 0 then null
    else round(100.0 * pe.read_count / pe.total_messages)
  end as read_rate_pct,
  coalesce(pe.late_reads, 0) as late_reads,
  coalesce(pe.unanswered_48h, 0) as unanswered_48h
from public.establishments e
left join per_est pe on pe.establishment_id = e.id;

grant select on public.messages_activity_dashboard to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : threads (dernier message par conversation sender↔recipient)
-- ----------------------------------------------------------------------------
create or replace view public.messages_threads as
with paired as (
  select
    m.establishment_id,
    least(m.sender_id, m.recipient_id) as user_a,
    greatest(m.sender_id, m.recipient_id) as user_b,
    m.id,
    m.subject,
    m.body,
    m.read_at,
    m.created_at,
    m.sender_id,
    m.recipient_id,
    row_number() over (
      partition by least(m.sender_id, m.recipient_id), greatest(m.sender_id, m.recipient_id)
      order by m.created_at desc
    ) as rn
  from public.messages m
  where m.recipient_id is not null
)
select
  p.establishment_id,
  p.user_a,
  p.user_b,
  pa.full_name as user_a_name,
  pb.full_name as user_b_name,
  p.id as last_message_id,
  p.subject,
  p.body as last_body,
  p.read_at as last_read_at,
  p.created_at as last_message_at,
  p.sender_id as last_sender_id,
  exists (
    select 1 from public.messages m
    where m.establishment_id = p.establishment_id
      and least(m.sender_id, m.recipient_id) = p.user_a
      and greatest(m.sender_id, m.recipient_id) = p.user_b
      and m.read_at is null
      and m.recipient_id = auth.uid()
  ) as has_unread_for_me
from paired p
left join public.profiles pa on pa.id = p.user_a
left join public.profiles pb on pb.id = p.user_b
where p.rn = 1
order by p.created_at desc;

grant select on public.messages_threads to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : engagement (% lecture par destinataire)
-- ----------------------------------------------------------------------------
create or replace view public.messages_engagement as
select
  p.id as user_id,
  p.establishment_id,
  p.full_name,
  p.role,
  count(m.id) as total_received,
  count(m.id) filter (where m.read_at is not null) as total_read,
  count(m.id) filter (where m.read_at is null) as total_unread,
  case when count(m.id) = 0 then null
    else round(100.0 * count(m.id) filter (where m.read_at is not null) / count(m.id))
  end as read_rate_pct,
  case
    when count(m.id) = 0 then 'no_data'
    when count(m.id) filter (where m.read_at is not null)::numeric / count(m.id) >= 0.8 then 'engaged'
    when count(m.id) filter (where m.read_at is not null)::numeric / count(m.id) >= 0.5 then 'normal'
    else 'low_engagement'
  end as engagement_level
from public.profiles p
left join public.messages m on m.recipient_id = p.id
group by p.id, p.establishment_id, p.full_name, p.role
having count(m.id) > 0;

grant select on public.messages_engagement to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : messages urgents non répondus (>48h + mots-clés)
-- ----------------------------------------------------------------------------
create or replace view public.messages_unanswered_urgent as
select
  m.id,
  m.establishment_id,
  m.sender_id,
  sender.full_name as sender_name,
  m.recipient_id,
  recipient.full_name as recipient_name,
  m.student_id,
  s.full_name as student_name,
  m.subject,
  m.body,
  m.created_at,
  extract(epoch from (now() - m.created_at)) / 3600 as hours_since_sent,
  case
    when m.body ~* '\m(urgent|important|immédiat|rapidement|asap)\M' then 'keyword'
    when m.subject ~* '\m(urgent|important|immédiat)\M' then 'keyword_subject'
    else 'late_only'
  end as urgency_source
from public.messages m
join public.profiles sender on sender.id = m.sender_id
left join public.profiles recipient on recipient.id = m.recipient_id
left join public.students s on s.id = m.student_id
where m.read_at is null
  and m.created_at < current_date - interval '48 hours'
  and (
    m.body ~* '\m(urgent|important|immédiat|rapidement|asap)\M'
    or m.subject ~* '\m(urgent|important|immédiat)\M'
  )
order by m.created_at;

grant select on public.messages_unanswered_urgent to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : marquage en lot
-- ----------------------------------------------------------------------------
create or replace function public.mark_messages_read(
  p_message_ids uuid[],
  p_reader_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.messages
  set read_at = now()
  where id = any(p_message_ids)
    and recipient_id = p_reader_id
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

grant execute on function public.mark_messages_read(uuid[], uuid) to authenticated, service_role;
