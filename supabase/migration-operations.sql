-- ============================================================================
-- SCHOOLY — Partie 3 : Rentrée, paiements, documents, messages, comportement
-- Coller d'un coup dans l'éditeur SQL Supabase (après Partie 1 et 2).
-- ============================================================================

do $$ begin
  create type fee_status as enum ('pending', 'partial', 'paid', 'overdue');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('orange_money', 'mtn_momo', 'moov', 'wave', 'cash', 'bank');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_status as enum ('pending', 'confirmed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_type as enum (
    'acte_naissance',
    'photo_identite',
    'carnet_vaccination',
    'bulletin_precedent',
    'certificat_scolarite',
    'piece_identite',
    'dossier_examen',
    'autre'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_status as enum ('missing', 'submitted', 'validated', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type behavior_kind as enum ('positif', 'a_surveiller', 'incident');
exception when duplicate_object then null;
end $$;

create table if not exists fee_categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  description text,
  amount numeric(12,2) not null default 0,
  due_date date,
  school_year text not null default '2026-2027',
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (establishment_id, name, school_year)
);

create table if not exists student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  fee_category_id uuid not null references fee_categories(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  amount numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  status fee_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (student_id, fee_category_id),
  check (amount_paid >= 0),
  check (amount_paid <= amount + 0.01)
);

create index if not exists idx_student_fees_student on student_fees(student_id);
create index if not exists idx_student_fees_etab on student_fees(establishment_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  student_fee_id uuid references student_fees(id) on delete set null,
  establishment_id uuid not null references establishments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null default 'orange_money',
  reference text,
  status payment_status not null default 'pending',
  paid_at timestamptz,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_student on payments(student_id);
create index if not exists idx_payments_etab on payments(establishment_id);

create table if not exists supply_lists (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  level_id uuid not null references levels(id) on delete cascade,
  school_year text not null default '2026-2027',
  title text not null,
  notes text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists supply_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references supply_lists(id) on delete cascade,
  name text not null,
  quantity text not null default '1',
  estimated_cost numeric(12,2) not null default 0,
  is_optional boolean not null default false,
  sort_order int not null default 0
);

create table if not exists student_supply_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  supply_item_id uuid not null references supply_items(id) on delete cascade,
  purchased boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, supply_item_id)
);

create table if not exists student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  doc_type document_type not null,
  status document_status not null default 'missing',
  required boolean not null default true,
  alert_from_level text,
  notes text,
  submitted_at timestamptz,
  validated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, doc_type)
);

create index if not exists idx_student_documents_student on student_documents(student_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  recipient_id uuid references profiles(id),
  student_id uuid references students(id) on delete set null,
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on messages(recipient_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id, created_at desc);

create table if not exists behavior_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  recorded_by uuid not null references profiles(id),
  kind behavior_kind not null default 'a_surveiller',
  title text not null,
  body text,
  session_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_behavior_student on behavior_notes(student_id);

create or replace function refresh_fee_status(p_fee_id uuid)
returns void language plpgsql as $$
declare
  v_fee student_fees;
begin
  select * into v_fee from student_fees where id = p_fee_id for update;
  if v_fee is null then return; end if;
  if v_fee.amount_paid >= v_fee.amount then
    update student_fees set status = 'paid' where id = p_fee_id;
  elsif v_fee.amount_paid > 0 then
    update student_fees set status = 'partial' where id = p_fee_id;
  elsif v_fee.due_date is not null and v_fee.due_date < current_date then
    update student_fees set status = 'overdue' where id = p_fee_id;
  else
    update student_fees set status = 'pending' where id = p_fee_id;
  end if;
end;
$$;

create or replace function record_fee_payment(
  p_student_fee_id uuid,
  p_amount numeric,
  p_method payment_method,
  p_reference text default null,
  p_confirm boolean default false
) returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_fee student_fees;
  v_payment payments;
  v_confirm boolean;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then raise exception 'Profil introuvable'; end if;

  select * into v_fee from student_fees where id = p_student_fee_id for update;
  if v_fee is null then raise exception 'Echeance introuvable'; end if;

  if v_profile.role = 'parent' then
    if not exists (select 1 from students s where s.id = v_fee.student_id and s.parent_id = auth.uid()) then
      raise exception 'Acces refuse';
    end if;
    v_confirm := false;
  elsif v_profile.role in ('admin', 'secretariat', 'censeur') then
    if v_profile.establishment_id is distinct from v_fee.establishment_id then
      raise exception 'Autre etablissement';
    end if;
    v_confirm := coalesce(p_confirm, true);
  else
    raise exception 'Acces refuse';
  end if;

  insert into payments (
    student_id, student_fee_id, establishment_id, amount, method, reference, status, paid_at, recorded_by
  ) values (
    v_fee.student_id, v_fee.id, v_fee.establishment_id, p_amount, p_method, nullif(trim(p_reference), ''),
    case when v_confirm then 'confirmed' else 'pending' end,
    case when v_confirm then now() else null end,
    auth.uid()
  ) returning * into v_payment;

  if v_confirm then
    update student_fees
      set amount_paid = least(amount, amount_paid + p_amount)
      where id = v_fee.id;
    perform refresh_fee_status(v_fee.id);
  end if;

  return v_payment;
end;
$$;

create or replace function confirm_fee_payment(p_payment_id uuid)
returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_payment payments;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null or v_profile.role not in ('admin', 'secretariat', 'censeur') then
    raise exception 'Acces refuse';
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment is null then raise exception 'Paiement introuvable'; end if;
  if v_profile.establishment_id is distinct from v_payment.establishment_id then
    raise exception 'Autre etablissement';
  end if;
  if v_payment.status = 'confirmed' then return v_payment; end if;

  update payments
    set status = 'confirmed', paid_at = now()
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.student_fee_id is not null then
    update student_fees
      set amount_paid = least(amount, amount_paid + v_payment.amount)
      where id = v_payment.student_fee_id;
    perform refresh_fee_status(v_payment.student_fee_id);
  end if;

  return v_payment;
end;
$$;

create or replace function assign_fees_to_student(p_student_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_student students;
  v_count int := 0;
begin
  select * into v_student from students where id = p_student_id;
  if v_student is null then return 0; end if;

  insert into student_fees (student_id, fee_category_id, establishment_id, amount, due_date)
  select v_student.id, fc.id, fc.establishment_id, fc.amount, fc.due_date
  from fee_categories fc
  where fc.establishment_id = v_student.establishment_id
  on conflict (student_id, fee_category_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function seed_student_documents(p_student_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_student students;
begin
  select * into v_student from students where id = p_student_id;
  if v_student is null then return; end if;

  insert into student_documents (student_id, establishment_id, doc_type, required, alert_from_level)
  values
    (v_student.id, v_student.establishment_id, 'acte_naissance', true, null),
    (v_student.id, v_student.establishment_id, 'photo_identite', true, null),
    (v_student.id, v_student.establishment_id, 'carnet_vaccination', true, null),
    (v_student.id, v_student.establishment_id, 'bulletin_precedent', false, null),
    (v_student.id, v_student.establishment_id, 'piece_identite', true, 'CM1'),
    (v_student.id, v_student.establishment_id, 'dossier_examen', true, 'CM2')
  on conflict (student_id, doc_type) do nothing;
end;
$$;

create or replace function after_student_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform seed_student_documents(new.id);
  perform assign_fees_to_student(new.id);
  return new;
end;
$$;

drop trigger if exists after_student_insert_trg on students;
create trigger after_student_insert_trg
  after insert on students
  for each row execute procedure after_student_insert();

create or replace function send_school_message(
  p_recipient_id uuid,
  p_student_id uuid,
  p_subject text,
  p_body text
) returns messages
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_student students;
  v_etab uuid;
  v_msg messages;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  if p_subject is null or length(trim(p_subject)) = 0 or p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Sujet et message requis';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then raise exception 'Profil introuvable'; end if;

  v_etab := v_profile.establishment_id;

  if p_student_id is not null then
    select * into v_student from students where id = p_student_id;
    if v_student is null then raise exception 'Eleve introuvable'; end if;
    v_etab := v_student.establishment_id;
    if v_profile.role = 'parent' and v_student.parent_id is distinct from auth.uid() then
      raise exception 'Acces refuse';
    end if;
    if v_profile.role <> 'parent' and v_profile.establishment_id is distinct from v_student.establishment_id then
      raise exception 'Acces refuse';
    end if;
  end if;

  if v_etab is null then raise exception 'Etablissement introuvable'; end if;

  if p_recipient_id is null then raise exception 'Destinataire requis'; end if;

  insert into messages (establishment_id, sender_id, recipient_id, student_id, subject, body)
  values (v_etab, auth.uid(), p_recipient_id, p_student_id, trim(p_subject), trim(p_body))
  returning * into v_msg;

  return v_msg;
end;
$$;

alter table fee_categories enable row level security;
alter table student_fees enable row level security;
alter table payments enable row level security;
alter table supply_lists enable row level security;
alter table supply_items enable row level security;
alter table student_supply_checks enable row level security;
alter table student_documents enable row level security;
alter table messages enable row level security;
alter table behavior_notes enable row level security;

drop policy if exists "fees_cat_staff" on fee_categories;
create policy "fees_cat_staff" on fee_categories for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "fees_cat_parent" on fee_categories;
create policy "fees_cat_parent" on fee_categories for select using (
  establishment_id in (select establishment_id from students where parent_id = auth.uid())
);

drop policy if exists "sfees_staff" on student_fees;
create policy "sfees_staff" on student_fees for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "sfees_parent" on student_fees;
create policy "sfees_parent" on student_fees for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "pay_staff" on payments;
create policy "pay_staff" on payments for select using (
  establishment_id in (select establishment_id from profiles where id = auth.uid())
);

drop policy if exists "pay_parent" on payments;
create policy "pay_parent" on payments for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "sup_list_staff" on supply_lists;
create policy "sup_list_staff" on supply_lists for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat')));

drop policy if exists "sup_list_parent" on supply_lists;
create policy "sup_list_parent" on supply_lists for select using (
  published = true and establishment_id in (select establishment_id from students where parent_id = auth.uid())
);

drop policy if exists "sup_items_staff" on supply_items;
create policy "sup_items_staff" on supply_items for all
  using (list_id in (select id from supply_lists where establishment_id in (select establishment_id from profiles where id = auth.uid())))
  with check (list_id in (select id from supply_lists where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat'))));

drop policy if exists "sup_items_parent" on supply_items;
create policy "sup_items_parent" on supply_items for select using (
  list_id in (
    select sl.id from supply_lists sl
    where sl.published = true
      and sl.establishment_id in (select establishment_id from students where parent_id = auth.uid())
  )
);

drop policy if exists "sup_check_parent" on student_supply_checks;
create policy "sup_check_parent" on student_supply_checks for all
  using (student_id in (select id from students where parent_id = auth.uid()))
  with check (student_id in (select id from students where parent_id = auth.uid()));

drop policy if exists "sup_check_staff" on student_supply_checks;
create policy "sup_check_staff" on student_supply_checks for select using (
  student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid()))
);

drop policy if exists "docs_staff" on student_documents;
create policy "docs_staff" on student_documents for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "docs_parent_select" on student_documents;
create policy "docs_parent_select" on student_documents for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "docs_parent_update" on student_documents;
create policy "docs_parent_update" on student_documents for update
  using (student_id in (select id from students where parent_id = auth.uid()))
  with check (student_id in (select id from students where parent_id = auth.uid()));

drop policy if exists "msg_own" on messages;
create policy "msg_own" on messages for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

drop policy if exists "msg_own_update" on messages;
create policy "msg_own_update" on messages for update using (
  sender_id = auth.uid() or recipient_id = auth.uid()
)
with check (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "msg_staff_select" on messages;
create policy "msg_staff_select" on messages for select using (
  establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur','professeur'))
);

drop policy if exists "beh_teacher" on behavior_notes;
create policy "beh_teacher" on behavior_notes for all
  using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
    or section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role in ('admin','censeur')
    )
  )
  with check (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
    or section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role in ('admin','censeur')
    )
  );

drop policy if exists "beh_parent" on behavior_notes;
create policy "beh_parent" on behavior_notes for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

revoke all on function public.record_fee_payment(uuid, numeric, payment_method, text, boolean) from public, anon;
revoke all on function public.confirm_fee_payment(uuid) from public, anon;
revoke all on function public.assign_fees_to_student(uuid) from public, anon;
revoke all on function public.seed_student_documents(uuid) from public, anon;
revoke all on function public.after_student_insert() from public, anon, authenticated;
revoke all on function public.send_school_message(uuid, uuid, text, text) from public, anon;
revoke all on function public.refresh_fee_status(uuid) from public, anon, authenticated;

grant execute on function public.record_fee_payment(uuid, numeric, payment_method, text, boolean) to authenticated;
grant execute on function public.confirm_fee_payment(uuid) to authenticated;
grant execute on function public.assign_fees_to_student(uuid) to authenticated;
grant execute on function public.send_school_message(uuid, uuid, text, text) to authenticated;
grant execute on function public.seed_student_documents(uuid) to authenticated;

grant select, insert, update, delete on table public.fee_categories to authenticated;
grant select, insert, update, delete on table public.student_fees to authenticated;
grant select, insert, update on table public.payments to authenticated;
grant select, insert, update, delete on table public.supply_lists to authenticated;
grant select, insert, update, delete on table public.supply_items to authenticated;
grant select, insert, update, delete on table public.student_supply_checks to authenticated;
grant select, insert, update on table public.student_documents to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant select, insert, update, delete on table public.behavior_notes to authenticated;
