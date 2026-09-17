
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

## Lot 4 — résultats annuels et décision validée par la direction

- Moteur d'aperçu annuel (`annual.ts`) : trois trimestres, deux semestres ou
  compositions primaire (40 % régulières, 60 % passage), sans arrondi
  intermédiaire ; contrôle des périodes manquantes, doublons, chevauchements
  et moyennes invalides. Une période incomplète empêche toute admission.
- Aperçu serveur (`getAnnualPreview`) : cumul par régime à partir des moyennes
  de période, décision proposée (`admitted`/`rescuable`/`deferred`/`incomplete`),
  motifs de blocage et empreinte des données **calculée en SQL uniquement**
  (`annual_input_fingerprint`) : règles, coefficients, évaluations attendues,
  périodes et notes (avec révision) — jamais recalculée côté client.
- Validation officielle (`validateAnnualDecision` → RPC
  `validate_annual_decision`) : transactionnelle, réservée à la direction,
  elle revérifie l'empreinte (`40001` si les données ont changé depuis
  l'aperçu), la clôture de toutes les périodes et la cohérence du seuil et de
  la marge de rachat, puis enregistre la décision avec instantané
  (`academic_decisions.validated_at/input_fingerprint/snapshot`).
- Immuabilité : une décision validée ne peut plus être modifiée ni revalidée ;
  les notes de l'élève validé sont verrouillées en écriture
  (`lock_validated_grade_writes`), en complément des verrous de période.
- Écran : section 6 « Aperçu annuel et décision proposée » avec calcul par
  classe/année, motifs de non-validabilité et formulaire de validation
  (choix de décision borné à ce que la règle autorise).
- Migration à appliquer :
  `20260917070000_annual_validation.sql` (aucune nouvelle table, étend
  `academic_decisions`).
- Restent hors de ce lot : bulletins officiels, publication aux parents/élèves,
  rattachement des anciennes notes sans période.
- Validation : banc SQL 43/43 assertions (dont validation, revalidation
  refusée, décision persistée, écriture de note refusée après validation) ;
  suite Vitest 222/222 ; TypeScript Schooly réussi.



## Lot 5 — bulletins officiels

- Réutilise `report_cards` (aucune table concurrente) : colonnes `content jsonb`
  (instantané figé) et `version` ; trigger `report_cards_history_guard` :
  un bulletin publié devient immuable (contenu/version figés, suppression
  refusée, seule transition `sent → archived` autorisée).
- Génération par classe (`generate_class_report_cards`, RPC transactionnelle,
  direction uniquement) : uniquement les élèves à décision validée, refuse si
  les données ont changé depuis la validation (empreinte revérifiée), contenu
  calculé **en SQL** sur les notes gelées (moyennes par matière et par période,
  ABS exclues, coefficients, décision annuelle, règles appliquées) ; idempotent
  (upsert, régénération = nouvelle version tant que non publié, ignoré après).
- Publication par classe (`publish_class_report_cards`) : statut `sent` — c'est
  lui qui rend le bulletin visible côté familles et élèves.
- PWA parent (`getBulletinData`) : ajoute `official` — uniquement le bulletin
  publié, avec ses résultats figés ; affiché en section « Résultats annuels
  officiels » du bulletin (impression/PDF inclus).
- Portail élève : section « Bulletin officiel » avec le contenu publié.
- Écran direction : section 7 « Bulletins officiels » (générer / publier).
- Migration à appliquer : `20260917080000_report_cards_publish.sql`.
- Restent hors de ce lot : PDF binaire en tâche de fond (les bulletins sont des
  instantanés JSON imprimables), notifications, rattachement des anciennes
  notes sans période.
- Validation : banc SQL 53/53 (génération, contenu figé, publication,
  regénération sans effet, suppression et falsification refusées) ; Vitest
  222/222 ; TypeScript Schooly et pwa-parent réussis.


## SQL à appliquer sur la base cible

Les fichiers complets sont dans le dépôt, à exécuter **dans cet ordre** :

1. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917041000_evaluation_rules_periods.sql`
2. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917051000_evaluation_assessments.sql`
3. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917060000_grade_corrections.sql`
4. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917070000_annual_validation.sql`
5. `/home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917080000_report_cards_publish.sql`

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
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917041000_evaluation_rules_periods.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917051000_evaluation_assessments.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917060000_grade_corrections.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917070000_annual_validation.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /home/dukoua/Projets/schooly/packages/db/supabase/migrations/20260917080000_report_cards_publish.sql
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
