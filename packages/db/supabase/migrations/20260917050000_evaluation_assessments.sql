-- Lot 2 : évaluations attendues. Appliquer après 20260917040000.
begin;
create table public.evaluation_assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  period_id uuid not null references public.evaluation_periods(id),
  class_id uuid not null references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  grade_type text not null check (grade_type in ('interrogation','devoir','composition')),
  label text not null check (length(trim(label)) > 0),
  max_value numeric not null check (max_value > 0 and max_value < 1000000),
  weight numeric not null default 1 check (weight >= 0 and weight < 1000000),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (school_id,period_id,class_id,subject_id,grade_type,label)
);
create index evaluation_assessments_lookup on public.evaluation_assessments(school_id,period_id,class_id);
alter table public.grade_entries add column assessment_id uuid references public.evaluation_assessments(id);
create unique index grade_entries_assessment_unique on public.grade_entries(assessment_id,enrollment_id)
  where assessment_id is not null and deleted_at is null;

create function public.can_access_evaluation_assessment(school uuid, class uuid, subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_school_role(school,array['direction','super_admin']) or (
    public.has_school_role(school,array['professeur']) and exists (
      select 1 from public.class_subject_assignments a where a.school_id=school
        and a.class_id=class and a.subject_id=subject and a.teacher_id=auth.uid() and a.deleted_at is null
    )
  );
$$;
revoke all on function public.can_access_evaluation_assessment(uuid,uuid,uuid) from public;
grant execute on function public.can_access_evaluation_assessment(uuid,uuid,uuid) to authenticated;

create function public.validate_evaluation_assessment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.evaluation_periods; r public.evaluation_rules; class_cycle text;
begin
  if tg_op <> 'INSERT' then raise exception 'Les évaluations attendues sont immuables dans cette version.'; end if;
  select * into p from public.evaluation_periods where id=new.period_id and school_id=new.school_id for share;
  if not found then raise exception 'Période invalide.'; end if;
  if p.locked_at is not null or clock_timestamp() >= p.ends_at then
    raise exception 'La période est verrouillée ou terminée.';
  end if;
  select * into r from public.evaluation_rules where id=p.rule_id;
  select g.cycle into class_cycle from public.classes c
    join public.grade_levels g on g.id=c.grade_level_id and g.school_id=c.school_id and g.deleted_at is null
    where c.id=new.class_id and c.school_id=new.school_id and c.deleted_at is null;
  if not found or not exists (select 1 from public.subjects s where s.id=new.subject_id
    and s.school_id=new.school_id and s.deleted_at is null) or not exists (
    select 1 from public.class_subject_assignments a where a.school_id=new.school_id
      and a.class_id=new.class_id and a.subject_id=new.subject_id and a.deleted_at is null
  ) then raise exception 'Classe ou matière non affectée.'; end if;
  if (r.cycle <> '*' and r.cycle <> class_cycle) or (r.cycle='*' and exists (
    select 1 from public.evaluation_rules specific where specific.school_id=new.school_id
      and specific.academic_year_id=r.academic_year_id and specific.cycle=class_cycle
  )) then raise exception 'Période incompatible avec le cycle de la classe.'; end if;
  if p.is_passage and new.grade_type <> 'composition' then raise exception 'Une composition de passage est requise.'; end if;
  return new;
end $$;
create trigger evaluation_assessments_validate before insert or update or delete on public.evaluation_assessments
  for each row execute function public.validate_evaluation_assessment();

create function public.validate_assessment_grade() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.evaluation_assessments; year_id uuid;
begin
  if tg_op='UPDATE' and old.assessment_id is distinct from new.assessment_id then
    raise exception 'Le rattachement à une évaluation est immuable.';
  end if;
  if new.assessment_id is null then
    raise exception 'Sélectionnez une évaluation attendue.';
  end if;
  select * into a from public.evaluation_assessments where id=new.assessment_id and school_id=new.school_id;
  if not found then raise exception 'Évaluation attendue invalide.'; end if;
  select r.academic_year_id into year_id from public.evaluation_periods p
    join public.evaluation_rules r on r.id=p.rule_id where p.id=a.period_id;
  if not exists (select 1 from public.enrollments e where e.id=new.enrollment_id and e.school_id=a.school_id
    and e.class_id=a.class_id and e.academic_year_id=year_id and e.deleted_at is null) then
    raise exception 'Inscription incompatible avec cette évaluation.';
  end if;
  -- Métadonnées canoniques : aucun barème/poids différent selon l'élève.
  new.period_id:=a.period_id; new.subject_id:=a.subject_id; new.academic_year_id:=year_id;
  new.grade_type:=a.grade_type; new.label:=a.label; new.max_value:=a.max_value; new.weight:=a.weight;
  return new;
end $$;
create trigger grade_entries_assessment_validate before insert or update on public.grade_entries
  for each row execute function public.validate_assessment_grade();

alter table public.evaluation_assessments enable row level security;
create policy evaluation_assessments_read on public.evaluation_assessments for select to authenticated
  using (public.can_access_evaluation_assessment(school_id,class_id,subject_id));
create policy evaluation_assessments_insert on public.evaluation_assessments for insert to authenticated
  with check (created_by=auth.uid() and public.can_access_evaluation_assessment(school_id,class_id,subject_id));
grant select,insert on public.evaluation_assessments to authenticated;
grant all on public.evaluation_assessments to service_role;
commit;
