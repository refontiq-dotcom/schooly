# Module Classes — Intelligence

## Vue d'ensemble

Le module Classes (config niveaux/sections + quotas) a été enrichi pour passer d'un outil de configuration à un **tableau de bord de remplissage temps réel** avec détection automatique des déséquilibres et suggestion de section.

## Migration

Fichier : `supabase/migrations/20260903140000_classes_intelligence.sql`

Idempotente. À exécuter dans le Supabase SQL Editor.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `class_section_fill_rates` | Taux de remplissage par section : `capacity`, `seats_taken`, `fill_rate_pct`, `seats_available`, `fill_status` (`full` / `almost_full` / `normal` / `low`). |
| `class_level_fill_rates` | Agrégat par niveau : `sections_count`, `total_capacity`, `total_taken`, `fill_rate_pct`. |
| `class_balance_alerts` | Sections en état critique (complète ou sous-remplie < 30 %), avec `alert_level` (`critical` / `warning` / `info` / `ok`). |
| `class_capacity_summary` | KPI établissement : taux global, places dispo, nombre de niveaux complets / sous-remplis / normaux. |
| `class_teacher_workload` | Charge des profs principaux : `homeroom_sections`, `homeroom_capacity`, `workload_level` (`none` / `low` / `normal` / `high`). |

## Nouvelles fonctions

| Fonction | Description |
|---|---|
| `suggest_section_for_level(p_level_id uuid)` | Renvoie l'UUID de la section la plus pertinente (place libre, la moins remplie, tri stable par places restantes DESC). |
| `compute_level_fill_rate(p_level_id uuid)` | Taux de remplissage d'un niveau (%). |

## Logique TS miroir

Fichier : `src/lib/classes-intelligence/scoring.ts`

Expose les types et fetchers :
- `fetchClassCapacitySummary(supabase, establishmentId)`
- `fetchClassLevelFillRates(supabase, establishmentId)`
- `fetchClassSectionFillRates(supabase, establishmentId)`
- `fetchClassBalanceAlerts(supabase, establishmentId)`
- `fetchTeacherWorkload(supabase, establishmentId)`
- `suggestSectionForLevel(supabase, levelId)`
- `computeLevelFillRate(supabase, levelId)`

Plus les helpers purs (testables sans Supabase) :
- `summarizeFillStatus(rate)` → `FillStatus`
- `isAlertCritical(alert)` → `boolean`
- `colorForFillStatus(status)` → `'red' | 'orange' | 'amber' | 'green' | 'slate'`

## Règles métier

### Statut de remplissage
| Taux | Statut |
|---|---|
| ≥ 100 % | `full` |
| 90-99 % | `almost_full` |
| 50-89 % | `normal` |
| < 50 % | `low` |

### Niveau d'alerte
| Condition | Niveau |
|---|---|
| `fill_status = full` | `critical` |
| `fill_status = low` ET `fill_rate_pct < 30` | `warning` |
| `fill_status = low` | `info` |
| Sinon | `ok` |

### Charge prof principal
| Nb sections | Niveau |
|---|---|
| ≥ 4 | `high` |
| 2-3 | `normal` |
| 1 | `low` |
| 0 | `none` |

## UI

`src/app/dashboard/admin/classes/page.tsx` enrichie :
- Bandeau 4 cards : remplissage global, places dispo, niveaux complets, niveaux sous-remplis
- Section alertes (top 6 critiques) avec couleurs
- Barres de progression par section et par niveau
- Affichage du % de remplissage par ligne de section

## Tests

Fichier : `src/lib/classes-intelligence/__tests__/scoring.test.ts`

7 tests couvrent `summarizeFillStatus`, `isAlertCritical`, `colorForFillStatus`. **150/150 tests passent** au total.

## Prochaines pistes
- Auto-affecter les nouveaux élèves à la bonne section via `suggest_section_for_level` lors de la finalisation d'une réservation.
- Alerte email/WhatsApp à l'admin quand un niveau passe à 100 %.
- Vue prof : bandeau charge de travail + lien vers ses classes.
- Re-équilibrage automatique (suggestion de transfert d'élèves entre sections).
