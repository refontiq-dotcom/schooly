-- ============================================================================
-- 20260918120000 — Grants authenticated sur le socle tenancy & structure
--
-- Constat (production, 18/09) : toute Server Action passant par la garde
-- requireSchoolRole renvoyait « Aucune école rattachée » pour des comptes
-- pourtant rattachés (role_code = direction/super_admin, is_active = true).
--
-- Cause racine : erreur 42501 permission denied. Une policy RLS n'est évaluée
-- qu'APRÈS le privilège SQL de base sur la table ; les tables créées par les
-- migrations du socle (20260908090000, 20260908110000) n'ont AUCUN GRANT.
-- 20260912010000 (service_role_grants) n'avait couvert que service_role —
-- or la garde lit user_school_roles avec le client de session (rôle
-- authenticated) : Postgres refusait avant même d'atteindre la policy
-- usr_read, la garde avalait l'erreur → NO_SCHOOL pour tous.
--
-- Périmètre : privilèges minimaux alignés sur les policies existantes
-- (moindre privilège : pas d'écriture là où le code écrit via service_role ;
-- la RLS continue de borner les lignes visibles).
-- Idempotent : un GRANT est ré-exécutable sans erreur (convention 20260912010000).
-- ============================================================================

-- ─── Socle tenancy (20260908090000) ─────────────────────────────────────────
-- user_school_roles : lu par requireSchoolRole — la garde de ~100 Server Actions.
grant select on public.user_school_roles to authenticated;
-- roles : catalogue des rôles (policy roles_read, sélecteurs de rôle).
grant select on public.roles to authenticated;
-- schools : lecture membre (sidebar, garde) ; update réservé direction par policy.
grant select, update on public.schools to authenticated;
-- users : profil self + collègues de l'école (policy users_self_read) ; self-update.
grant select, update on public.users to authenticated;
-- school_features : feature flags lus par les membres (policy features_member_read).
grant select on public.school_features to authenticated;

-- ─── Structure académique (20260908110000) ──────────────────────────────────
-- Lectures des listes. Les écritures passent par le client service_role
-- (writeContext) : select seul suffit ici, les policies « for all »
-- direction/super_admin restent la barrière d'un éventuel appel direct.
grant select on public.academic_years to authenticated;
grant select on public.grade_levels to authenticated;
grant select on public.classes to authenticated;
grant select on public.subjects to authenticated;
grant select on public.class_subject_assignments to authenticated;
