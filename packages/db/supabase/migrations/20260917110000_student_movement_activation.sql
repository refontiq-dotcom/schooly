-- Activation TRF administrative uniquement : ni quitus ni autorisation d'import.
begin;
create table public.student_movement_activations (
  request_id uuid primary key references public.student_movement_requests(id),
  school_id uuid not null references public.schools(id),
  activated_by uuid not null references public.users(id),
  activated_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > activated_at)
);
create table public.student_movement_activation_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.student_movement_activations(request_id),
  school_id uuid not null references public.schools(id),
  actor_id uuid not null references public.users(id),
  event text not null check (event = 'TRF_ACTIVATED'),
  occurred_at timestamptz not null
);
alter table public.student_movement_activations enable row level security;
alter table public.student_movement_activation_audit enable row level security;
create policy movement_activation_read on public.student_movement_activations for select to authenticated
  using (public.has_school_role(school_id,array['direction','super_admin']));
create policy movement_activation_audit_read on public.student_movement_activation_audit for select to authenticated
  using (public.has_school_role(school_id,array['direction','super_admin']));
revoke all on public.student_movement_activations, public.student_movement_activation_audit from anon, authenticated;
grant select on public.student_movement_activations, public.student_movement_activation_audit to authenticated;

-- L'état effectif est calculé à la lecture : aucun cron requis pour l'expiration.
-- Pas de recherche publique par code court, ni de lecture accordée à une autre école.
create function public.activate_student_movement(p_school_id uuid, p_request_id uuid)
returns table (tracking_code text, status text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  r public.student_movement_requests;
  a public.student_movement_activations;
  activated timestamptz;
begin
  if auth.uid() is null or not public.has_school_role(p_school_id,array['direction','super_admin']) then
    raise exception 'Activation réservée à la direction de cet établissement.' using errcode='42501';
  end if;
  select * into r from public.student_movement_requests
    where id=p_request_id and school_id=p_school_id for update;
  if not found then raise exception 'Demande indisponible.'; end if;
  if r.kind <> 'TRF' then
    raise exception 'La validation administrative ORT n’est pas encore disponible.';
  end if;
  -- Le verrou sur la demande sérialise les appels répétés/concurrents.
  select * into a from public.student_movement_activations where request_id=r.id;
  if found then
    return query select r.tracking_code,
      case when clock_timestamp() >= a.expires_at then 'EXPIRED' else 'ACTIVE' end, a.expires_at;
    return;
  end if;
  perform 1 from public.enrollments e join public.students s on s.id=e.student_id
    where e.id=r.enrollment_id and e.school_id=r.school_id and e.student_id=r.student_id
      and e.status='active' and e.deleted_at is null
      and s.school_id=r.school_id and s.deleted_at is null for share of e,s;
  if not found then raise exception 'Inscription source inactive ou incohérente.'; end if;
  activated := clock_timestamp();
  insert into public.student_movement_activations values
    (r.id,r.school_id,auth.uid(),activated,activated + interval '60 days') returning * into a;
  insert into public.student_movement_activation_audit(request_id,school_id,actor_id,event,occurred_at)
    values(r.id,r.school_id,auth.uid(),'TRF_ACTIVATED',activated);
  return query select r.tracking_code,'ACTIVE'::text,a.expires_at;
end $$;
revoke all on function public.activate_student_movement(uuid,uuid) from public, anon;
grant execute on function public.activate_student_movement(uuid,uuid) to authenticated;
commit;
