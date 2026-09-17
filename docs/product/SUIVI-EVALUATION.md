## État du lot 1 (évaluation intelligente)

Implémenté dans le commit 455a2a5, testé et validé :

- `apps/schooly/src/lib/evaluation/calculations.ts` — moteur de calcul pur :
  normalisation de barème, poids et pourcentages par catégorie, ABS ≠ 0 ≠
  manquant, moyennes matière/période/année (3 régimes), proposition de
  décision sans arrondi intermédiaire.
- `packages/db/supabase/migrations/20260917040000_evaluation_rules_periods.sql`
  — `evaluation_rules`, `evaluation_periods`, `grade_entries.period_id` et
  `absence_status`, vérification d'ouverture/verrouillage côté base, RLS durcie
  sur les notes (professeur limité à ses affectations classe × matière).
- `apps/schooly/src/app/dashboard/pedagogie/grades/` — écran unique :
  configuration (direction), calendrier + clôture, saisie note/ABS,
  moyennes par période calculées côté serveur, marquées provisoires.
- Portails parent/élève et anciennes API : notes périodiques exclues
  (`period_id is null`) tant que la publication officielle n'existe pas.
- Tests : 11 Vitest (moteur), 15 pgTAP sur base jetable via
  `scripts/tests/evaluation-db.sh`, 3 tests d'écran React.

Reste à faire (lots suivants) :

1. Appliquer la migration sur la base cible, puis régénérer les types.
2. Évaluations attendues par classe/matière + complétude réelle (§7.3.2).
3. Corrections avec versionnement/audit (§7.3.3) — UPDATE interdit en lot 1.
4. Cumul annuel, proposition de décision modérable, `academic_decisions` (§7.3.2.C).
5. Bulletins : snapshots + QR signé, `report_cards`, diffusion Realtime (§7.3.6–7.3.7).
6. Simulateur d'objectifs, notifications, charge (§7.3.8–7.3.9).
