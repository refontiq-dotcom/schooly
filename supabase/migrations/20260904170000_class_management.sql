-- ============================================================================
-- GESTION DES CLASSES — RPC seats + transfert d'élèves (idempotent)
-- ============================================================================

create or replace function public.increment_section_seats(p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sections
    set seats_taken = seats_taken + 1
    where id = p_section_id
      and seats_taken < capacity;
  if not found then
    raise exception 'Section complète ou introuvable';
  end if;
end;
$$;

create or replace function public.decrement_section_seats(p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sections
    set seats_taken = greatest(seats_taken - 1, 0)
    where id = p_section_id;
end;
$$;

-- Transfert atomique d'un élève vers une autre section (anti-désynchronisation)
create or replace function public.transfer_student_to_section(
  p_student_id uuid,
  p_target_section_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_section uuid;
begin
  select section_id into v_old_section from students where id = p_student_id for update;
  if v_old_section is null then
    raise exception 'Élève introuvable';
  end if;
  if v_old_section = p_target_section_id then
    return;
  end if;

  update sections
    set seats_taken = seats_taken + 1
    where id = p_target_section_id
      and seats_taken < capacity;
  if not found then
    raise exception 'Classe cible complète';
  end if;

  update students set section_id = p_target_section_id where id = p_student_id;
  update sections set seats_taken = greatest(seats_taken - 1, 0) where id = v_old_section;
end;
$$;

-- Retrait d'un élève : libère la place
create or replace function public.remove_student_from_class(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section uuid;
begin
  select section_id into v_section from students where id = p_student_id for update;
  if v_section is null then
    raise exception 'Élève introuvable';
  end if;
  delete from students where id = p_student_id;
  update sections set seats_taken = greatest(seats_taken - 1, 0) where id = v_section;
end;
$$;

grant execute on function
  public.increment_section_seats(uuid),
  public.decrement_section_seats(uuid),
  public.transfer_student_to_section(uuid, uuid),
  public.remove_student_from_class(uuid)
to authenticated;
