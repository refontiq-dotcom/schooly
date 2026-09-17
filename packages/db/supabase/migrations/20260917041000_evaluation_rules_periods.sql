-- Évaluation, lot 1. Les notes historiques restent sans période.
begin;
create table public.evaluation_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  cycle text not null default '*' check (length(trim(cycle)) > 0),
  mode text not null check (mode in ('TRIMESTRE','SEMESTRE','COMPOSITION_PRIMAIRE')),
  scale numeric not null check (scale > 0 and scale < 1000000),
  threshold numeric not null check (threshold >= 0 and threshold <= scale),
  rescue_margin numeric not null default 0 check (rescue_margin >= 0 and rescue_margin <= threshold),
  interrogation_percent numeric,
  devoir_percent numeric,
  composition_percent numeric,
  created_at timestamptz not null default now(),
  unique (school_id, academic_year_id, cycle),
  check ((interrogation_percent is null and devoir_percent is null and composition_percent is null)
    or (interrogation_percent is not null and devoir_percent is not null and composition_percent is not null
      and interrogation_percent >= 0 and devoir_percent >= 0 and composition_percent >= 0
      and interrogation_percent + devoir_percent + composition_percent = 100))
);
create table public.evaluation_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  rule_id uuid not null references public.evaluation_rules(id),
  label text not null check (length(trim(label)) > 0),
  position integer not null check (position > 0),
  is_passage boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at),
  unique (rule_id, position)
);
create unique index evaluation_one_passage on public.evaluation_periods(rule_id) where is_passage;
create index evaluation_periods_school on public.evaluation_periods(school_id, rule_id);

alter table public.grade_entries add column period_id uuid references public.evaluation_periods(id);
alter table public.grade_entries add column absence_status text not null default 'graded'
  check (absence_status in ('graded','excused'));
alter table public.grade_entries alter column value drop not null;
alter table public.grade_entries drop constraint grade_entries_value_check;
alter table public.grade_entries add constraint grade_entries_value_check check (
  (absence_status = 'graded' and value is not null and value >= 0 and value <= max_value)
  or (absence_status = 'excused' and value is null)
);
alter table public.grade_entries drop constraint grade_entries_grade_type_check;
alter table public.grade_entries add constraint grade_entries_grade_type_check
  check (grade_type in ('devoir','controle','interrogation','composition','project','other'));
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.grade_entries'::regclass and contype = 'u' loop
    execute format('alter table public.grade_entries drop constraint %I', c.conname);
  end loop;
end $$;
create unique index grade_entries_period_unique on public.grade_entries
  (school_id,enrollment_id,subject_id,period_id,grade_type,label) where period_id is not null and deleted_at is null;
create unique index grade_entries_legacy_unique on public.grade_entries
  (school_id,enrollment_id,subject_id,academic_year_id,grade_type,label) where period_id is null;
create index grade_entries_period_lookup on public.grade_entries(school_id,period_id,enrollment_id,subject_id) where deleted_at is null;

create function public.validate_evaluation_rules() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Les règles sont immuables dans cette version ; configurez la prochaine année séparément.';
  end if;
  if not exists (select 1 from public.academic_years y where y.id = new.academic_year_id
    and y.school_id = new.school_id and y.deleted_at is null) then
    raise exception 'Année académique invalide.';
  end if;
  if new.cycle <> '*' and not exists (select 1 from public.grade_levels g
    where g.school_id = new.school_id and g.cycle = new.cycle and g.deleted_at is null) then
    raise exception 'Cycle invalide.';
  end if;
  return new;
end $$;
create trigger evaluation_rules_validate before insert or update or delete on public.evaluation_rules
  for each row execute function public.validate_evaluation_rules();

create function public.validate_evaluation_period() returns trigger language plpgsql security definer set search_path = public as $$
declare r public.evaluation_rules; y public.academic_years;
begin
  if tg_op = 'DELETE' then raise exception 'Suppression de période interdite.'; end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'locked_at') <> (to_jsonb(old) - 'locked_at')
      or old.locked_at is not null or new.locked_at is null then
      raise exception 'Seule la clôture définitive est disponible dans cette version.';
    end if;
    new.locked_at := clock_timestamp();
    return new;
  end if;
  select * into r from public.evaluation_rules where id = new.rule_id and school_id = new.school_id for update;
  if not found then raise exception 'Règles invalides.'; end if;
  select * into y from public.academic_years where id = r.academic_year_id and school_id = new.school_id;
  if new.starts_at < (y.start_date::timestamp at time zone 'Africa/Abidjan')
    or new.ends_at > ((y.end_date + 1)::timestamp at time zone 'Africa/Abidjan') then
    raise exception 'Période hors année académique.';
  end if;
  if (r.mode = 'TRIMESTRE' and (new.position > 3 or new.is_passage))
    or (r.mode = 'SEMESTRE' and (new.position > 2 or new.is_passage)) then
    raise exception 'Position incompatible avec le régime.';
  end if;
  if exists (select 1 from public.evaluation_periods p where p.rule_id = r.id
    and tstzrange(p.starts_at,p.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then
    raise exception 'Les périodes ne doivent pas se chevaucher.';
  end if;
  return new;
end $$;
create trigger evaluation_periods_validate before insert or update or delete on public.evaluation_periods
  for each row execute function public.validate_evaluation_period();

-- Le verrou de ligne sérialise la clôture et la saisie.
create function public.validate_period_grade() returns trigger language plpgsql security definer set search_path = public as $$
declare p public.evaluation_periods; r public.evaluation_rules; enrollment_cycle text;
begin
  if tg_op = 'DELETE' then raise exception 'Utilisez une suppression logique.'; end if;
  if tg_op = 'UPDATE' and (old.school_id,old.enrollment_id,old.subject_id,old.academic_year_id,old.period_id,old.created_by)
    is distinct from (new.school_id,new.enrollment_id,new.subject_id,new.academic_year_id,new.period_id,new.created_by) then
    raise exception 'Le contexte de la note est immuable.';
  end if;
  select g.cycle into enrollment_cycle from public.enrollments e
    join public.classes c on c.id = e.class_id and c.school_id = e.school_id and c.deleted_at is null
    join public.grade_levels g on g.id = c.grade_level_id and g.school_id = e.school_id
    where e.id = new.enrollment_id and e.school_id = new.school_id
      and e.academic_year_id = new.academic_year_id and e.deleted_at is null;
  if not found or not exists (select 1 from public.subjects s where s.id = new.subject_id
    and s.school_id = new.school_id and s.deleted_at is null) then
    raise exception 'Inscription ou matière invalide.';
  end if;
  if new.period_id is null then
    raise exception 'Une période est requise ; les notes historiques sont en lecture seule.';
  end if;
  select * into p from public.evaluation_periods where id = new.period_id and school_id = new.school_id for share;
  if not found then raise exception 'Période invalide.'; end if;
  if p.locked_at is not null or clock_timestamp() < p.starts_at or clock_timestamp() >= p.ends_at then
    raise exception 'La période est verrouillée ou non ouverte.';
  end if;
  select * into r from public.evaluation_rules where id = p.rule_id and school_id = new.school_id;
  if r.academic_year_id <> new.academic_year_id or (r.cycle <> '*' and r.cycle <> enrollment_cycle) then
    raise exception 'Période incompatible avec cette inscription.';
  end if;
  if r.cycle = '*' and exists (select 1 from public.evaluation_rules specific
    where specific.school_id = new.school_id and specific.academic_year_id = new.academic_year_id and specific.cycle = enrollment_cycle) then
    raise exception 'Utilisez les périodes spécifiques au cycle.';
  end if;
  if r.interrogation_percent is not null and new.grade_type not in ('interrogation','devoir','composition') then
    raise exception 'Catégorie incompatible avec la pondération configurée.';
  end if;
  if p.is_passage and new.grade_type <> 'composition' then raise exception 'Une composition de passage est requise.'; end if;
  return new;
end $$;
create trigger grade_entries_period_validate before insert or update or delete on public.grade_entries
  for each row execute function public.validate_period_grade();

create function public.can_access_evaluation_grade(school uuid, enrollment uuid, subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_school_role(school, array['direction','super_admin']) or (
    public.has_school_role(school, array['professeur']) and exists (
      select 1 from public.enrollments e join public.class_subject_assignments a
        on a.class_id = e.class_id and a.school_id = e.school_id
      where e.id = enrollment and e.school_id = school and e.deleted_at is null
        and a.subject_id = subject and a.teacher_id = auth.uid() and a.deleted_at is null
    )
  );
$$;
revoke all on function public.can_access_evaluation_grade(uuid,uuid,uuid) from public;
grant execute on function public.can_access_evaluation_grade(uuid,uuid,uuid) to authenticated;

alter table public.evaluation_rules enable row level security;
alter table public.evaluation_periods enable row level security;
create policy evaluation_rules_read on public.evaluation_rules for select to authenticated
  using (public.has_school_role(school_id,array['direction','super_admin','professeur']));
create policy evaluation_rules_insert on public.evaluation_rules for insert to authenticated
  with check (public.has_school_role(school_id,array['direction','super_admin']));
create policy evaluation_periods_read on public.evaluation_periods for select to authenticated
  using (public.has_school_role(school_id,array['direction','super_admin','professeur']));
create policy evaluation_periods_insert on public.evaluation_periods for insert to authenticated
  with check (public.has_school_role(school_id,array['direction','super_admin']));
create policy evaluation_periods_close on public.evaluation_periods for update to authenticated
  using (public.has_school_role(school_id,array['direction','super_admin']))
  with check (public.has_school_role(school_id,array['direction','super_admin']));
-- Retirer toutes les anciennes politiques permissives sur les notes.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'grade_entries' loop
    execute format('drop policy %I on public.grade_entries',p.policyname);
  end loop;
end $$;
create policy evaluation_grade_read on public.grade_entries for select to authenticated
  using (public.can_access_evaluation_grade(school_id,enrollment_id,subject_id));
create policy evaluation_grade_insert on public.grade_entries for insert to authenticated
  with check (created_by = auth.uid() and public.can_access_evaluation_grade(school_id,enrollment_id,subject_id));
-- Les corrections avec audit/versionnement seront livrées dans le lot suivant.
-- En attendant, aucun UPDATE direct authentifié : pas d'écrasement silencieux.
grant select,insert on public.evaluation_rules to authenticated;
grant select,insert,update on public.evaluation_periods to authenticated;
grant select,insert on public.grade_entries to authenticated;
grant all on public.evaluation_rules, public.evaluation_periods to service_role;
commit;

