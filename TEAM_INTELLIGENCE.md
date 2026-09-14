# Module Équipe (RH/Staff) — Intelligence

## Vue d'ensemble

Vues d'effectif, détection d'inactivité, stats par établissement, engagement parents, export JSON.

## Migration

`supabase/migrations/20260903190000_team_intelligence.sql` — idempotente.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `team_overview` | Effectif par rôle (admin, prof, secrétariat, censeur, parent) + arrivées 7j/30j. |
| `team_inactive_members` | Staff sans action > 14/30/90 jours. Statut `active` / `low_activity` / `inactive` / `critical` / `never`. |
| `team_establishment_stats` | KPI staffing : nombre par rôle, ratio élèves/prof, statut (`complete` / `missing_*`). |
| `team_parent_engagement` | Engagement parents : nb enfants, messages lus, paiements confirmés, niveau. |

## Nouvelle fonction

| Fonction | Description |
|---|---|
| `export_team_summary(p_establishment_id)` | Résumé JSON : stats, breakdown rôles, nb inactifs. |

## Règles métier

### Activité
| Dernière action | Statut |
|---|---|
| > 90 jours | `critical` |
| > 30 jours | `inactive` |
| > 14 jours | `low_activity` |
| < 14 jours | `active` |
| Jamais | `never` |

### Staffing
| Condition | Statut |
|---|---|
| Aucun admin | `missing_admin` |
| Aucun prof | `missing_teachers` |
| Aucun secrétariat | `missing_secretariat` |
| Sinon | `complete` |

### Engagement parent
| Condition | Niveau |
|---|---|
| Aucun enfant | `no_children` |
| 0 message reçu et enfants | `silent` |
| ≥ 80 % lecture | `engaged` |
| Sinon | `normal` |

## Logique TS miroir

`src/lib/team-intelligence/scoring.ts` — 4 fetchers + `exportTeamSummary` + 3 helpers purs.

## Tests

4 tests Vitest — **175/175 au total**.

## Pré-requis

Tables : `profiles` (avec `role` et `establishment_id`), `students` (avec `parent_id`), `messages`, `grades`, `attendance_records`, `payments`, `student_fees`, `reservations`.
