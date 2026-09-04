-- ============================================================================
-- SCHOOLY — Modalités d'inscription (4 septembre 2026)
-- ============================================================================
-- Système intelligent de gestion des différentes voies d'inscription :
-- standard, bourse, transfert, fratrie, convention
-- ============================================================================

-- 1. Enum des modalités d'inscription
do $$ begin
  create type inscription_modality as enum (
    'standard',      -- Inscription normale avec frais complets
    'bourse',        -- Bourse / aide financière (réduction ou exonération)
    'transfert',     -- Transfert depuis un autre établissement
    'fratrie',       -- Réduction fratrie (2ème enfant, etc.)
    'convention'     -- Convention entreprise / partenariat
  );
exception
  when duplicate_object then null;
end $$;

-- 2. Table des modalités d'inscription par établissement
-- Chaque établissement configure ses propres modalités avec les frais associés
create table if not exists inscription_modalities (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  modality inscription_modality not null,
  name text not null,                          -- Nom affiché ex: "Bourse de mérite"
  description text,                            -- Description pour les parents
  fee_multiplier numeric(5,2) not null default 1.0,  -- 0 = gratuit, 0.5 = 50%, 1.0 = plein tarif
  required_documents text[],                   -- Documents spécifiques requis
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, modality)
);

create index if not exists idx_inscription_modalities_establishment
  on inscription_modalities (establishment_id);

-- 3. Ajouter la colonne modality aux réservations
alter table reservations
  add column if not exists modality inscription_modality default 'standard';

-- 4. Ajouter la colonne modality aux étudiants
alter table students
  add column if not exists modality inscription_modality default 'standard';

-- 5. Vue : réservations enrichies avec les infos de modalité
create or replace view reservations_with_modality as
select
  r.*,
  im.name as modality_name,
  im.fee_multiplier,
  im.description as modality_description,
  e.name as establishment_name,
  l.name as level_name,
  s.name as section_name
from reservations r
left join inscription_modalities im
  on im.establishment_id = r.establishment_id
  and im.modality = r.modality
left join establishments e on e.id = r.establishment_id
left join levels l on l.id = r.level_id
left join sections s on s.id = r.section_id;

-- 6. Vue : statistiques des modalités par établissement
create or replace view modality_stats as
select
  establishment_id,
  modality,
  count(*) as total_enrollments,
  count(*) filter (where status = 'confirmed') as confirmed_enrollments
from reservations
where modality is not null
group by establishment_id, modality;

-- 7. RLS pour inscription_modalities
alter table inscription_modalities enable row level security;

-- Admin peut tout faire sur les modalités de son établissement
drop policy if exists "Admin gère les modalités de son établissement" on inscription_modalities;
create policy "Admin gère les modalités de son établissement"
  on inscription_modalities for all
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

-- Tout le monde peut lire les modalités actives (pour affichage public)
drop policy if exists "Lecture publique des modalités actives" on inscription_modalities;
create policy "Lecture publique des modalités actives"
  on inscription_modalities for select
  using (is_active = true);

-- 8. Données de démonstration : modalités pour les établissements existants
insert into inscription_modalities (establishment_id, modality, name, description, fee_multiplier, required_documents)
select
  e.id,
  'standard'::inscription_modality,
  'Inscription standard',
  'Inscription avec frais de scolarité complets',
  1.0,
  array['acte_naissance', 'photo_identite', 'bulletin_precedent']
from establishments e
on conflict (establishment_id, modality) do nothing;

insert into inscription_modalities (establishment_id, modality, name, description, fee_multiplier, required_documents)
select
  e.id,
  'bourse'::inscription_modality,
  'Bourse / Aide financière',
  'Inscription réduite ou gratuite sous conditions de revenus',
  0.0,
  array['acte_naissance', 'photo_identite', 'bulletin_precedent', 'justificatif_revenus', 'attestation_bourse']
from establishments e
on conflict (establishment_id, modality) do nothing;

insert into inscription_modalities (establishment_id, modality, name, description, fee_multiplier, required_documents)
select
  e.id,
  'transfert'::inscription_modality,
  'Transfert scolaire',
  'Transfert depuis un autre établissement',
  1.0,
  array['acte_naissance', 'photo_identite', 'bulletin_precedent', 'certificat_scolarite', 'releve_notes']
from establishments e
on conflict (establishment_id, modality) do nothing;

insert into inscription_modalities (establishment_id, modality, name, description, fee_multiplier, required_documents)
select
  e.id,
  'fratrie'::inscription_modality,
  'Réduction fratrie',
  'Réduction pour les 2ème enfants et suivants',
  0.8,
  array['acte_naissance', 'photo_identite', 'bulletin_precedent', 'justificatif_fratrie']
from establishments e
on conflict (establishment_id, modality) do nothing;

-- 9. Fonction pour calculer les frais selon la modalité
create or replace function calculate_modality_fees(
  p_establishment_id uuid,
  p_modality inscription_modality,
  p_base_amount numeric
) returns numeric
language plpgsql
stable
as $$
declare
  v_multiplier numeric;
begin
  select fee_multiplier into v_multiplier
  from inscription_modalities
  where establishment_id = p_establishment_id
    and modality = p_modality
    and is_active = true;

  if v_multiplier is null then
    v_multiplier := 1.0;
  end if;

  return round(p_base_amount * v_multiplier, 2);
end;
$$;

grant execute on function calculate_modality_fees(uuid, inscription_modality, numeric) to authenticated;
