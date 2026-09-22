alter table public.school_supply_proposals alter column subject_id drop not null;

create unique index if not exists uq_school_supply_proposals_pedagogical_assignment_teacher
on public.school_supply_proposals(school_id,academic_year_id,pedagogical_assignment_id,teacher_id)
where deleted_at is null and pedagogical_assignment_id is not null;