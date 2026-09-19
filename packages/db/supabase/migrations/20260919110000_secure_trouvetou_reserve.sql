-- 20260919110000 — Sécuriser RPC Trouvetou reserve_seat
-- La RPC est appelée uniquement par le serveur Schooly via service_role.
-- SECURITY DEFINER ne doit pas rester exécutable par PUBLIC/anon.

revoke execute on function public.reserve_seat(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.reserve_seat(uuid, text, bigint) to service_role;

comment on function public.reserve_seat(uuid, text, bigint) is
  'Réserve une place Trouvetou après paiement en vérifiant la capacité réelle et les réservations encore valides. Appel serveur uniquement.';
