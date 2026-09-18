-- ============================================================================
-- 20260918160000 — Réinscription en ligne & recherche du parent par téléphone
--
-- Contexte produit : la réinscription ne doit PAS être un formulaire. Le parent
-- confirme simplement que son enfant continue dans le même établissement ; le
-- système retrouve l'élève par le téléphone du parent (déjà connu en base) et
-- propose la classe suivante.
--
-- Problème bloquant constaté : `guardians.phone` est la clé d'unicité du tuteur
-- (ensureGuardian) mais il est écrit dans des formats DIFFÉRENTS selon le canal :
--   • formulaire public  → formatGuardianPhone  → « +225 07 00 00 00 00 »
--   • guichet / Trouvetou → saisie brute        → « 0700000000 » ou « +2250700000000 »
-- Un `where phone = $1` ne retrouve donc PAS le parent selon le canal d'origine.
--
-- Correctif : une colonne dérivée `phone_norm` (format canonique « +225XXXXXXXXXX »)
-- maintenue par trigger, indexée, puis backfillée sur les lignes existantes.
-- La recherche du parent passe désormais par `phone_norm`, jamais par `phone`.
--
-- Idempotent : réexécution sans risque (colonnes/index en `if not exists`,
-- trigger recréé, backfill conditionné par `is distinct from`).
-- ============================================================================

-- ─── 1. Normalisation téléphone (source unique de vérité, côté SQL) ─────────
-- Miroir JS : apps/schooly/src/lib/reinscription.ts → normalizePhone().
-- Les deux implémentations doivent rester alignées (test unitaire dédié).
create or replace function public.normalize_phone(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p_raw is null then
    return null;
  end if;

  d := regexp_replace(p_raw, '\D', '', 'g');
  if d = '' then
    return null;
  end if;

  -- « 00225XXXXXXXXXX » → retrait du préfixe international « 00225 »
  if d like '00225%' then
    d := substr(d, 6);
  -- « 225XXXXXXXXXX » (indicatif sans « + ») → retrait de « 225 »
  elsif d like '225%' and length(d) > 10 then
    d := substr(d, 4);
  end if;

  return '+225' || d;
end;
$$;

comment on function public.normalize_phone(text) is
  'Format canonique d''un numéro ivoirien : « +225 » + chiffres, sans espaces. Null si aucun chiffre.';

-- ─── 2. Colonne dérivée + trigger sur guardians ─────────────────────────────
alter table public.guardians
  add column if not exists phone_norm text;

create or replace function public.set_guardian_phone_norm()
returns trigger
language plpgsql
as $$
begin
  new.phone_norm := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_guardians_phone_norm on public.guardians;
create trigger trg_guardians_phone_norm
  before insert or update of phone on public.guardians
  for each row execute function public.set_guardian_phone_norm();

-- Backfill des lignes existantes (ne touche que celles divergentes)
update public.guardians
   set phone_norm = public.normalize_phone(phone)
 where phone_norm is distinct from public.normalize_phone(phone);

create index if not exists idx_guardians_phone_norm
  on public.guardians (phone_norm)
  where phone_norm is not null and deleted_at is null;

-- ─── 3. Accès du parent à son tableau de bord par le téléphone ──────────────
-- Le même numéro qui a servi à l'inscription ouvre le tableau de bord parent
-- (apps/pwa-parent) : ce lien rattache la fiche `guardians` à un compte
-- Supabase Auth. Le rôle `parent` existe déjà (roles_seed) et n'a pas de
-- tableau de bord dans l'app admin — il est servi par la PWA parente.
alter table public.guardians
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists guardians_user_id_unique
  on public.guardians (user_id)
  where user_id is not null and deleted_at is null;

comment on column public.guardians.user_id is
  'Compte Auth du parent (accès PWA parent). Rattrapé par téléphone : guardians.phone_norm.';

-- ─── 4. Origine d'une pré-inscription (traçabilité) ─────────────────────────
-- Permet de distinguer une demande venue du formulaire public, du connecteur
-- Trouvetou (réinscription en un clic) ou saisie au guichet — indispensable
-- pour mesurer l'adoption et diagnostiquer les doublons.
alter table public.pre_enrollments
  add column if not exists source text not null default 'form';

alter table public.pre_enrollments
  drop constraint if exists pre_enrollments_source_check;

alter table public.pre_enrollments
  add constraint pre_enrollments_source_check
  check (source in ('form', 'trouvetou', 'counter'));

create index if not exists idx_pre_enrollments_source
  on public.pre_enrollments (school_id, source)
  where deleted_at is null;

-- ─── 5. Droits du socle (cf. 20260918120000) ────────────────────────────────
-- Les tables du socle n'ont été grantées qu'à service_role ; la fonction est
-- exécutée par le rôle `authenticated` via la garde applicative.
grant execute on function public.normalize_phone(text) to authenticated;
grant select on public.guardians to authenticated;
