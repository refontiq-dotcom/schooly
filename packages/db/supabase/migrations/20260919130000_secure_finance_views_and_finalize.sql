-- 20260919130000 — Restreindre les vues financières et la finalisation Trouvetou
-- Les deux vues financières et finalize_reservation sont utilisés côté serveur
-- avec service_role. Ils ne doivent pas constituer une API publique/authenticated.

revoke select on public.v_student_balances, public.v_student_fee_items_state from anon, authenticated;
grant select on public.v_student_balances, public.v_student_fee_items_state to service_role;

revoke execute on function public.finalize_reservation(uuid) from public, anon, authenticated;
grant execute on function public.finalize_reservation(uuid) to service_role;
