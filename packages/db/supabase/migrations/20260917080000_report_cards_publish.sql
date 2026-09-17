-- Lot 5 : bulletins officiels — instantané figé, génération et publication.
-- Réutilise report_cards (aucune table concurrente). Le contenu est calculé en
-- SQL à partir des notes gelées et de la décision validée : le bulletin publié
-- conserve ses règles et résultats, indépendamment des évolutions ultérieures.
begin;
alter table public.report_cards
  add column if not exists content jsonb,
  add column if not exists version integer not null default 1 check (version >= 1);

-- Un bulletin publié est conservé : contenu et version immuables, suppression
-- refusée (seule transition autorisée : sent -> archived). Un bulletin généré
-- ou publié exige un contenu figé.
create function public.protect_report_card_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'sent' then
      raise exception 'Un bulletin publié est conservé dans l''historique.' using errcode='P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'sent' then
    if new.status not in ('sent','archived') or new.content is distinct from old.content
      or new.version is distinct from old.version or new.enrollment_id is distinct from old.enrollment_id
      or new.academic_year_id is distinct from old.academic_year_id then
      raise exception 'Bulletin publié : contenu immuable.' using errcode='P0001';
    end if;
  end if;
  if new.status in ('generated','sent') and new.content is null then
    raise exception 'Un bulletin généré exige un contenu figé.' using errcode='P0001';
  end if;
  return new;
end $$;
drop trigger if exists report_cards_history_guard on public.report_cards;
create trigger report_cards_history_guard before insert or update or delete on public.report_cards
  for each row execute function public.protect_report_card_history();

-- Génération par classe : uniquement les élèves à décision validée ; refuse si
-- les données ont changé depuis la validation (empreinte). Moyennes recalculées
-- ici, en SQL, sur les notes gelées — jamais côté client.
create function public.generate_class_report_cards(p_class_id uuid, p_academic_year_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  school uuid; v_cycle text; r public.evaluation_rules; processed integer := 0; rec record; v_content jsonb;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  select c.school_id into school from public.classes c
    where c.id=p_class_id and c.school_id=(select school_id from public.classes where id=p_class_id)
    and c.deleted_at is null;
  if school is null then raise exception 'Classe introuvable.'; end if;
  if not public.has_school_role(school, array['direction','super_admin']) then
    raise exception 'Seule la direction génère les bulletins.' using errcode='42501';
  end if;
  select g.cycle into v_cycle from public.classes c
    join public.grade_levels g on g.id=c.grade_level_id and g.deleted_at is null
    where c.id=p_class_id and c.deleted_at is null;
  select * into r from public.evaluation_rules
    where school_id=school and academic_year_id=p_academic_year_id and cycle=v_cycle;
  if not found then
    select * into r from public.evaluation_rules
      where school_id=school and academic_year_id=p_academic_year_id and cycle='*';
  end if;
  if not found then raise exception 'Aucune règle applicable pour cette année.'; end if;

  for rec in
    select e.id as enrollment_id, e.matricule, d.id as decision_id, d.decision, d.average,
           d.observations, d.input_fingerprint, d.validated_at,
           s.last_name, s.first_name, c.name as class_name, y.label as year_label, sc.name as school_name
    from public.enrollments e
    join public.students s on s.id=e.student_id
    join public.classes c on c.id=e.class_id
    join public.academic_years y on y.id=e.academic_year_id
    join public.schools sc on sc.id=e.school_id
    join public.academic_decisions d on d.enrollment_id=e.id and d.academic_year_id=e.academic_year_id
      and d.validated_at is not null and d.deleted_at is null
    where e.school_id=school and e.class_id=p_class_id and e.academic_year_id=p_academic_year_id
      and e.deleted_at is null
  loop
    if public.annual_input_fingerprint(rec.enrollment_id) is distinct from rec.input_fingerprint then
      raise exception 'Les données d''un élève validé ont changé : relancez la validation avant génération.' using errcode='40001';
    end if;
    v_content := jsonb_build_object(
      'school', rec.school_name, 'year', rec.year_label, 'class', rec.class_name,
      'student', jsonb_build_object('name', btrim(rec.last_name||' '||rec.first_name), 'matricule', rec.matricule),
      'subjects', coalesce((
        select jsonb_agg(jsonb_build_object('name', s2.name, 'coefficient', a.coefficient,
                 'periods', (select jsonb_agg(jsonb_build_object('label', p2.label, 'average',
                      (select round(sum(case when g2.absence_status='graded'
                                   then g2.value/g2.max_value*g2.weight else 0 end)
                            / nullif(sum(case when g2.absence_status='graded' then g2.weight else 0 end),0) * r.scale, 2)
                         from public.grade_entries g2
                         where g2.enrollment_id=rec.enrollment_id and g2.subject_id=a.subject_id
                           and g2.period_id=p2.id and g2.deleted_at is null)
                    ) order by p2.position)
                 from public.evaluation_periods p2 where p2.rule_id=r.id)
               ) order by s2.name)
        from public.class_subject_assignments a
        join public.subjects s2 on s2.id=a.subject_id
        where a.school_id=school and a.class_id=p_class_id and a.deleted_at is null and s2.deleted_at is null
      ), '[]'::jsonb),
      'annual', jsonb_build_object('average', rec.average, 'decision', rec.decision, 'observations', rec.observations),
      'rule', jsonb_build_object('id', r.id, 'mode', r.mode, 'scale', r.scale, 'threshold', r.threshold, 'rescue_margin', r.rescue_margin),
      'validated_at', rec.validated_at, 'generated_at', now()
    );
    insert into public.report_cards
      (school_id, enrollment_id, academic_year_id, status, content, version, generated_by, generated_at)
    values
      (school, rec.enrollment_id, p_academic_year_id, 'generated', v_content, 1, auth.uid(), now())
    on conflict (school_id, enrollment_id, academic_year_id) do update
      set content=excluded.content, status='generated', generated_by=excluded.generated_by,
          generated_at=excluded.generated_at, version=public.report_cards.version+1
      where public.report_cards.status <> 'sent';
    processed := processed + 1;
  end loop;
  return processed;
end $$;

-- Publication : les bulletins générés de la classe passent à « sent » ; seuls les
-- élèves à décision validée sont publiés. Le statut « sent » déclenche la
-- visibilité côté parents et élèves.
create function public.publish_class_report_cards(p_class_id uuid, p_academic_year_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare school uuid; published integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  select c.school_id into school from public.classes c where c.id=p_class_id and c.deleted_at is null;
  if school is null then raise exception 'Classe introuvable.'; end if;
  if not public.has_school_role(school, array['direction','super_admin']) then
    raise exception 'Seule la direction publie les bulletins.' using errcode='42501';
  end if;
  update public.report_cards rc set status='sent', sent_at=now()
  from public.enrollments e
  join public.academic_decisions d on d.enrollment_id=e.id and d.academic_year_id=e.academic_year_id
    and d.validated_at is not null and d.deleted_at is null
  where rc.enrollment_id=e.id and rc.academic_year_id=e.academic_year_id
    and rc.school_id=school and e.class_id=p_class_id and e.deleted_at is null
    and rc.status='generated' and rc.deleted_at is null;
  get diagnostics published = row_count;
  return published;
end $$;

revoke all on function public.generate_class_report_cards(uuid,uuid) from public, anon;
grant execute on function public.generate_class_report_cards(uuid,uuid) to authenticated;
revoke all on function public.publish_class_report_cards(uuid,uuid) from public, anon;
grant execute on function public.publish_class_report_cards(uuid,uuid) to authenticated;
commit;
