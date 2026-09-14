# Module Internat — Intelligence

## Vue d'ensemble

Le module Internat a été enrichi pour passer d'un outil de gestion de lits à un **tableau de bord opérationnel temps réel** avec détection automatique des situations critiques.

## Migration

Fichier : `supabase/migrations/20260903130000_internat_intelligence.sql`

Idempotente. À exécuter dans le Supabase SQL Editor.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `internat_dashboard` | KPI temps réel : lits (total / occupés / libres / maintenance), taux d'occupation, incidents 7j & 30j, **incidents graves non résolus**, visites du jour. |
| `internat_students_at_risk` | Élèves avec historique d'incidents, scoring `low/medium/high/critical`. |
| `internat_health_summary` | Suivi santé par élève : dernière visite, température moyenne 30j, épisodes de fièvre 7j, sous médication, **drapeau `needs_check`** si pas de visite depuis 30j. |
| `internat_meal_coverage` | Pour chaque repas (30 derniers jours) : présents / absents / taux de présence. |
| `internat_occupancy_trends` | Historique 90 jours d'occupation par établissement (granularité jour). |

## Nouvelles fonctions

| Fonction | Description |
|---|---|
| `suggest_bed_assignment(p_student_id uuid)` | Rotation optimale des lits : 1) lit libre d'un bloc mixte, 2) sinon n'importe quel lit libre. Renvoie l'UUID du lit ou `NULL`. |
| `compute_student_attendance_rate(p_student_id uuid, p_days int default 30)` | Taux de présence au roll-call d'un élève sur N jours (%). |

## Logique TS miroir

Fichier : `src/lib/internat-intelligence/scoring.ts`

Expose les types et fetchers :
- `fetchInternatDashboard(supabase, establishmentId)`
- `fetchStudentsAtRisk(supabase, establishmentId)`
- `fetchHealthSummary(supabase, establishmentId)`
- `fetchMealCoverage(supabase, establishmentId, limit?)`
- `fetchOccupancyTrends(supabase, establishmentId)`
- `suggestBedAssignment(supabase, studentId)`
- `computeAttendanceRate(supabase, studentId, days?)`

Plus les helpers purs (testables sans Supabase) :
- `computeRiskLevel({ openGrave, incidents30d, serious30d })` → `low | medium | high | critical`
- `summarizeOccupancy(row)` → `"75/100 (75%)"`
- `isDashboardCritical(row)` → `boolean` (true si au moins 1 incident grave ouvert)

## Règles métier

### Score de risque élève
| Condition | Niveau |
|---|---|
| Au moins 1 incident **grave** non résolu | `critical` |
| ≥ 3 incidents sur 30 jours | `high` |
| ≥ 2 incidents sérieux (majeur/grave) sur 30 jours | `medium` |
| Sinon | `low` |

### Couverture repas
- Le taux de présence < 80 % déclenche une alerte côté UI.
- Repas sans `internat_meal_attendance` enregistré : `attendance_count = 0` → taux `NULL` (à investiguer).

### Suggestion de lit
- Priorité 1 : lit libre (`status = 'libre'` ET aucune assignation active) dans un bloc `gender = 'mixte'`.
- Priorité 2 : n'importe quel bloc avec un lit libre.
- Tri stable : `room.number` puis `bed.bed_number`.

## Tests

Fichier : `src/lib/internat-intelligence/__tests__/scoring.test.ts`

Couvre les 3 helpers purs (`computeRiskLevel`, `summarizeOccupancy`, `isDashboardCritical`). 7 tests passent (143/143 au total).

## Sécurité
- Toutes les vues sont en `grant select to authenticated, service_role`.
- Les fonctions sont en `security definer` et `stable`, avec `set search_path = public` (anti-search-path-hijack).

## Prochaines pistes
- UI : dashboard `dashboard/admin/internat` à brancher sur `fetchInternatDashboard` (KPI temps réel) + bandeau élèves à risque.
- UI : page incidents à brancher sur `internat_students_at_risk` (tri par niveau de risque).
- Notifications WhatsApp aux parents si `has_recent_fever = true` (à venir).
- Graphique d'occupation 90j (recharts) pour visualiser les tendances.
