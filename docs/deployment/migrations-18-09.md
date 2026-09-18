# Rattrapage des migrations du 18/09

## En une commande

Coller **un seul script** dans Supabase → SQL Editor :

```
packages/db/supabase/migrations/20260918180000_catchup_18_09.sql
```

Il regroupe les 6 migrations du 18/09, est **idempotent** (le recoller ne casse
rien) et se termine par une requête de contrôle. Aucun redéploiement n'est
nécessaire : les GRANT et les colonnes s'appliquent immédiatement.

## Ce qu'il contient

| Ordre | Migration d'origine | Objet |
|---|---|---|
| 1/6 | `20260918120000` | **GRANT `authenticated`** sur `user_school_roles`, `roles`, `schools`, `users`, `school_features`, `academic_years`, `grade_levels`, `classes`, `subjects`, `class_subject_assignments` |
| 2/6 | `20260918130000` | `guardian_relation`, `emergency_contact_name/phone` (pré-inscriptions + tuteurs) |
| 3/6 | `20260918140000` | `previous_school`, `previous_class` (pré-inscriptions + élèves) |
| 4/6 | `20260918150000` | `enrollment_type`, `state_orientation`, `orientation_number`, `previous_matricule` |
| 5/6 | `20260918160000` | `normalize_phone()`, `guardians.phone_norm` + trigger, `guardians.user_id`, `pre_enrollments.source` |
| 6/6 | `20260918170000` | Correctif `finalize_reservation()` (`birth_date` → `date_of_birth`, anti-doublon) |

## Pourquoi le 1/6 est indispensable

Symptôme observé : **« Aucune école rattachée »** pour tous les comptes, même
`direction` / `super_admin` avec `is_active = true`.

Chaîne réelle : la garde `requireSchoolRole` lit `user_school_roles` avec le
client de session (`authenticated`). Or les tables du socle n'avaient **aucun
GRANT** — `20260912010000` n'avait couvert que `service_role`. Postgres refusait
en `42501 permission denied` **avant même d'évaluer la policy RLS**, et la garde
convertissait la donnée nulle en `NO_SCHOOL`.

D'où le contre-intuitif : `service_role` (SQL Editor, `register-school`, login)
lisait tout, mais l'application non. Et `42501` ne dépend pas de la ligne : même
un compte parfaitement rattaché échouait.

## Après exécution

1. Se **déconnecter / reconnecter** (le temps que la session soit relue).
2. Vérifier `/api/health` → `"db": "connected"`.
3. Tester l'onglet **Structure académique** : les listes se chargent, la création
   de niveau fonctionne.
4. Tester le formulaire **/enroll/[schoolId]** : toutes les sections doivent
   s'enregistrer sans erreur `column ... does not exist`.
