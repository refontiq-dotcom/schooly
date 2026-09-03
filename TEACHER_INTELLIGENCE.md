# Schooly — Dashboard Professeur intelligent

Ce document complète `RESERVATION_INTELLIGENCE.md` et `PAYMENT_INTELLIGENCE.md`
en décrivant l'intelligence ajoutée au module **Professeur** : agrégats de
classe, détection de décrochage, prédiction de moyennes et saisie en lot.

## Pourquoi rendre le dashboard Professeur « intelligent » ?

Le dashboard v1 ne montrait qu'une liste de classes/sections et un tableau
« élève par élève » sans agrégat. Les professeurs n'avaient aucune vision
de la performance de leur classe ni d'alerte sur les élèves en difficulté.
La saisie de note était unitaire.

Ce module apporte :

1. **Une vue agrégée par classe** (moyenne, médiane, taux de présence,
   nombre d'élèves, distribution des notes).
2. **Des alertes précoces de décrochage** sur 4 critères :
   - baisse de moyenne > 30% entre 2 notes consécutives ;
   - 3+ absences non justifiées sur 14 jours ;
   - 2+ notes comportement « à surveiller » ou « incident » sur 30 jours ;
   - moyenne générale < 8/20 sur les 30 derniers jours.
3. **Une prédiction de moyenne** projetée 3 évaluations à l'avance (régression
   linéaire simple sur les deltas consécutifs).
4. **Une saisie en lot** des notes d'une évaluation (1 matière × N élèves).
5. **Un classement inter-classes** par niveau (moyenne comparative).
6. **Une distribution par buckets** (excellent / bien / moyen / fragile / critique).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Vue SQL : class_dashboard                                              │
│    → KPI temps réel par section (moyenne, médiane, présence 30j)       │
│                                                                         │
│  Vue SQL : students_at_risk                                             │
│    → Détection décrochage multi-critères                                │
│                                                                         │
│  Vue SQL : student_predictions                                          │
│    → predict_student_average(student_id, subject?) → moyenne projetée  │
│                                                                         │
│  Vue SQL : class_grade_distribution                                     │
│    → Histogramme par bucket (excellent / critique)                      │
│                                                                         │
│  Vue SQL : student_report_card                                          │
│    → Bulletin par matière pour les 120 derniers jours                   │
│                                                                         │
│  Vue SQL : class_ranking                                                │
│    → Classement des sections d'un même niveau (moyenne 90j)             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Détection de décrochage (algorithme)

Un élève passe en alerte si **au moins 1** des 4 critères est rempli.
Le niveau d'alerte global est :
- `low` si 0 critère ;
- `medium` si 1 critère ;
- `high` si 2+ critères.

Implémentation miroir TypeScript dans
[`src/lib/teacher-intelligence/scoring.ts`](src/lib/teacher-intelligence/scoring.ts)
(testée par 31 invariants).

## Prédiction de moyenne

`predict_student_average(student_id, subject?)` :

1. Calcule la moyenne actuelle sur 60 jours.
2. Calcule la tendance = moyenne des deltas entre notes consécutives.
3. Projette : `moyenne + tendance × 3`.

Miroir TS dans le même fichier (`predictAverage({ scoresOrdered, horizon })`).

## Saisie en lot

`bulkAddGrades(sectionId, subject, evaluationType, entries[], date?)`
— server action qui insère N notes en une fois. Filtre les entrées
invalides (NaNa,Score négatif, max_score ≤ 0).

`bulkMarkAttendance(sectionId, entries[], sessionDate?)` —
saisie en lot des présences (upsert).

## Dashboards

| Route | Contenu |
|---|---|
| `/dashboard/professeur` | Vue d'ensemble : alertes globales top 10 + cartes par niveau (badge moyenne de classe sur chaque section) |
| `/dashboard/professeur/classe/[id]` | KPI classe + distribution + alertes précoces + saisie en lot + tableau présence/moyenne/prédiction + comportement |

## Migration à appliquer

```bash
supabase/migrations/20260903110000_teacher_intelligence.sql
```

Ajouter cette ligne dans le `README.md` après la migration Paiements.

## Tests

```
src/lib/teacher-intelligence/scoring.test.ts          — 31 tests
```

Total projet : **117 tests passent** (`npx vitest run`).

## Évolutions à venir

- Génération de bulletins PDF par trimestre (intégration `pdfkit`)
- Détection d' élèves à « haut potentiel » (notes excellentes récurrentes)
- Comparaison automatique entre années scolaires
- Recommandations pédagogiques (matières à renforcer) basées sur les deltas par matière