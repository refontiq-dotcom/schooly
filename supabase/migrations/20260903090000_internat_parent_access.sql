-- ============================================================================
-- SCHOOLY — Accès parent au module internat
-- ============================================================================
-- Le module internat (20260902180000_internat_module.sql) ne prévoyait aucune
-- policy RLS pour le rôle "parent", alors que plusieurs tables (notamment
-- internat_health.parent_notified) supposent explicitement une communication
-- vers les parents. Cette migration ouvre un accès en lecture strictement
-- scopé à l'enfant du parent connecté, sans toucher aux droits d'écriture
-- (qui restent réservés au staff de l'établissement).
-- ============================================================================

-- Affectation chambre/lit : un parent doit pouvoir savoir où loge son enfant.
do $$ begin
  create policy "Parent voit l'affectation de son enfant" on internat_assignments
    for select using (
      student_id in (select id from public.students where parent_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- Bâtiment / chambre / lit : lecture limitée au logement de son propre enfant
-- (pas de vue sur l'ensemble de l'internat, contrairement au staff).
do $$ begin
  create policy "Parent voit le bâtiment de son enfant" on internat_blocks
    for select using (
      id in (
        select r.block_id
        from internat_rooms r
        join internat_beds bd on bd.room_id = r.id
        join internat_assignments a on a.bed_id = bd.id
        join public.students s on s.id = a.student_id
        where s.parent_id = auth.uid() and a.status = 'actif'
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Parent voit la chambre de son enfant" on internat_rooms
    for select using (
      id in (
        select bd.room_id
        from internat_beds bd
        join internat_assignments a on a.bed_id = bd.id
        join public.students s on s.id = a.student_id
        where s.parent_id = auth.uid() and a.status = 'actif'
      )
    );
exception when duplicate_object then null; end $$;

-- Présence à l'appel : uniquement les lignes concernant son propre enfant,
-- jamais la liste complète du bâtiment.
do $$ begin
  create policy "Parent voit les appels de son enfant" on internat_roll_items
    for select using (
      student_id in (select id from public.students where parent_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- Incidents concernant son enfant.
do $$ begin
  create policy "Parent voit les incidents de son enfant" on internat_incidents
    for select using (
      student_id in (select id from public.students where parent_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- Visites déclarées pour son enfant.
do $$ begin
  create policy "Parent voit les visites de son enfant" on internat_visits
    for select using (
      student_id in (select id from public.students where parent_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- Suivi santé : uniquement une fois que le staff a explicitement marqué
-- l'enregistrement comme communiqué au parent (parent_notified = true).
-- Cela laisse à l'établissement la main sur le moment et la façon dont une
-- information médicale sensible est partagée, plutôt qu'une diffusion
-- automatique dès la saisie.
do $$ begin
  create policy "Parent voit le suivi santé notifié de son enfant" on internat_health
    for select using (
      parent_notified = true
      and student_id in (select id from public.students where parent_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

grant select on internat_blocks, internat_rooms, internat_beds, internat_assignments,
  internat_roll_items, internat_incidents, internat_visits, internat_health
  to authenticated;
