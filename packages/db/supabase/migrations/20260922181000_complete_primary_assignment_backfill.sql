-- Complete primary backfill: when no head teacher is recorded, retain the existing assigned teacher as class responsibility.
insert into public.pedagogical_assignment_members (assignment_id,user_id,role,is_primary,metadata)
select p.id,a.teacher_id,'head_teacher',true,jsonb_build_object('source','class_subject_assignments.teacher_id','fallback',true)
from public.pedagogical_assignments p
join public.schools s on s.id=p.school_id and s.school_type='primaire'
join public.class_subject_assignments a on a.pedagogical_assignment_id=p.id and a.deleted_at is null
join public.classes c on c.id=p.class_id
where p.scope='class'
  and p.deleted_at is null
  and c.head_teacher_id is null
  and a.teacher_id is not null
on conflict (assignment_id,user_id) do update set role=excluded.role,is_primary=excluded.is_primary;

-- One primary class responsibility may have several legacy subject rows; keep only one primary member.
with ranked as (
  select id, row_number() over (partition by assignment_id order by is_primary desc, created_at, id) rn
  from public.pedagogical_assignment_members
  where is_primary=true
)
update public.pedagogical_assignment_members m
set is_primary=false
from ranked r
where m.id=r.id and r.rn>1;