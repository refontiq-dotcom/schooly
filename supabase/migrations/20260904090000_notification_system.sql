-- ============================================================================
-- SCHOOLY v1 — Notifications automatiques
-- ============================================================================
-- Ajoute :
--   * table `notifications` (file d'envoi pour email / WhatsApp / in-app) ;
--   * table `notification_rules` (configuration par établissement) ;
--   * fonction `dispatch_schooly_notifications()` qui détecte les 3 alertes :
--       1. Élève/frère à risque paiement élevé (payment_risk_score >= 60) ;
--       2. Incident grave d'internat non résolu ;
--       3. Niveau à 100 % de remplissage (plus de place).
--     et crée les enregistrements de notification en attente.
--   * La fonction est idempotente et conçue pour être appelée via pg_cron
--     (1×/jour) ou depuis l'Edge Function schooly-notifications.
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type notification_channel as enum ('email', 'whatsapp', 'in_app');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notification_status as enum ('pending', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notification_alert_type as enum (
    'high_payment_risk',
    'unresolved_grave_incident',
    'level_full_capacity'
  );
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Table : règles de notification (activation par établissement)
-- ----------------------------------------------------------------------------
create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  alert_type notification_alert_type not null,
  enabled boolean not null default true,
  channel notification_channel not null default 'email',
  recipient_role user_role,
  cooldown_days int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, alert_type)
);

create index if not exists idx_notification_rules_estab
  on public.notification_rules (establishment_id, alert_type);

-- ----------------------------------------------------------------------------
-- 3. Table : file de notifications
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  alert_type notification_alert_type not null,
  channel notification_channel not null,
  recipient_id uuid references public.profiles(id) on delete set null,
  recipient_phone text,
  recipient_email text,
  subject text not null,
  body text not null,
  status notification_status not null default 'pending',
  sent_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_pending
  on public.notifications (establishment_id, status, created_at)
  where status = 'pending';

create index if not exists idx_notifications_recipient
  on public.notifications (recipient_id, created_at desc);

create index if not exists idx_notifications_alert
  on public.notifications (alert_type, establishment_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Fonction : détection + création de notifications (idempotente)
-- ----------------------------------------------------------------------------
-- Crée une notification par alerte détectée. Évite les doublons récents via
-- `metadata` + fenêtre de cooldown (la règle définit cooldown_days).
create or replace function public.dispatch_schooly_notifications(
  p_establishment_id uuid default null
) returns jsonb
language plpgsql
as $$
declare
  v_rule record;
  v_recipient record;
  v_existing int;
  v_created int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  for v_rule in
    select r.*
    from public.notification_rules r
    where r.enabled
      and (p_establishment_id is null or r.establishment_id = p_establishment_id)
  loop
    case v_rule.alert_type
      -- 1) Élèves / familles à risque paiement élevé
      when 'high_payment_risk' then
        for v_recipient in
          select
            s.id as student_id,
            s.full_name,
            s.parent_id,
            s.parent_phone,
            sf.amount - sf.amount_paid as remaining,
            sf.payment_risk_score
          from public.student_fees sf
          join public.students s on s.id = sf.student_id
          where sf.establishment_id = v_rule.establishment_id
            and sf.status in ('pending', 'overdue', 'partial')
            and sf.payment_risk_score >= 60
            and (
              p_establishment_id is null
              or s.establishment_id = p_establishment_id
            )
            and s.parent_phone is not null
        loop
          -- Idempotence : pas de notification identique dans la fenêtre de cooldown
          v_existing := 0;
          select count(*) into v_existing
          from public.notifications n
          where n.establishment_id = v_rule.establishment_id
            and n.alert_type = 'high_payment_risk'
            and n.metadata->>'student_id' = v_recipient.student_id::text
            and n.created_at > now() - (v_rule.cooldown_days || ' days')::interval;

          if v_existing = 0 then
            insert into public.notifications (
              establishment_id, alert_type, channel, recipient_id,
              recipient_phone, recipient_email, subject, body, metadata
            ) values (
              v_rule.establishment_id,
              'high_payment_risk',
              v_rule.channel,
              v_recipient.parent_id,
              nullif(v_recipient.parent_phone, ''),
              null,
              'Rappel : échéance en souffrance',
              'Bonjour, nous vous prions de régulariser le paiement restant de '
                || round(v_recipient.remaining) || ' FCFA pour ' || v_recipient.full_name
                || '. Un retard de paiement répété peut affecter l''inscription de votre enfant.',
              jsonb_build_object(
                'student_id', v_recipient.student_id,
                'student_name', v_recipient.full_name,
                'remaining', v_recipient.remaining,
                'risk_score', coalesce(v_recipient.payment_risk_score, 0)
              )
            );
            v_created := v_created + 1;
          end if;
        end loop;

      when 'unresolved_grave_incident' then
          for v_recipient in
          select
            i.id as incident_id,
            i.title,
            i.description,
            s.full_name as student_name,
            i.severity,
            i.category,
            i.created_at as incident_created_at
          from public.internat_incidents i
          join public.students s on s.id = i.student_id
          where i.severity = 'grave'
            and i.resolved_at is null
        loop
          v_existing := 0;
          select count(*) into v_existing
          from public.notifications n
          where n.establishment_id = v_rule.establishment_id
            and n.alert_type = 'unresolved_grave_incident'
            and n.metadata->>'incident_id' = v_recipient.incident_id::text
            and n.created_at > now() - (v_rule.cooldown_days || ' days')::interval;

          if v_existing = 0 then
            insert into public.notifications (
              establishment_id, alert_type, channel, recipient_id,
              recipient_phone, recipient_email,
              subject, body, metadata
            ) values (
              v_rule.establishment_id,
              'unresolved_grave_incident',
              v_rule.channel,
              null,
              null,
              null,
              'Alerte : incident grave non résolu',
              v_recipient.student_name || ' — ' || v_recipient.title
                || '. Incident de gravité « ' || v_recipient.severity || ' » signalé le '
                || v_recipient.incident_created_at::date
                || ' non résolu. Action requise.',
              jsonb_build_object(
                'incident_id', v_recipient.incident_id,
                'student_name', v_recipient.student_name,
                'title', v_recipient.title,
                'severity', v_recipient.severity,
                'category', v_recipient.category
              )
            );
            v_created := v_created + 1;
          end if;
        end loop;

      when 'level_full_capacity' then
        for v_recipient in
          select
            l.id as level_id,
            l.name as level_name,
            c.total_sections,
            c.full_sections_count,
            c.fill_rate_pct
          from public.levels l
          join public.class_capacity_summary c on c.establishment_id = l.establishment_id
          where l.establishment_id = v_rule.establishment_id
            and c.fill_rate_pct >= 100
        loop
          v_existing := 0;
          select count(*) into v_existing
          from public.notifications n
          where n.establishment_id = v_rule.establishment_id
            and n.alert_type = 'level_full_capacity'
            and n.metadata->>'level_id' = v_recipient.level_id::text
            and n.created_at > now() - (v_rule.cooldown_days || ' days')::interval;

          if v_existing = 0 then
            insert into public.notifications (
              establishment_id, alert_type, channel, recipient_id,
              recipient_phone, recipient_email,
              subject, body, metadata
            ) values (
              v_rule.establishment_id,
              'level_full_capacity',
              v_rule.channel,
              null,
              null,
              null,
              'Niveau complet : ' || v_recipient.level_name,
              'Le niveau ' || v_recipient.level_name || ' de votre établissement est à 100 % de remplissage ('
                || v_recipient.fill_rate_pct || '%). Activez la file d''attente ou ajoutez une section.',
              jsonb_build_object(
                'level_id', v_recipient.level_id,
                'level_name', v_recipient.level_name,
                'fill_rate_pct', v_recipient.fill_rate_pct,
                'full_sections_count', v_recipient.full_sections_count
              )
            );
            v_created := v_created + 1;
          end if;
        end loop;
    end case;

    v_results := v_results || jsonb_build_object(
      'rule_id', v_rule.id,
      'alert_type', v_rule.alert_type,
      'channel', v_rule.channel,
      'created', v_created
    );
    v_created := 0;
  end loop;

  return jsonb_build_object(
    'dispatched_at', now(),
    'establishment_id', p_establishment_id,
    'rules_processed', jsonb_array_length(v_results),
    'details', v_results
  );
end;
$$;

grant execute on function public.dispatch_schooly_notifications(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RLS + grants
-- ----------------------------------------------------------------------------
alter table public.notification_rules enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Staff voit les règles de notification" on public.notification_rules;
create policy "Staff voit les règles de notification"
  on public.notification_rules for select
  using (
    establishment_id in (
      select establishment_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Admin gère les règles de notification" on public.notification_rules;
create policy "Admin gère les règles de notification"
  on public.notification_rules for all
  using (
    establishment_id in (
      select establishment_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    establishment_id in (
      select establishment_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Staff voit les notifications" on public.notifications;
create policy "Staff voit les notifications"
  on public.notifications for select
  using (
    establishment_id in (
      select establishment_id from public.profiles where id = auth.uid()
    )
  );

grant select, insert on public.notifications to authenticated;
grant select, insert, update on public.notifications to service_role;
grant select, insert, update on public.notification_rules to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Règles de notification par défaut (seed) pour chaque établissement
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select id from public.establishments
  loop
    insert into public.notification_rules (establishment_id, alert_type, channel, recipient_role, cooldown_days)
    values
      (r.id, 'high_payment_risk', 'email', 'secretariat', 1),
      (r.id, 'unresolved_grave_incident', 'email', 'admin', 0),
      (r.id, 'level_full_capacity', 'in_app', 'admin', 0)
     on conflict (establishment_id, alert_type) do nothing;
   end loop;
 end $$;

-- ----------------------------------------------------------------------------
-- 7. Cron (pg_cron) — exécution quotidienne de la détection d'alertes
-- ----------------------------------------------------------------------------
-- Nécessite l'extension pg_cron activée sur le projet Supabase hébergé
-- (Settings → Database → Extensions → pg_cron). Si l'extension n'est pas
-- disponible, la fonction dispatch_schooly_notifications() reste invoquable
-- depuis l'Edge Function schooly-notifications (planification HTTP).
-- ----------------------------------------------------------------------------
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'schooly_notifications_dispatch',
    '15 7 * * *', -- tous les jours à 07h15 (avant l'école)
    $cron$select public.dispatch_schooly_notifications()$cron$
  );
exception when others then
  -- pg_cron non disponible : la planification se fait via l'Edge Function.
  null;
end $$;

