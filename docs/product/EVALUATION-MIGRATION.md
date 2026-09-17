
## Lot 2 — évaluations attendues

- Déclaration immuable par classe, matière et période, autorisée à la direction
  et aux professeurs affectés. Nouvelle saisie obligatoirement rattachée.
- Barème, catégorie et poids imposés par la base, unicité par élève/évaluation.
- Complétude serveur : nombre de notes ou ABS renseignées / nombre attendu.
  Les notes historiques non rattachées restent provisoires ; aucune association
  automatique par intitulé. Une matière sans évaluation attendue reste incomplète.
- Écran raccordé : déclaration, sélection de l'évaluation, saisie et couverture.
- Restent hors de ce lot : corrections auditées, rattachement des anciennes notes,
  validation annuelle et bulletins officiels. Les coefficients restent ceux de
  la matrice actuelle (pas encore de snapshot).

## Lot 3 — corrections auditées

- Aucun UPDATE direct depuis l'API : toute modification passe par
  `correct_evaluation_grade()` avec motif obligatoire (1–2000 caractères).
- Journal `grade_corrections` : ancienne/nouvelle valeur, statut, commentaire,
  auteur et horodatage ; colonne `revision` sur chaque note (démarre à 1).
- Modification simultanée refusée (`40001`) : la version périmée est rejetée,
  l'écran invite à recharger.
- Période clôturée : aucune correction ni saisie ni déclaration.
- Journal visible par l'école, invisible pour les autres (RLS).
- Restent hors de ce lot : rattachement des anciennes notes, validation annuelle,
  bulletins officiels.

## SQL à appliquer sur la base cible

Les fichiers complets sont dans le dépôt, à exécuter **dans cet ordre** :

1. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917040000_evaluation_rules_periods.sql`
2. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917050000_evaluation_assessments.sql`
3. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917060000_grade_corrections.sql`

N'appliquer que les migrations pas encore appliquées sur la base cible ; ne jamais
les rejouer. Elles supposent les migrations antérieures Schooly déjà installées.
Faire une sauvegarde et tester sur préproduction avant application en production.
Déployer ensemble migration et application : le nouveau formulaire exige la table
des évaluations attendues, la correction exige la colonne `revision`.

Dans Supabase SQL Editor, coller le contenu intégral de chaque fichier et exécuter
séparément. Chaque fichier contient sa transaction BEGIN/COMMIT. Si l'historique
est géré par la CLI Supabase, préférer le flux habituel de migrations du projet
plutôt que mélanger exécution manuelle et historique CLI.

Alternative psql (DATABASE_URL doit cibler explicitement la bonne base) :

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917040000_evaluation_rules_periods.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917050000_evaluation_assessments.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917060000_grade_corrections.sql
```

Vérification après migration :

```sql
select to_regclass('public.evaluation_rules'),
       to_regclass('public.evaluation_periods'),
       to_regclass('public.evaluation_assessments'),
       to_regclass('public.grade_corrections');
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'grade_entries'
  and column_name in ('period_id', 'absence_status', 'assessment_id', 'revision');
```

Aucune migration n'a été appliquée à la base cible par l'agent : les tests SQL
(38/38 assertions pgTAP sur les lots 1 à 3) utilisent uniquement une base jetable.
Vitest : 204 tests réussis. TypeScript : exit 0. ESLint : exit 0 sur les fichiers
touchés. Le build Next.js a dépassé sa limite de 300 secondes sans verdict sur
cette machine saturée ; il n'est donc pas validé.
