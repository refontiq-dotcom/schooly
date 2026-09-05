-- Schooly approval guard: a dossier cannot become approved unless the
-- document checklist is complete and there is no high duplicate risk.
-- This is enforced in PostgreSQL so it cannot be bypassed by another API/UI.

create or replace function public.guard_enrollment_approval()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.completeness_pct < 100 then
      raise exception 'Dossier incomplet : %%% de complétude', new.completeness_pct;
    end if;

    if new.duplicate_risk_score >= 80 then
      raise exception 'Risque de doublon élevé : validation bloquée';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_enrollment_approval on public.enrollment_applications;
create trigger trg_guard_enrollment_approval
before update of status on public.enrollment_applications
for each row
execute function public.guard_enrollment_approval();
