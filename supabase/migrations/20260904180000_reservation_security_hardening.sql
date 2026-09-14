-- ============================================================================
-- SÉCURITÉ RÉSERVATIONS — fermeture de l'insertion anonyme directe (idempotent)
-- ============================================================================
-- La table reservations avait une policy d'insertion publique ouverte
-- (« Création publique de réservation », with check (status = 'pending_payment')).
-- Elle permettait à n'importe quel porteur de la clé anon d'insérer des lignes
-- directement via PostgREST, en contournant la logique applicative :
--   - scoring du parent (compute_parent_trust_score) ;
--   - détection de fraude (detect_reservation_fraud) ;
--   - attribution atomique de section (anti-survente).
--
-- Toutes les créations passent désormais par l'API (route /api/reservations)
-- qui appelle create_reservation_smart() — security definer, executée avec le
-- rôle serveur. La policy d'insertion est donc supprimée : anon et authenticated
-- ne peuvent plus insérer directement. Le service_role n'est jamais soumis à RLS.
-- ============================================================================

drop policy if exists "Création publique de réservation" on public.reservations;

-- ----------------------------------------------------------------------------
-- Durcissement des RPC de places : réservées au service (routes API + staff).
-- Les RPC ci-dessous réservent/libèrent des places physiques ; elles ne doivent
-- jamais être appelables directement par le client.
-- ----------------------------------------------------------------------------
revoke all on function public.reserve_seat(uuid) from public, anon, authenticated;
grant execute on function public.reserve_seat(uuid) to service_role;

revoke all on function public.increment_section_seats(uuid) from public, anon;
revoke all on function public.decrement_section_seats(uuid) from public, anon;
revoke all on function public.transfer_student_to_section(uuid, uuid) from public, anon;
revoke all on function public.remove_student_from_class(uuid) from public, anon;
grant execute on function public.increment_section_seats(uuid) to service_role;
grant execute on function public.decrement_section_seats(uuid) to service_role;
grant execute on function public.transfer_student_to_section(uuid, uuid) to service_role;
grant execute on function public.remove_student_from_class(uuid) to service_role;
