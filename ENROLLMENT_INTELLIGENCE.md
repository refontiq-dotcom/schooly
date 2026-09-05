# Module Inscriptions — Intelligence

Le module d'inscription ne remplace pas la réservation existante : il la transforme en dossier d'admission exploitable par le secrétariat.

## Flux

`Réservation → Dossier → Contrôles intelligents → Documents → Recommandation de classe → Validation humaine → Élève`

## Réutilisation de l'existant

- `reservations` reste la source de la réservation de place.
- `students` reste la source de l'élève opérationnel.
- `inscription_modalities` fournit les modalités et documents requis.
- `student_documents` continue de gérer les documents du dossier élève.
- `finalize_reservation()` réalise le passage vers l'élève réel.

## Nouvelles tables

- `enrollment_applications`: dossier de candidature/inscription, état, complétude, risque doublon et recommandation.
- `enrollment_documents`: checklist documentaire avant la création du dossier élève.

## Intelligence

`compute_enrollment_intelligence()` calcule :

1. doublon élève potentiel ;
2. réservation active en doublon ;
3. incohérence téléphone/nom parent ;
4. pourcentage de complétude ;
5. section recommandée selon le taux de remplissage.

Une recommandation n'est jamais une décision automatique : le personnel valide l'inscription.

## Écrans

- Secrétariat : `/dashboard/secretariat/inscriptions`
- Parent : `/dashboard/parent/inscriptions`

## API

- `POST /api/reservations` initialise automatiquement le dossier d'inscription après une réservation.
- `PATCH /api/enrollment/:id` permet au personnel d'étudier, mettre en attente, refuser ou valider.

## Sécurité

Les RPC d'orchestration sont réservées au `service_role`; le pipeline et les dossiers sont protégés par RLS selon établissement et utilisateur.
