-- Lot 4 : validation officielle du résultat annuel par la direction.
-- Aucune admission automatique : la décision n'existe que par cet appel.
begin;
alter table public.academic_decisions
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid references public.users(id),
  add column if not exists input_fingerprint text,
  add column if not exists snapshot jsonb;

-- Empreinte canonique de TOUTES les données utilisées par le cumul annuel :
-- règles, coefficients, évaluations attendues, calendrier et notes.
-- Implémentation unique (SQL) : aucune divergence possible avec le moteur TS.
create function public.annual_input_fingerprint(p_enrollment_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare e public.enrollments; r public.evaluation_rules; v_cycle text; parts text[];
begin
  select * into e from public.enrollments where id=p_enrollment_id and deleted_at is null;
  if not found then raise exception 'Inscription introuvable.'; end if;
  select g.cycle into v_cycle from public.classes c
    join public.grade_levels g on g.id=c.grade_level_id and g.deleted_at is null
    where c.id=e.class_id and c.deleted_at is null;
  select * into r from public.evaluation_rules
    where school_id=e.school_id and academic_year_id=e.academic_year_id and cycle=v_cycle;
  if not found then
    select * into r from public.evaluation_rules
      where school_id=e.school_id and academic_year_id=e.academic_year_id and cycle='*';
  end if;
  if not found then raise exception 'Aucune règle applicable.'; end if;
  parts := array[
    'rules|'||r.id||'|'||r.mode||'|'||r.scale||'|'||r.threshold||'|'||r.rescue_margin||'|'||
      coalesce(r.interrogation_percent::text,'-')||'|'||coalesce(r.devoir_percent::text,'-')||'|'||
      coalesce(r.composition_percent::text,'-'),
    'class|'||coalesce(e.class_id::text,'-'),
    coalesce((select string_agg('coef|'||a.subject_id||'|'||a.coefficient,';' order by a.subject_id)
      from public.class_subject_assignments a
      where a.school_id=e.school_id and a.class_id=e.class_id and a.deleted_at is null),'coef|-'),
    coalesce((select string_agg('assess|'||x.id||'|'||x.subject_id||'|'||x.grade_type||'|'||x.label||'|'||
        x.max_value||'|'||x.weight,';' order by x.id)
      from public.evaluation_assessments x
      join public.evaluation_periods p on p.id=x.period_id
      where x.school_id=e.school_id and x.class_id=e.class_id and p.rule_id=r.id),'assess|-'),
    coalesce((select string_agg('period|'||p.id||'|'||p.position||'|'||p.is_passage::text||'|'||
        extract(epoch from p.starts_at)::bigint||'|'||extract(epoch from p.ends_at)::bigint||'|'||
        coalesce(extract(epoch from p.locked_at)::bigint::text,'-'),';' order by p.position)
      from public.evaluation_periods p where p.rule_id=r.id),'period|-'),
    coalesce((select string_agg('grade|'||g.id||'|'||coalesce(g.assessment_id::text,'-')||'|'||g.subject_id||'|'||
        coalesce(g.value::text,'abs')||'|'||g.absence_status||'|'||g.max_value||'|'||g.weight||'|'||
        g.grade_type||'|'||g.label||'|'||g.revision,';' order by g.id)
      from public.grade_entries g
      where g.school_id=e.school_id and g.enrollment_id=e.id and g.deleted_at is null),'grade|-')
  ];
  return md5(array_to_string(parts, E'\n'));
end $$;
revoke all on function public.annual_input_fingerprint(uuid) from public, anon;
grant execute on function public.annual_input_fingerprint(uuid) to authenticated;

-- Validation officielle : seule la direction peut figer un résultat annuel.
-- La cohérence de la décision avec le seuil et la marge de rachat est revérifiée
-- ici, sans dupliquer le moteur : le seuil vient de la règle réellement appliquée.
create function public.validate_annual_decision(
  p_enrollment_id uuid,
  p_decision text,
  p_average numeric,
  p_fingerprint text,
  p_observations text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments; r public.evaluation_rules; v_cycle text; d public.academic_decisions;
  current_fingerprint text; proposal text; decision_id uuid; pending_periods int;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if not found then raise exception 'Inscription introuvable.'; end if;
  if not public.has_school_role(e.school_id, array['direction','super_admin']) then
    raise exception 'Seule la direction valide un résultat annuel.' using errcode='42501';
  end if;
  if p_decision not in ('admitted','repeated','excluded','pending') then
    raise exception 'Décision inconnue.' using errcode='22023';
  end if;

  select * into d from public.academic_decisions
    where school_id=e.school_id and enrollment_id=e.id and academic_year_id=e.academic_year_id;
  if found and d.validated_at is not null then
    raise exception 'Résultat déjà validé et immuable.' using errcode='P0001';
  end if;

  select g.cycle into v_cycle from public.classes c
    join public.grade_levels g on g.id=c.grade_level_id and g.deleted_at is null
    where c.id=e.class_id and c.deleted_at is null;
  select * into r from public.evaluation_rules
    where school_id=e.school_id and academic_year_id=e.academic_year_id and cycle=v_cycle;
  if not found then
    select * into r from public.evaluation_rules
      where school_id=e.school_id and academic_year_id=e.academic_year_id and cycle='*';
  end if;
  if not found then raise exception 'Aucune règle applicable.'; end if;

  current_fingerprint := public.annual_input_fingerprint(p_enrollment_id);
  if p_fingerprint is null or p_fingerprint <> current_fingerprint then
    raise exception 'Les données ont changé depuis l''aperçu : relancez le calcul.' using errcode='40001';
  end if;

  select count(*) into pending_periods from public.evaluation_periods p
    where p.rule_id=r.id and p.locked_at is null;
  if pending_periods > 0 then
    raise exception 'Toutes les périodes doivent être clôturées avant validation.' using errcode='P0001';
  end if;

  if p_average is null or p_average < 0 or p_average > r.scale then
    raise exception 'Moyenne annuelle absente ou hors barème.' using errcode='22023';
  end if;

  proposal := case
    when p_average >= r.threshold then 'admitted'
    when p_average >= r.threshold - r.rescue_margin then 'rescuable'
    else 'repeated'
  end;
  if (proposal = 'admitted' and p_decision <> 'admitted')
     or (proposal = 'rescuable' and p_decision not in ('admitted','repeated','pending'))
     or (proposal = 'repeated' and p_decision <> 'repeated') then
    raise exception 'Décision incohérente avec la moyenne et la règle appliquée.' using errcode='22023';
  end if;

  insert into public.academic_decisions as ad
    (school_id, enrollment_id, academic_year_id, decision, average, observations, decided_by, decided_at,
     validated_at, validated_by, input_fingerprint, snapshot)
  values
    (e.school_id, e.id, e.academic_year_id, p_decision, p_average, p_observations, auth.uid(), now(),
     now(), auth.uid(), current_fingerprint,
     jsonb_build_object('rule_id', r.id, 'mode', r.mode, 'scale', r.scale, 'threshold', r.threshold,
       'rescue_margin', r.rescue_margin, 'proposal', proposal, 'average', p_average,
       'decision', p_decision, 'fingerprint', current_fingerprint, 'validated_at', now()))
  on conflict (school_id, enrollment_id, academic_year_id) do update
    set decision=excluded.decision, average=excluded.average, observations=excluded.observations,
        decided_by=excluded.decided_by, decided_at=excluded.decided_at,
        validated_at=excluded.validated_at, validated_by=excluded.validated_by,
        input_fingerprint=excluded.input_fingerprint, snapshot=excluded.snapshot
  returning ad.id into decision_id;
  return decision_id;
end $$;
revoke all on function public.validate_annual_decision(uuid,text,numeric,text,text) from public, anon;
grant execute on function public.validate_annual_decision(uuid,text,numeric,text,text) to authenticated;

-- Une décision validée ne peut plus être ni modifiée ni supprimée par l'API :
-- la seule voie d'écriture reste la validation initiale (validated_at nul).
create function public.protect_validated_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op='UPDATE' then
    if old.validated_at is not null then
      raise exception 'Résultat annuel déjà validé et immuable.' using errcode='P0001';
    end if;
    return new;
  end if;
  if old.validated_at is not null then
    raise exception 'Résultat annuel validé : suppression interdite.' using errcode='P0001';
  end if;
  return old;
end $$;
create trigger academic_decisions_protect_validated
  before update or delete on public.academic_decisions
  for each row execute function public.protect_validated_decision();

-- Après validation annuelle, plus aucune écriture de note pour cette inscription :
-- la correction reste possible tant que l'année n'est pas validée.
create function public.lock_validated_grade_writes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.academic_decisions d
    where d.enrollment_id=new.enrollment_id and d.academic_year_id=new.academic_year_id
      and d.validated_at is not null) then
    raise exception 'Résultat annuel validé : les notes ne peuvent plus être modifiées.' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger grade_entries_validated_lock
  before insert or update on public.grade_entries
  for each row execute function public.lock_validated_grade_writes();

commit;
