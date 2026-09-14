# Module Professeur — Intelligence v2

## Vue d'ensemble

Vague 2 du module Professeur : vues **centrées sur l'enseignant connecté** (workload, élèves en commun, comparatif de ses classes, retards de saisie). Complète la v1 (vue par classe, prédiction de moyenne).

## Migration

Fichier : `supabase/migrations/20260903150000_teacher_intelligence_v2.sql`

Idempotente. À exécuter dans le Supabase SQL Editor.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `teacher_my_classes` | Synthèse des classes où le prof enseigne (par matière), avec moyenne matière, nb notes 7j, indicateur `is_homeroom`. |
| `teacher_my_at_risk_students` | Élèves à risque filtrés par `teacher_assignments` (un prof ne voit que les élèves de SES classes). |
| `teacher_workload_summary` | Charge globale : nb classes, matières, paires (classe×matière), élèves homeroom, notes saisies 7j, présences 7j, `workload_level`. |
| `teacher_homeroom_overview` | Classes dont le prof est `homeroom_teacher_id` : capacité, élèves, moyenne, nb à risque. |
| `teacher_classes_comparison` | Comparatif côte-à-côte : moyenne matière vs moyenne générale de la classe, écart-type. |
| `teacher_pending_grades` | Sessions de présence 3-10 jours sans note enregistrée dans la même matière (= devoir à corriger / retard de saisie). |

## Nouvelles fonctions

| Fonction | Description |
|---|---|
| `compute_teacher_global_average(p_teacher_id uuid, p_days int default 90)` | Moyenne globale (toutes classes, toutes matières) sur N jours. |

## Logique TS miroir

Fichier : `src/lib/teacher-intelligence/scoring-v2.ts`

Expose types, helpers et fetchers :
- `fetchTeacherMyClasses`, `fetchTeacherAtRiskStudents`, `fetchTeacherWorkload`
- `fetchTeacherHomeroom`, `fetchTeacherClassesComparison`, `fetchTeacherPendingGrades`
- `computeTeacherGlobalAverage`
- Helpers purs : `workloadLabel`, `isWorkloadHigh`, `pendingGradeUrgency`

## Règles métier

### Charge prof
| Nb classes | Niveau |
|---|---|
| ≥ 6 | `high` |
| 3-5 | `normal` |
| 1-2 | `low` |
| 0 | `none` |

### Urgence retard de saisie
| Jours depuis session | Urgence |
|---|---|
| ≥ 8 | `urgent` |
| 5-7 | `soon` |
| 3-4 | `ok` |

## UI

`src/app/dashboard/professeur/page.tsx` enrichie :
- 4 KPIs : classes, élèves homeroom, notes 7j, charge
- Bandeau amber "notes en retard" (sessions sans note saisie)
- Garde les alertes globales existantes (élèves à risque)

## Tests

Fichier : `src/lib/teacher-intelligence/__tests__/scoring-v2.test.ts`

6 tests couvrent les 3 helpers purs. **156/156 tests passent** au total.

## Pré-requis

Tables supposées existantes (déjà en base via `schema.sql` + `migration-operations.sql`) :
- `public.profiles` (id, role, full_name, establishment_id)
- `public.teacher_assignments` (teacher_id, section_id, subject)
- `public.sections` (id, level_id, name, capacity, seats_taken, homeroom_teacher_id)
- `public.levels` (id, name, rank)
- `public.grades` (id, student_id, section_id, recorded_by, subject, score, max_score, evaluation_date)
- `public.attendance_records` (id, student_id, section_id, recorded_by, session_date, present)
- `public.students_at_risk` (vue v1)

## Prochaines pistes
- Tableau de bord prof par matière (moyennes comparées par section et sujet)
- Suggestion d'élèves à accompagner en fonction de la trajectoire
- Alerte email/WhatsApp au prof quand un élève passe en `high` risk
- Vue planning (si table `class_sessions` ajoutée plus tard)
