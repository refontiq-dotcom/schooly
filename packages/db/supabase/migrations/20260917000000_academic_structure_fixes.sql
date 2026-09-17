-- ============================================================================
-- 20260917000000 — Correctifs module Structure académique
--
-- 1. DROP enrollment_decisions : table fantôme (migration 20260913100000) qui
--    se prétendait « source de vérité » du panneau de bascule alors que le
--    code lit/écrit academic_decisions. Deux tables de décisions = divergence
--    garantie. La seule source de vérité reste academic_decisions (pédagogie).
-- 2. Unicité d'une année « en cours » par école : index unique partiel.
--    Empêche structurellement l'état « deux années actives » qui rendait
--    currentYear arbitraire (notes, appels et bascule rattachés à la
--    mauvaise année).
-- 3. RPC activate_academic_year : clôture + activation en UNE transaction.
--    Avant, deux updates séparés — si le second échouait, l'école restait
--    sans aucune année active (saisie des notes et appel bloqués).
-- Idempotent : IF EXISTS / IF NOT EXISTS / create or replace.
-- ============================================================================

-- ─── 1. Suppression de la table fantôme ─────────────────────────────────────
drop table if exists public.enrollment_decisions cascade;

-- ─── 2. Une seule année « en cours » par école ──────────────────────────────
-- Dédoublonnage préalable (deterministe : on garde la plus ancienne) pour que
-- l'index unique puisse être créé même sur une base déjà incohérente.
with ranked as (
  select id,
         row_number() over (
           partition by school_id
           order by created_at asc, id asc
         ) as rn
  from public.academic_years
  where status = 'en_cours'
    and deleted_at is null
)
update public.academic_years a
set status = 'cloturee'
from ranked dup
where a.id = dup.id
  and dup.rn > 1;

create unique index if not exists academic_years_school_one_active
  on public.academic_years (school_id)
  where status = 'en_cours' and deleted_at is null;

-- ─── 3. RPC atomique d'activation d'année ───────────────────────────────────
-- Appelé par la Server Action activateAcademicYear (client service_role,
-- rôle déjà vérifié côté applicatif). Si appelé directement par un utilisateur
-- authentifié (auth.uid() non nul), le rôle direction/super_admin est revérifié
-- ici — défense en profondeur.
create or replace function public.activate_academic_year(p_year_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_status text;
begin
  select school_id, status
    into v_school, v_status
  from public.academic_years
  where id = p_year_id
    and deleted_at is null;

  if v_school is null then
    raise exception 'YEAR_NOT_FOUND';
  end if;

  if v_status = 'cloturee' then
    raise exception 'YEAR_CLOSED';
  end if;

  -- Défense en profondeur : si l'appelant est un utilisateur authentifié
  -- (et non le service_role du serveur), revérifier son rôle.
  if auth.uid() is not null then
    if not exists (
      select 1 from public.user_school_roles usr
      where usr.user_id = auth.uid()
        and usr.school_id = v_school
        and usr.is_active = true
        and usr.role_code in ('direction', 'super_admin')
    ) then
      raise exception 'UNAUTHORIZED';
    end if;
  end if;

  -- Déjà active : no-op idempotent (deuxième clic = pas d'effet de bord).
  if v_status = 'en_cours' then
    return 'en_cours';
  end if;

  update public.academic_years
  set status = 'cloturee'
  where school_id = v_school
    and status = 'en_cours'
    and deleted_at is null;

  update public.academic_years
  set status = 'en_cours'
  where id = p_year_id;

  return 'en_cours';
end;
$$;

revoke all on function public.activate_academic_year(uuid) from public, anon;
grant execute on function public.activate_academic_year(uuid)
  to authenticated, service_role;
