# Module Auth — Health

## Vue d'ensemble

Audit de cohérence entre `auth.users` (Supabase Auth) et `profiles` (données métier) : détection d'orphelins, sign-ups incomplets, doublons, comptes bannis.

## Migration

`supabase/migrations/20260903210000_auth_health.sql` — idempotente.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `profiles_orphan_auth` | Profils `public.profiles` sans entrée dans `auth.users` (FK cassée côté auth). |
| `auth_users_no_profile` | `auth.users` avec email confirmé mais sans profile (= inscription incomplète). |
| `duplicate_accounts` | Comptes avec le même email normalisé (plusieurs profils sur 1 email). |
| `auth_health_summary` | Résumé global : cohérents / orphelins / incomplets + `health_status`. |
| `banned_users` | Utilisateurs bannis (`banned_until` non nul) avec `status` (`active` / `banned` / `ban_expired`). |

## Nouvelles fonctions

| Fonction | Description |
|---|---|
| `audit_auth_health()` | Retourne JSON récapitulatif (summary + orphelins + incomplets + bannis + doublons). |
| `cleanup_orphan_profile(p_profile_id)` | Supprime un profile orphelin (avec garde-fou : refuse si pas orphelin). |

## Règles de santé

| Condition | `health_status` |
|---|---|
| Aucun orphelin + aucun incomplet | `healthy` |
| Au moins 1 orphelin | `has_orphan_profiles` |
| Aucun orphelin mais ≥ 1 incomplet | `has_incomplete_signups` |

## Logique TS miroir

`src/lib/auth-health/scoring.ts` — 5 fetchers + 2 wrappers RPC + 4 helpers purs.

## Tests

6 tests Vitest — **186/186 au total**.

## Pré-requis

- `public.profiles.id` FK vers `auth.users(id)` (déjà OK)
- Accès en lecture à `auth.users` (par défaut, le schema `auth` n'est pas accessible aux rôles non-service)
- Les vues `auth_users_no_profile`, `auth_health_summary`, `banned_users` accèdent à `auth.users` — **elles ne fonctionneront que pour le service_role** dans Supabase (RLS par défaut sur `auth.users`)

## Sécurité

- Toutes les vues `grant select to authenticated` — mais elles échoueront en RUNTIME pour les utilisateurs non-service_role à cause des restrictions d'accès à `auth.users`. Solution : exposer uniquement via des routes API côté serveur (`getSessionProfile()` avec service_role).
- `cleanup_orphan_profile` est `security definer` → à protéger par RLS supplémentaire si besoin.
