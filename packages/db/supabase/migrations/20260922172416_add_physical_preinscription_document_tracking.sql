-- Suivi administratif des pièces physiques d'une préinscription.
-- Aucun fichier ni objet Storage n'est associé à ces lignes.
create table if not exists public.preinscription_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  reservation_id uuid not null references public.trouvetou_reservations(id) on delete cascade,
  required_document_id uuid references public.required_documents(id) on delete set null,
  document_label text not null check (trim(document_label) <> ''),
  required boolean not null default true,
  status text not null default 'missing' check (status in ('missing','received','verified','rejected')),
  received_at timestamptz,
  received_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  verified_by uuid references public.users(id) on delete set null,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, required_document_id)
);

create index if not exists idx_preinscription_documents_reservation on public.preinscription_documents (reservation_id);
create index if not exists idx_preinscription_documents_school_status on public.preinscription_documents (school_id, status);

drop trigger if exists trg_preinscription_documents_updated_at on public.preinscription_documents;
create trigger trg_preinscription_documents_updated_at before update on public.preinscription_documents
for each row execute function public.touch_updated_at();

alter table public.preinscription_documents enable row level security;

drop policy if exists preinscription_documents_member_read on public.preinscription_documents;
create policy preinscription_documents_member_read on public.preinscription_documents for select
using (is_super_admin() or is_school_member(school_id));

drop policy if exists preinscription_documents_direction_write on public.preinscription_documents;
create policy preinscription_documents_direction_write on public.preinscription_documents for all
using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']))
with check (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']));

grant all on public.preinscription_documents to service_role;

create or replace function public.snapshot_required_documents_for_reservation()
returns trigger
language plpgsql
as $$
begin
  insert into public.preinscription_documents (school_id, reservation_id, required_document_id, document_label, required)
  select d.school_id, new.id, d.id, d.nom, d.obligatoire
  from public.required_documents d
  where d.school_id = new.school_id and d.deleted_at is null
    and (d.applicable_to_level_id is null or d.applicable_to_level_id = new.grade_level_id)
  on conflict (reservation_id, required_document_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_snapshot_required_documents on public.trouvetou_reservations;
create trigger trg_snapshot_required_documents after insert on public.trouvetou_reservations
for each row execute function public.snapshot_required_documents_for_reservation();

create or replace function public.sync_missing_required_documents_for_reservation(p_reservation_id uuid)
returns integer
language plpgsql
as $$
declare inserted_count integer;
begin
  insert into public.preinscription_documents (school_id, reservation_id, required_document_id, document_label, required)
  select r.school_id, r.id, d.id, d.nom, d.obligatoire
  from public.trouvetou_reservations r
  join public.required_documents d on d.school_id = r.school_id and d.deleted_at is null
    and (d.applicable_to_level_id is null or d.applicable_to_level_id = r.grade_level_id)
  where r.id = p_reservation_id
  on conflict (reservation_id, required_document_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.sync_missing_required_documents_for_reservation(uuid) from public;
revoke execute on function public.snapshot_required_documents_for_reservation() from public;
grant execute on function public.sync_missing_required_documents_for_reservation(uuid) to service_role;