# Schooly — Plan des transferts et orientations

Statut : implémentation partielle locale — préparation des brouillons TRF/ORT avec code de suivi, sans transfert actif. Aucune migration appliquée sur la base de travail.
Le brouillon docs/drafts/20260917090000_student_transfers.sql.disabled n'est pas validé.

## 1. Origine du mouvement

| Préfixe | Type | Déclencheur | Gestion financière à l'accueil |
| --- | --- | --- | --- |
| TRF | Transfert volontaire | Parents, déménagement | Profil privé standard configuré pour l'année et le niveau ; quitus de départ selon les règles autorisées. |
| ORT | Orientation officielle | Décision ministérielle, notamment post-CEPE ou post-BEPC | Profil « Affecté par l'État » après vérification de la décision et de son bénéficiaire. |

Le type du mouvement est enregistré explicitement et doit correspondre au préfixe du code. Il ne peut pas être changé en modifiant le texte du code. Aucun préfixe REO, TFR ou AFF n'est prévu dans ce périmètre.

Format retenu : 8 caractères = préfixe de 3 lettres + 4 caractères aléatoires + 1 checksum. Les exemples TRF98X2K7 et ORT98X2K7 comptent 9 caractères et doivent être remplacés dans les maquettes. Le checksum inclut le préfixe. Génération aléatoire cryptographique côté serveur, unicité contrôlée en base, nouvelles tentatives en cas de collision.

Le checksum détecte certaines erreurs de saisie, sans authentifier le document. Le code court ne constitue jamais une autorisation suffisante d'accès au dossier d'un mineur : authentification, autorisation destinataire, limitation des tentatives et audit obligatoires. Le QR utilise un jeton opaque à forte entropie ; aucune donnée personnelle en clair.

## 2. Contrôles propres à ORT

Avant de valider une orientation :
- Exiger un matricule national officiel, distinct du matricule interne de l'inscription.
- Exiger la référence de décision, l'autorité émettrice, l'année et l'établissement destinataire ; contrôler l'identité et le niveau autorisé.
- Vérifier la décision auprès d'une source autorisée. Sans intégration officielle disponible, prévoir un contrôle documentaire par un rôle habilité, avec justificatif, auteur, date et résultat consignés. Ne pas prétendre disposer d'une connexion MENA non implémentée.
- Refuser toute auto-certification par la simple saisie de ORT ou le téléversement d'un document non vérifié.
- Un matricule absent, une discordance, une décision non vérifiée ou une destination incorrecte interdit la finalisation ORT et conduit à une revue administrative.

Une orientation vérifiée autorise l'importation malgré le verrou financier privé de départ, sous réserve de validation juridique et des règles administratives applicables. Cette dérogation est tracée pour ce mouvement seulement : elle n'efface ni dette, ni litige, ni historique comptable et ne lève pas globalement le verrou du dossier source. Les contrôles d'identité, d'autorisation, de destination, de validité et de non-réutilisation restent obligatoires.

Le quitus TRF et le partage inter-écoles d'informations financières nécessitent également une validation juridique ; en son absence, prévoir une alerte interne plutôt qu'un blocage automatique de scolarisation.

## 3. Raccordement aux inscriptions et finances

L'accueil choisit l'année, le niveau et la classe, compatibles avec la décision pour ORT. Le matricule national est conservé ; le matricule interne suit les règles de l'école d'accueil. Aucun compte parent ni accès enfant n'est automatiquement fusionné sur une simple correspondance de téléphone.

Les tarifs existants dépendent de l'école, de l'année, du niveau et du profil financier. Les montants sont en FCFA, sans centimes. Pour ORT, utiliser une correspondance explicite vers le profil local « Affecté par l'État », et non une recherche fragile par libellé. Si le profil ou le tarif manque, signaler une configuration à compléter : ne pas appliquer silencieusement le tarif privé ou un montant nul.

Prévoir séparément : montant pris en charge par l'État, reliquat dû par le parent, paiements de chaque payeur et suivi des sommes attendues/reçues. Une subvention attendue n'est pas un paiement encaissé. Le statut boursier/non-boursier est distinct du statut affecté ; aucune prise en charge ne se déduit du seul préfixe. Le support exact de cette ventilation reste à concevoir et tester dans la comptabilité existante.

Les dettes et paiements historiques restent dans l'école d'origine. La nouvelle inscription et la facturation SaaS doivent être créées une seule fois.

## 4. Cycle de vie et confirmation

DRAFT → ISSUED → CONSUMED ; expiration à 60 jours après émission et révocation possible avant consommation. Les vérifications administratives et financières sont distinctes de ces états.

À l'émission, consigner le motif et l'approbation direction ; pour ORT, ajouter la preuve de vérification officielle. La préparation ne clôture pas l'inscription d'origine.

La confirmation à l'accueil est atomique : revérifier droits, destination, expiration, quitus ou dérogation ORT ; verrouiller le transfert ; créer ou rapprocher le dossier local autorisé ; créer l'inscription et sa provenance ; consommer le transfert ; marquer l'inscription source transférée, sans effacer ses archives. Tout échec annule l'opération. Deux confirmations concurrentes ne créent pas deux inscriptions.

Les bulletins officiels antérieurs gardent leur provenance et leur contenu figé ; ils ne sont pas recalculés selon les règles d'accueil.

## 5. Interface

- Départ : action « Préparer un transfert / une orientation », motif, situation financière et justificatifs ORT, approbation direction, fiche A4 avec code et QR.
- Accueil : action « Inscrire via transfert ou orientation », scan ou saisie manuelle.
- Dès la saisie de ORT : afficher « Orientation à vérifier » et ouvrir la section « Administratif & Bourses » (référence de décision, matricule national, statut boursier/non-boursier). Ne pas afficher de certification à ce stade.
- Après validation serveur : badge bleu/or « Affecté par l'État » pour ORT, vert « Transfert privé » pour TRF autorisé. Un code syntaxiquement correct ne signifie pas que le dossier est importable.
- TRF bloqué : avertissement orange selon la politique financière validée. ORT vérifié avec dérogation : indiquer aux seuls agents habilités que l'importation est autorisée malgré le litige source, sans afficher publiquement son détail.
- Aperçu : identité et données sources en lecture seule, parcours avec provenance, nouvelle classe et matricule interne, profil financier déterminé selon le mouvement. Bouton « Confirmer & inscrire l'élève ».
- Erreur d'accès/code : message générique pour ne pas révéler l'existence d'un enfant à un acteur non autorisé.

## 6. Livraisons progressives

A. Audit des raccordements, distinction des matricules, règles TRF/ORT, vérification administrative, finances et import atomique par code. Vérifier le schéma de l'environnement réellement utilisé ; le conteneur local inspecté n'est pas une preuve du schéma distant.

B. Fiche A4 imprimable et scan QR avec saisie manuelle de secours. Aucun dossier personnel sur la page publique de vérification.

C. SMS/WhatsApp après choix du prestataire, coûts, consentements et règles d'envoi. Ne pas communiquer de données sensibles dans les notifications.

D. Demande inverse adressée à l'établissement source avec justificatifs, sans annuaire global permettant de rechercher librement les enfants.

E. Passeport scolaire multi-années, autorisations explicites et provenance des bulletins, de l'assiduité et des distinctions disponibles.

## 7. Critères de recette

- Codes : longueur, checksum incluant le préfixe, unicité, expiration, révocation, refus de réutilisation.
- ORT : un préfixe saisi seul ne certifie rien ; identité/matricule, référence, source officielle et destination vérifiés ; refus si ces contrôles manquent.
- Finances : TRF applique le quitus autorisé ; ORT vérifié déroge uniquement au verrou privé, sans effacer les dettes ; profil/tarif manquant signalé ; séparation État/parent ; aucune subvention attendue comptée comme encaissée.
- Inscription : année/niveau/classe cohérents, doublons traités sans rapprochement abusif, deux confirmations concurrentes produisent une seule inscription et une seule facturation SaaS.
- Confidentialité : isolation des écoles, accès parent préservé, absence de consultation publique des données personnelles, permissions revérifiées côté serveur.
- Archives : bulletins sources inchangés, inscription source transférée uniquement après succès complet, annulation intégrale en cas d'échec.

## 8. État et actions utilisateur

La préparation est implémentée dans `/dashboard/admissions/movements`, accessible depuis les admissions direction : sélection d’une inscription active, motif, déclarations ORT, enregistrement et liste des brouillons avec code de suivi. La migration correspondante est `20260917100000_student_movement_requests.sql`. Le matricule est repris de l’inscription, l’auteur de la session ; ORT reste non certifiée. Le code de suivi ne donne aucun accès inter-écoles.

Restaient non implémentés : validation administrative, émission/expiration/révocation d’un transfert actif, quitus, import atomique, ventilation État/parent, QR et notifications. L’import est désormais réalisé côté SQL (voir ci-dessous) ; il n’est pas encore exposé à l’écran. Ne pas appliquer le brouillon `.disabled`. Avant activation du transfert : valider les règles administratives/juridiques ORT et quitus, la source de vérification, la ventilation financière et l’environnement de référence.

## 9. Import TRF — socle SQL testé

La migration `20260917120000_student_movement_import.sql`, à appliquer après celle de l’activation, ajoute :

- `student_movement_destinations` : autorisation **nominative** d’une école d’accueil par la direction source, avec motif obligatoire (10 à 1000 caractères) ;
- `authorize_student_movement_destination(school_from, request_id, school_to, reason)` : réservée à la direction source, exige une activation TRF non expirée ;
- `consume_student_movement(tracking_code, school_to, class_id, academic_year_id)` : réservée à la direction de l’école d’accueil autorisée.

L’import est transactionnel et réalise dans une seule opération : création d’une fiche élève dans l’école d’accueil, création d’une nouvelle inscription (tuteur existant réutilisé, niveau déduit de la classe d’accueil), passage de l’inscription source en `transferred` et journalisation de l’import. Les notes, paiements et bulletins restent dans l’école d’origine.

Garanties vérifiées par le banc : accès refusé avant autorisation nominative, professeur refusé, ORT refusé, import réussi, inscription source conservée, journal unique, réutilisation du code refusée (`23505`).

Le code de suivi doit être **saisi** par l’école d’accueil : celle-ci ne peut pas lire la demande source (isolation RLS), ce qui est le comportement attendu.

Non couvert à ce stade : quitus financier automatique, ventilation État/parent, QR, notifications, révocation et copie des bulletins.

### Écran d’import (école d’accueil)

`/dashboard/admissions/import`, réservé à la direction (`DECISION_ROLES`, cohérent avec la RPC) :

- saisie du code en 8 caractères, normalisée (majuscules, espaces et tirets ignorés), avec contrôle local du **checksum** (`lib/movements/code.ts`) : une faute de frappe est signalée sans requête serveur ;
- badge distinctif `Transfert privé` (TRF) ou `Affecté par l’État` (ORT) ; ORT reste bloqué, l’import d’une orientation officielle n’étant pas disponible ;
- choix de la classe et de l’année d’accueil, puis appel de `consume_student_movement` avec l’école issue de la session (jamais du formulaire) ;
- aucun aperçu du dossier avant import : l’école d’accueil ne peut pas lire la demande source (isolation RLS), et ce comportement est volontaire.

L’algorithme de checksum est verrouillé des deux côtés : le banc SQL vérifie `movement_code_checksum('TRF0123') = 'E'`, valeur aussi testée côté TypeScript.

Accès : [mouvements TRF/ORT](/dashboard/admissions/movements) prépare et active côté école de départ ; l’import se fait côté école d’accueil.

Validation reproductible : `bash /home/dukoua/Projets/schooly/scripts/tests/movements-db.sh` (base jetable ; 48 assertions) et les tests d’écran du dossier `import`.


### Activation TRF — socle SQL local

La migration `20260917110000_student_movement_activation.sql`, à appliquer après celle des demandes, ajoute la RPC `activate_student_movement(school_id, request_id)`. Seule la direction (ou super_admin rattaché à l’école) peut activer TRF. L’activation séparée conserve le brouillon source, fixe une échéance de 60 jours et écrit un événement d’audit dans la même transaction. Les appels répétés ne prolongent pas la validité et ne doublent pas l’audit ; après échéance, la RPC renvoie `EXPIRED`.

Cette activation administrative ne constitue **ni un quitus financier, ni une autorisation d’importation**, et n’est pas encore raccordée à l’écran. ORT est explicitement refusé. La révocation, la vérification administrative, la destination autorisée et l’import atomique restent à développer. Aucun paiement, tarif, bulletin ou inscription n’est modifié. Aucune migration distante ni publication GitHub réalisée pour cette étape.

Validation reproductible : `bash /home/dukoua/Projets/schooly/scripts/tests/movements-db.sh` (base jetable ; préparation et activation). Ne pas activer ce socle en production comme un parcours de transfert complet.

