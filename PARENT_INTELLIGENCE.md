# Schooly — Dashboard Parent intelligent

Ce document complète `RESERVATION_INTELLIGENCE.md`, `PAYMENT_INTELLIGENCE.md` et
`TEACHER_INTELLIGENCE.md` en décrivant l'intelligence ajoutée au module
**Parent** : synthèse 360° par enfant, score de satisfaction, alertes
contextualisées, positionnement dans la classe, résumé WhatsApp.

## Pourquoi rendre le dashboard Parent « intelligent » ?

Le dashboard parent v1 n'affichait qu'un seul enfant (`students[0]`) avec
des KPIs plats, sans vision globale ni aide à la décision. Les parents
multi-enfants devaient naviguer manuellement.

Ce module apporte :

1. **Support multi-enfants** automatique (sélecteur dans la page).
2. **Score de satisfaction global 0..50** agrégé en (assiduité 30j + moyenne 30j + frais à jour + docs complets − comportement).
3. **Alertes contextualisées** par enfant avec icônes et codes couleur (grade_drop / absences / low_attendance / fees_overdue / docs_missing / behavior / excellence).
4. **Positionnement dans la classe** (rang, taille de la classe, percentile).
5. **Courbe de progression** par matière (moyenne glissante sur 3 notes).
6. **Résumé WhatsApp** prêt à partager (fonction SQL + miroir TS).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Vue SQL : parent_dashboard_summary                                    │
│    → 1 ligne par enfant rattaché, avec 12 KPIs agrégés                │
│                                                                         │
│  Vue SQL : student_class_ranking                                       │
│    → Rang + percentile de l'élève parmi sa classe                      │
│                                                                         │
│  Vue SQL : parent_progression                                          │
│    → Courbe par matière (moyenne glissante sur 3 notes)               │
│                                                                         │
│  Vue SQL : parent_alerts                                               │
│    → Liste JSON d'alertes structurées par enfant                       │
│                                                                         │
│  Fonction : generate_parent_whatsapp_summary(student_id)               │
│    → Texte formaté Markdown pour WhatsApp                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Score de satisfaction parent (0..50)

Formule (avant division par 2) :
- **Assiduité** : `attendancePct` (0..100, défaut 70)
- **Moyenne** : `currentAverage × 2` (plafonné 40)
- **Frais à jour** : +20 si `feesOverdueCount = 0`
- **Docs OK** : +10 si `docsMissingCount = 0`
- **Pénalité comportement** : `-5 × behaviorConcernsCount`

Résultat brut clampé 0..100, divisé par 2 → score final 0..50.

| Couleur | Plage | Interprétation |
|---|---|---|
| 🟢 emerald | ≥ 40 | Tout va bien |
| 🟡 amber | 30..39 | Quelques points à améliorer |
| 🟠 orange | 20..29 | Vigilance |
| 🔴 red | < 20 | Action requise |

## Alertes

7 types d'alertes générées automatiquement :

| Type | Sévérité | Condition |
|---|---|---|
| `grade_drop` | high | Baisse > 30% entre les 2 dernières notes et les 2 précédentes |
| `absences` | high | ≥ 3 absences non justifiées sur 14 jours |
| `low_attendance` | medium | Taux de présence < 75% sur 30 jours |
| `fees_overdue` | high | Au moins une échéance en retard |
| `docs_missing` | medium | Au moins un doc obligatoire manquant |
| `behavior` | medium | ≥ 2 signalements "à surveiller/incident" sur 30 jours |
| `excellence` | positive | Moyenne ≥ 16/20 (alerte positive !) |

## Résumé WhatsApp

`generate_parent_whatsapp_summary(student_id)` retourne un texte multi-ligne
prêt à coller dans WhatsApp :

```
📚 *Aya Kouassi* — 6ème / 6ème1
🎯 Moyenne : *14.5/20*
📅 Assiduité 30j : *95%*
🏆 Rang : *3e / 30*
💰 Restant : *50 000 FCFA* (⚠️ 2 en retard)
```

Miroir TypeScript dans
[`src/lib/parent-intelligence/scoring.ts`](src/lib/parent-intelligence/scoring.ts).

## Dashboard

`/dashboard/parent` affiche désormais pour **chaque enfant** :

- Bandeau titre + score de satisfaction global
- Liste des alertes (icônes + codes couleur)
- 5 KPI : moyenne, rang, assiduité, restant dû, docs manquants, absences
- 2 colonnes : assiduité (10 dernières) + dernières notes
- Frais (4 premiers) + Documents (5 premiers)
- Comportement (récent)

## Migration à appliquer

```bash
supabase/migrations/20260903120000_parent_intelligence.sql
```

## Tests

```
src/lib/parent-intelligence/scoring.test.ts          — 19 tests
```

Total projet : **136 tests passent** (`npx vitest run`).

## Évolutions à venir

- Notifications WhatsApp automatiques basées sur les alertes critiques
- Graphique de progression interactif (front-only avec SVG)
- Comparaison entre enfants (pour parents multi-enfants)
- Recommandations proactives (« pensez à fournir le carnet de vaccination »)