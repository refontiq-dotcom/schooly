# Module Onboarding — Intelligence

## Vue d'ensemble

Suivi de l'onboarding des établissements : étapes complétées, taux de complétion, next step, création atomique établissement + profil admin.

## Migration

`supabase/migrations/20260903200000_onboarding_intelligence.sql` — idempotente.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `onboarding_progress` | Pour chaque établissement : 10 étapes (description, cover, 360°, frais, niveaux, sections, profs, staff, élèves, publication) + `completion_pct` + `next_step` intelligent. |
| `establishments_incomplete` | Sous-ensemble où `completion_pct < 100`, trié par complétion ASC. |
| `establishments_by_type` | Agrégat par `school_type` (privé/public/confessionnel/etc.) : total, publiés, nouveaux 30j, total élèves. |

## Nouvelles fonctions

| Fonction | Description |
|---|---|
| `create_establishment_with_admin(p_name, p_city, p_school_type, p_description, p_address, p_reservation_fee_amount, p_actor_id)` | Crée l'établissement ET lie le profil admin en une transaction. |
| `compute_onboarding_completion(p_establishment_id)` | % de complétion (0-100). |

## Étapes trackées (10)

1. Description
2. Image de couverture
3. Visite 360°
4. Frais de réservation configurés
5. Niveaux créés
6. Sections créées
7. Profs invités
8. Staff (secrétariat/censeur) invité
9. Élèves ajoutés
10. Publication Trouvetou

## Logique `next_step` (ordre de priorité)

1. Aucun niveau → "Créer les niveaux"
2. Aucune section → "Créer les sections"
3. Aucun prof/staff → "Inviter l'équipe"
4. Aucun élève → "Ajouter les premiers élèves"
5. Non publié → "Publier sur Trouvetou"
6. Pas de cover → "Ajouter une image"
7. Pas de 360° → "Ajouter une visite virtuelle"
8. Pas de frais → "Configurer les frais"
9. Sinon → "Configuration complète !"

## Logique TS miroir

`src/lib/onboarding-intelligence/scoring.ts` — 3 fetchers + 2 wrappers RPC + 2 helpers purs.

## Tests

5 tests Vitest — **180/180 au total**.

## Pré-requis

Tables : `establishments` (avec school_type enum, published_to_trouvetou), `profiles`, `levels`, `sections`, `students`. Enum `school_type`.
