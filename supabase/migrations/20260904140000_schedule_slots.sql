-- ============================================================================
-- EMPLOI DU TEMPS — schedule_slots
-- ============================================================================

create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  teacher_id uuid references profiles(id),
  subject text not null,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=lundi, 6=dimanche
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (establishment_id, section_id, day_of_week, start_time)
);

alter table schedule_slots enable row level security;

drop policy if exists "Teacher sees own schedule" on schedule_slots;
create policy "Teacher sees own schedule"
  on schedule_slots for select
  using (
    teacher_id = auth.uid()
    or section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

drop policy if exists "Admin manages schedule" on schedule_slots;
create policy "Admin manages schedule"
  on schedule_slots for all
  using (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Staff sees establishment schedule" on schedule_slots;
create policy "Staff sees establishment schedule"
  on schedule_slots for select
  using (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.schedule_slots to authenticated;
