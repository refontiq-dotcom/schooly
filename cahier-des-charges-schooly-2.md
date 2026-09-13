# Cahier des Charges — SCHOOLY

*SaaS de gestion scolaire multi-établissements — Côte d'Ivoire / Afrique de l'Ouest*
*Document de référence pour l'agent IA de développement*
*Version 1.2 — généralisation du parcours d'inscription (configurable par établissement, virement bancaire, rappel MENAET)*

> ⚠️ **À lire avant toute reprise de développement** : deux documents transverses ont été créés après la version initiale de ce cahier des charges — `refontiq-architecture-ecosysteme.md` et `refontiq-plan-de-travail-prompts.md`. Ils introduisent des composants partagés à l'échelle de tout l'écosystème Refontiq (pas seulement Schooly), qui remplacent ou complètent certaines sections ci-dessous. Les sections concernées sont annotées. En cas de doute, les documents d'écosystème font foi sur les questions transverses (facturation, identité, alertes internes).

## Sommaire
1. Vision & positionnement
2. Principes directeurs non négociables
3. Stack technique recommandée
4. Architecture multi-tenant & sécurité
5. Modèle de données — vue d'ensemble
6. Rôles & permissions (RBAC)
7. Cahier des charges fonctionnel par module
8. Design system & exigences UI/UX
9. Exigences non-fonctionnelles
10. Roadmap de développement (phases pour l'agent)
11. Checklist de démarrage immédiat
12. Propositions d'amélioration stratégiques
13. Definition of Done
14. Facturation SaaS — modèle « 1000 FCFA / élève »
15. Glossaire

---

## 1. Vision & positionnement

Schooly est une plateforme SaaS de gestion scolaire pensée pour la réalité du terrain ouest-africain : inscriptions en grande partie physiques, budgets serrés, connectivité instable, forte proportion d'élèves affectés par l'État dans le privé.

**Objectif produit** : remplacer le cahier registre papier et les tableurs Excel dispersés par un outil unique, léger, utilisable sans formation, qui couvre tout le cycle de vie de l'élève — de la pré-inscription en ligne à la délivrance du diplôme — tout en restant économiquement viable pour des écoles à faible budget (infrastructure « free-tier »).

**Différenciateurs clés** :
- Écosystème avec **Trouvetou** (plateforme de découverte d'écoles) : la pré-inscription en ligne alimente directement le pipeline du secrétariat.
- Architecture **texte-only, zéro fichier lourd** : le dossier papier reste physique, seule une empreinte numérique légère est stockée (~0,5 Ko/élève), ce qui permet de tourner sur des offres cloud gratuites.
- Prise en charge native de la dualité **élève affecté par l'État / élève privé**, réalité qui concerne 50 à 80 % des effectifs en Côte d'Ivoire.
- Modules matériels (terminaux Android, imprimantes thermiques) pour verrouiller l'usage terrain et créer un revenu récurrent complémentaire.

**Public cible** : écoles primaires, collèges, lycées (général/technique), établissements confessionnels, internats, grandes écoles/supérieur.

---

## 2. Principes directeurs non négociables

Ces principes doivent guider **chaque** décision technique de l'agent, y compris quand ils ne sont pas rappelés explicitement dans une user story :

1. **Zero-Training UX** — un agent de guichet ou un surveillant doit être opérationnel en moins de 30 secondes, sans formation.
2. **Mobile & Offline-first** — toute fonctionnalité critique (scan, encaissement) doit fonctionner en 2G/3G instable et se synchroniser dès le retour réseau.
3. **Sécurité financière par design** — aucun flux d'argent ne doit être modifiable a posteriori sans trace d'audit ; les reçus sont infalsifiables (QR + hash serveur).
4. **Multi-tenant strict** — l'isolation entre établissements se fait au niveau base de données (RLS), jamais uniquement au niveau applicatif.
5. **Configuration plutôt que codage en dur** — tarifs, statuts financiers, coefficients, règles de notation doivent être paramétrables par école, jamais figés dans le code (voir §12.1).
6. **Sobriété technique** — pas de stockage de fichiers lourds par défaut, pas d'API payante tant qu'une alternative gratuite suffit (OCR, SMS).
7. **Transparence & confiance** — parents, direction et Ministère doivent pouvoir vérifier indépendamment toute transaction ou décision automatisée (page de vérification publique, export de données).

---

## 3. Stack technique recommandée

| Couche | Choix recommandé | Justification |
|---|---|---|
| Frontend admin (Direction, Compta, Caisse, Pédagogie) | Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui | SSR utile pour le SEO de la fiche Trouvetou |
| PWA Parent/Élève | Next.js en PWA installable | Consommation data minimale, mode hors-ligne (Cache Storage) |
| Backend & Auth | Supabase (Postgres + Auth + Realtime) | RLS natif pour le multi-tenant, gratuit en free-tier, Realtime utile pour le live desk monitor caisse |
| Paiement | API Wave, Orange Money, MTN, Moov + webhooks | Écosystème dominant en Côte d'Ivoire |
| Messagerie | Push PWA (gratuit, canal principal) + WhatsApp Cloud API (payant, budgété — voir §12.11) + SMS de secours | Depuis le 1er oct. 2026, Meta facture même les réponses dans la fenêtre de 24h : il n'y a plus de « WhatsApp gratuit à l'échelle » |
| Impression thermique | **Hors périmètre pour l'instant** — reçus en PDF/écran uniquement | Reporté (voir Phase 12) à la demande de l'équipe produit |
| Terminaux dédiés | Wrapper Android natif (Kotlin) + WebView + mode Kiosque (LockTask) | Verrouillage terrain, zéro configuration client |
| Observabilité | Sentry (erreurs) + logs structurés | **Ajout recommandé — non couvert dans les échanges précédents** |
| Tests | Vitest/Jest + tests RLS dédiés + tests de calculs financiers | Priorité absolue avant les tests d'UI |

---

## 4. Architecture multi-tenant & sécurité

### 4.1 Modèle de tenant
- `schools` est la racine de l'isolation. Toute table métier porte un `school_id` (directement ou via relation).
- Isolation stricte via **Row Level Security (RLS)** Postgres — jamais de filtre uniquement côté application.

### 4.2 Authentification par profil

| Rôle | Canal | Route d'atterrissage |
|---|---|---|
| Super Admin (éditeur) | Email + 2FA | `/super-admin` |
| Direction | Email + mot de passe | `/dashboard/direction` |
| Chef Comptable | Email + mot de passe | `/dashboard/compta` |
| Caissier | Email + PIN 4 chiffres (session rapide) | `/dashboard/caisse` |
| Surveillant / Enseignant | Email ou identifiant | `/dashboard/pedagogie` |
| Parent / Tuteur | Téléphone + OTP WhatsApp (passwordless) | `/parent` (PWA) |

### 4.3 Identité globale du parent
Le numéro de téléphone est la clé unique du compte tuteur, **indépendante de l'établissement**. Un parent avec des enfants dans 3 écoles Schooly différentes garde un seul compte, un seul OTP, et bascule entre écoles via un sélecteur. Chaque transaction financière reste néanmoins strictement cloisonnée par établissement (compte marchand, reçu, RLS).

### 4.4 Routage par rôle
Le middleware Next.js lit les custom claims du JWT Supabase (`role`, `school_id`) et redirige. Toute tentative d'accès à une route hors périmètre déclenche un retour automatique à la page d'accueil du rôle.

### 4.5 Contrôle d'accès parent (gating par inscription)
Il n'existe **aucune inscription ouverte** au portail parent : un numéro de téléphone ne débloque un accès que s'il est rattaché à au moins une fiche `enrollments`/`pre_enrollments` (table `guardians`, cf §5).

Flux :
1. Saisie du numéro sur la PWA.
2. Le backend cherche ce numéro parmi les tuteurs liés à une inscription, toutes écoles confondues.
3. Trouvé → envoi de l'OTP → session ouverte, accès à tous les enfants/écoles liés (identité globale, §4.3).
4. Non trouvé → aucun accès ; message neutre (« code envoyé si ce numéro est reconnu ») pour ne pas révéler l'existence ou non d'un compte (anti-énumération).

> Note coût : l'OTP relève de la catégorie « authentication », déjà facturée par Meta. Prévoir des sessions longues (ex. 90 jours) pour limiter le nombre d'OTP envoyés par foyer et par an.

---

## 5. Modèle de données — vue d'ensemble

Organiser les migrations par domaine, dans cet ordre (respecter les dépendances) :

**A. Tenancy & Auth** — `schools`, `users`, `roles`, `user_school_roles`, `school_features` *(nouveau, voir §12.7)*

**B. Structure académique** — `academic_years`, `grade_levels`, `classes`, `subjects`, `class_subject_assignments`

**C. Élèves & Inscriptions** — `students`, `guardians` *(tuteurs, identité globale multi-écoles, voir §4.5)*, `pre_enrollments`, `enrollments`, `financial_profiles` *(généralisé, voir §12.1)*

**D. Finance** — `fee_schedules`, `payments`, `receipts`, `cash_sessions`, `moratoriums`, `accounting_exports`

**E. Pédagogie** — `lesson_logs` (cahier de texte), `grades`, `report_cards`

**F. Vie scolaire** — `attendance_records`, `disciplinary_actions`, `access_logs`

**G. Internat & modules complémentaires** — `buildings`, `rooms`, `beds`, `room_assignments`, `bus_routes`, `library_loans`, `medical_records`, `inventory_items`, `inventory_transactions`

**H. Notifications & Intégrations** — `notification_outbox` *(nouveau, voir §12.3)*, `webhook_events` *(idempotence, voir §12.4)*, `trouvetou_sync_log`

> ⚠️ **Point d'architecture important** : ne pas répliquer un enum de statut financier (`AFFECTE_ETAT`/`NON_AFFECTE`) directement sur `students`. Créer une table `financial_profiles` par école, référencée par `enrollments.financial_profile_id`. Cela permet d'ajouter demain « Boursier interne », « Partenariat entreprise », « Réduction confessionnelle » sans migration de schéma — un besoin déjà identifié dans le module Supérieur (BTS/Licence/Master, 3 profils distincts).

---

## 6. Rôles & permissions (RBAC)

| Rôle | Cœur de responsabilité | Voit uniquement |
|---|---|---|
| Direction | Gouvernance, configuration académique, arbitrage moratoires, clôtures de période | Tout son établissement |
| Secrétariat / Admissions | Traitement candidatures, registre matricule, badges | Inscriptions & registre |
| Comptabilité / Caisse | Encaissements, échéanciers, relances, exports | Finance de l'établissement |
| Professeur | Notes, appel, cahier de texte | Ses classes/matières uniquement |
| Professeur Principal | + appréciation générale, conseil de classe | Sa classe titulaire |
| Surveillance générale | Accès QR, discipline, absences | Vie scolaire |
| Parent / Tuteur | Suivi, paiement, moratoire | Ses enfants uniquement (multi-écoles) |
| Élève | Planning, devoirs, notes | Ses données uniquement |

*(Le détail des menus de tableau de bord déjà défini pour chaque rôle dans les échanges précédents est directement exploitable comme spécification d'écran par l'agent — ne pas le re-décrire, juste le référencer.)*

---

## 7. Cahier des charges fonctionnel par module

### 7.1 Inscriptions & Admissions
- Pré-inscription en ligne texte-only (nom, date de naissance, n° acte de naissance, classe visée, contact tuteur) → code à 6 caractères, réservation de place 72h.
- Validation physique au guichet : saisie du code → pré-remplissage → vérification visuelle des pièces papier → encaissement → validation → matricule + badge QR générés.
- Réinscription en 1 clic (pré-remplissage N-1, décision du conseil de classe déjà en base).
- Import CSV/Excel de la liste officielle du Ministère pour les élèves affectés.
- Moteur d'affectation automatique de classe (algorithme « serpentin », contraintes dures : capacité, options obligatoires ; contraintes souples : équilibre filles/garçons, niveau académique) avec écran de prévisualisation et ajustement manuel (drag & drop).

### 7.2 Structure & gestion académique
- Configuration multi-cycles (primaire → supérieur), classes, matières, coefficients variables par niveau/série.
- Matrice classe × matière × professeur (multi-professeurs par classe), professeur principal avec droits étendus.
- Sous-groupes (TP/TD), matières optionnelles inter-classes.
- Emplois du temps, gestion des salles, remplacements.

### 7.3 Pédagogie & évaluation
- Cahier de texte numérique (devoirs, supports téléchargeables).
- Saisie de notes isolée par professeur (ne voit que ses cours), calcul automatique des moyennes pondérées.
- Génération de bulletins PDF exportables, conseils de classe, décisions (Admis/Redouble/Exclu).

### 7.4 Vie scolaire
- **Appel/assiduité par cours et par professeur** (pas par scan global à l'entrée) : chaque enseignant marque sa propre liste à chaque créneau, ce qui capture le cas d'un élève présent en heure 1 avec un professeur et absent en heure 2 avec un autre. C'est la source de vérité, **indépendante de tout matériel de scan** — fonctionne pour toutes les écoles, y compris celles sans portail équipé.
- Discipline : rapports d'incident, retenues, conseils de discipline.
- Contrôle d'accès par scan QR (portail, examens) *(optionnel, écoles équipées uniquement)*, logique anti-passback.
- 🆕 Pour les écoles équipées d'un scan de portail : croisement automatique avec l'appel par cours pour détecter « élève entré dans l'établissement mais absent en cours » → alerte de décrochage envoyée à la surveillance.

### 7.5 Finance & recouvrement
- Grille tarifaire par classe (généralisée en profils financiers configurables, cf §5).
- Échéanciers (comptant/trimestriel/mensuel), remises automatiques (fratries).
- Encaissement multicanal (espèces, Mobile Money, chèque), reçu numéroté avec QR anti-fraude et page de vérification publique.
- Clôture de caisse quotidienne (comptage à l'aveugle, réconciliation, rapport Z, verrouillage, alerte écart).
- Relances graduées (J-5 préventif, J+1 formel, J+7 avertissement + restriction d'accès), moratoires avec scoring de fiabilité familiale et arbitrage direction (individuel ou en masse).
- Export comptable SYSCOHADA (mode synthétique/analytique, formats Sage/Excel/CSV), équilibre débit=crédit vérifié automatiquement.

### 7.6 Portails utilisateurs dédiés
- **Parent (PWA)** : sélecteur enfant/établissement, situation financière en temps réel, paiement Mobile Money en 1 clic, téléchargement reçus/bulletins, demande de moratoire, mode hors-ligne.
- **Élève** : planning, devoirs, notes.
- **Professeur** : appel rapide, cahier de texte, saisie de notes.

### 7.7 Modules complémentaires (activables à la carte)
Transport scolaire · Cantine · Internat (bâtiments → dortoirs → chambres → lits, inventaire de chambre, permissions de sortie) · Bibliothèque · Infirmerie · Inventaire fournitures (collecte au guichet, bons de sortie, alertes de seuil) · Anti-vol tenues (macaron QR sublimé, étiquette thermocollante, ou puce RFID textile lavable en option premium).

### 7.8 Intégration Trouvetou
- API publique `/api/v1/public/schools/{id}/availability` exposant les places disponibles en temps réel (par niveau et par profil).
- Pré-inscription initiée sur Trouvetou → tunnel Schooly.
- Décrémentation automatique des quotas à chaque validation.

### 7.9 Bascule d'année académique
- Clonage en 1 clic de la structure (classes, matières, tarifs) avec gestion des « deltas ».
- Promotion automatique de masse selon décision du conseil de classe.
- Mode multi-années simultané (chevauchement clôture N / ouverture N+1).
- Publication automatique des nouveaux quotas sur Trouvetou.

### 7.10 Hardware & terminaux (piste parallèle)
- Wrapper Android natif (Kotlin) en mode Kiosque, bridge JavaScript pour scanner laser et imprimante ESC/POS.
- Fonctionnement offline-first (IndexedDB) avec synchronisation en arrière-plan (Supabase Realtime).
- Ouverture automatique du tiroir-caisse.

---

## 8. Design system & exigences UI/UX

Style de référence : sobre, inspiré des interfaces type « Gemini » — sidebar rétractable, cartes modulaires, typographie lisible, mode sombre/clair.

**Composants à construire avant toute page métier** (cf roadmap Phase 0) :
- Tokens de couleur avec sémantique forte et **identique partout** (vert = OK, rouge = refusé/impayé, orange = attention/en attente).
- Sidebar rétractable, Command Palette (Ctrl+K).
- Sélecteur d'année académique avec badges d'état + bannière d'alerte hors-contexte.
- Table, Modal, Toast, Badge, Card, boutons à large zone tactile (usage terrain, guichet, plein jour).
- États vides explicites pour guider un nouvel utilisateur — jamais un tableau vide sans contexte.

**Exigences transverses** :
- Feedback visuel **et sonore** fort sur les écrans de scan (guichet bruyant, usage rapide).
- Aucune action destructrice sans confirmation.
- Progressive disclosure : jamais d'options avancées par défaut (onboarding en 4 étapes max).

---

## 9. Exigences non-fonctionnelles

- **Performance réseau** : fonctionnement acceptable en 2G/3G ; toute donnée déjà consultée reste disponible hors-ligne.
- **Précision financière** : montants stockés en entiers (le FCFA n'a pas de sous-unité) — jamais de type flottant pour l'argent.
- **Idempotence** : tout webhook de paiement traité une seule fois même livré plusieurs fois.
- **Auditabilité** : écriture financière immuable après clôture ; toute suppression est un soft-delete tracé.
- **Confidentialité mineurs** : données d'élèves particulièrement sensibles — principe de moindre privilège strict (RLS + UI).
- **Scalabilité multi-écoles** : aucune requête ne doit scanner l'ensemble de la base sans filtre `school_id`.

---

## 10. Roadmap de développement (phases pour l'agent IA)

> Chaque phase indique Objectif, Livrables et Critère d'acceptation. Respecter l'ordre : chaque phase dépend structurellement de la précédente, sauf mention « piste parallèle ».

**Phase 0 — Fondations techniques**
Repo structuré, Next.js + TS strict, Supabase (dev/staging/prod), CI (lint+test+build), design tokens + composants UI de base, Sentry, conventions de nommage.
*Acceptation* : `pnpm dev` affiche un shell (sidebar + dark mode) vide, CI verte.

**Phase 1 — Multi-tenant, Auth & RBAC**
`schools`, `users`, `roles`, RLS de base + **tests RLS écrits avant l'UI**, middleware de routage par rôle, onboarding étapes 1-2.
*Acceptation* : 2 écoles de test, isolation RLS prouvée par tests automatisés, connexion + redirection par rôle opérationnelle.

**Phase 2 — Structure académique**
Années académiques, niveaux, classes, matières, matrice coefficients, sélecteur d'année + bannière contextuelle.
*Acceptation* : Direction configure une structure complète, bascule d'année fonctionnelle.

**Phase 3 — Élèves, pré-inscriptions, inscriptions**
Pré-inscription légère + code, Kanban secrétariat, `financial_profiles`, génération matricule/badge, algorithme d'affectation de classe.
*Acceptation* : parcours bout-en-bout pré-inscription → validation → matricule généré.

**Phase 4 — Finance : tarification, caisse, reçus**
Grille tarifaire, encaissement, reçu QR **en PDF/écran** (pas d'impression thermique dans cette version) + page de vérification publique, clôture de caisse, export SYSCOHADA.
*Acceptation* : caissier encaisse et clôture sans écart non expliqué ; export équilibré ; **tests unitaires sur les calculs financiers en priorité absolue**.

**Phase 5 — Relances & moratoires**
Outbox de notifications, workflow gradué, scoring de fiabilité, dashboard d'arbitrage (individuel + bulk).

**Phase 6 — Pédagogie**
Cahier de texte, saisie de notes isolée par professeur, bulletins PDF.

**Phase 7 — Vie scolaire & accès QR**
Appel, discipline, scan QR, anti-passback.

**Phase 8 — Portails dédiés**
PWA Parent (multi-enfants/multi-écoles), portail élève, portail professeur.

**Phase 9 — Modules complémentaires** *(piste parallèle possible)*
Transport, cantine, internat, bibliothèque, infirmerie, inventaire, anti-vol tenues — activables via `school_features`.

**Phase 10 — Intégration Trouvetou**
API disponibilité, synchronisation quotas. **Mise à jour de cohérence** : utiliser le contrat « Trouvetou Connector » tel que défini dans `refontiq-architecture-ecosysteme.md` §3, incluant les champs étendus `photos_360`, `itineraire` et `grille_tarifaire_publique` (décidés comme standard pour tous les produits Refontiq, pas seulement Schooly).

**Phase 11 — Bascule d'année académique**
Clonage structure, promotion automatique, mode multi-années, wizard 3 étapes.

**Phase 12 — Hardware & terminaux** *(piste parallèle indépendante, non engagée à ce stade)*
Wrapper Android, mode kiosque, scanner. L'impression thermique ESC/POS reste hors périmètre tant qu'elle n'est pas explicitement redemandée.

**Phase 13 — Durcissement & lancement**
Audit sécurité RLS complet, tests de charge (pic de rentrée), sauvegarde/restauration, documentation utilisateur, monitoring.

---

## 11. Checklist de démarrage immédiat

Avant d'écrire la moindre fonctionnalité métier, l'agent doit :

1. Créer la structure de repo (monorepo : `apps/web-admin`, `apps/pwa-parent`, `packages/ui`, `packages/db`).
2. Rédiger un fichier de contexte racine décrivant stack, conventions, structure — pour que chaque session future s'auto-oriente.
3. Provisionner le projet Supabase (dev), configurer `.env.example`.
4. Écrire la première migration (`schools`, `users`, `roles`) **et** les tests RLS correspondants avant toute UI.
5. Construire les tokens de design et 6 à 8 composants de base avant la première page métier réelle.
6. Implémenter l'auth + middleware de routage par rôle.
7. Créer un jeu de données de démonstration réaliste (une école fictive complète) pour développer contre des données proches du réel.
8. Mettre en place les tests automatisés dès la Phase 1 — ne jamais les repousser « à la fin ».
9. Documenter chaque domaine au fur et à mesure (un README par module).
10. Ne jamais coder en dur un tarif, un statut ou une règle métier — passer systématiquement par une table de configuration.

---

## 12. Propositions d'amélioration stratégiques

1. **Généraliser les profils financiers.** Remplacer l'enum figé `AFFECTE_ETAT`/`NON_AFFECTE` par une table `financial_profiles` configurable par école. Couvre nativement Boursier, Partenariat entreprise, réduction confessionnelle.
2. **Montants en entiers uniquement.** Le FCFA n'a pas de sous-unité : stocker en `BIGINT`, jamais en flottant.
3. **Pattern Outbox pour les notifications.** Découpler l'écriture en base de l'envoi WhatsApp/SMS : retry automatique, fallback SMS si échec, limitation de débit pour maîtriser les coûts API.
4. **Idempotency keys sur les webhooks Mobile Money.** Un webhook peut être livré en double ; sans clé d'idempotence, risque réel de double-crédit d'un paiement.
5. **Audit trail et soft-delete universels.** `created_by/updated_by/deleted_at` sur toutes les tables sensibles, pas uniquement sur la caisse.
6. **Score de fiabilité familiale centralisé.** L'indice de confiance des moratoires devrait être un service réutilisable (cantine à crédit, accès internat...), pas ré-implémenté module par module.
7. **Feature flags par établissement (`school_features`).** Indispensable dès la conception puisque le modèle économique prévoit des modules à la carte — active/désactive sans déploiement.
8. **Export de données complet dès le premier jour.** Un bouton « Exporter toutes mes données » rassure les directeurs sur le risque d'enfermement logiciel et réduit la friction commerciale à la vente.
9. **Versionnement temporel des règles.** Si un coefficient ou un tarif change en cours d'année, les bulletins déjà émis ne sont jamais recalculés rétroactivement.
10. **Tests financiers en priorité absolue.** Avant même les tests d'interface : une erreur de calcul détruit la confiance immédiatement, contrairement à un bug d'affichage.
11. **Ne pas concevoir l'architecture autour d'un « WhatsApp gratuit ».** Depuis juillet 2025, les messages initiés par l'entreprise (relances, reçus) sont déjà facturés au message par Meta, et à partir du 1er octobre 2026 même les réponses dans la fenêtre de 24h le seront. Seule une fenêtre de 72h ouverte via une publicité Click-to-WhatsApp ou un bouton Page Facebook reste entièrement gratuite — trop étroite pour servir de base à des relances automatiques. Priorité réelle : Push PWA (gratuit) en canal principal, WhatsApp en canal payant budgété dans le prix par élève, SMS en dernier recours.
12. **Table `guardians` dédiée plutôt qu'un champ texte.** L'identité du tuteur (nom, téléphone) doit être un objet de premier ordre, réutilisable entre plusieurs enfants et plusieurs écoles — c'est ce qui permet le contrôle d'accès par rattachement à une inscription (§4.5) sans dupliquer la donnée.

---

## 13. Definition of Done (à appliquer à chaque module)
- [ ] RLS testée (isolation multi-école prouvée)
- [ ] Aucune valeur métier codée en dur (tarif, statut, coefficient)
- [ ] Fonctionne en mode dégradé réseau (offline ou message clair)
- [ ] États vide / chargement / erreur tous conçus
- [ ] Tests automatisés sur la logique métier (pas seulement le rendu)
- [ ] Vocabulaire adapté au rôle concerné (pas de jargon technique visible)

---

## 14. Facturation SaaS — modèle « 1000 FCFA / élève »

> ⚠️ **Mise à jour de cohérence** : cette section décrivait à l'origine un mécanisme propre à Schooly. Il a depuis été généralisé en un package partagé `@refontiq/billing` (voir `refontiq-architecture-ecosysteme.md` §6.2), construit à partir d'un pattern déjà éprouvé et en production dans Séjoura. **Si ce package existe déjà au moment où l'agent lit ce document, l'utiliser directement plutôt que de recoder la logique ci-dessous.** S'il n'existe pas encore, construire Schooly selon le schéma décrit ici (compatible avec le futur package) pour rendre la migration triviale plus tard — ne pas bloquer le développement de Schooly en attendant l'extraction du package.

### 14.1 Principe : facturation événementielle, pas calendaire
Ne pas facturer sur une base fixe (« au 1er septembre, facture pour tous les inscrits ») — cela facturerait des pré-inscriptions jamais confirmées. Déclencher le prélèvement automatiquement à chaque passage d'une inscription au statut `CONFIRMED` : c'est le moment exact où la valeur est délivrée à l'école.

### 14.2 Mécanique technique
- `platform_fee_ledger` (`enrollment_id`, `school_id`, `amount`, `status`: due/collected/settled, `created_at`) — un enregistrement créé automatiquement à chaque confirmation d'inscription.
- `platform_invoices` (`school_id`, `period`, `total_students`, `total_due`, `status`) — agrégation trimestrielle (alignée sur les périodes académiques déjà modélisées) pour le reporting et l'audit, pas pour la collecte elle-même.

### 14.3 Injection transparente dans l'échéancier de l'élève
Le montant n'est pas facturé séparément à l'école : il est ajouté automatiquement par le système comme ligne « Frais de plateforme numérique » dans l'échéancier généré à l'inscription (au même titre que la scolarité ou la cantine), jamais saisi manuellement par le comptable. Le parent la voit comme une ligne normale sur son reçu.

### 14.4 Collecte automatique — recommandation forte : split payment
Ne pas dépendre d'un reversement manuel de l'école. Choisir un agrégateur Mobile Money supportant le paiement marketplace/sous-marchand (répartition automatique d'une transaction entre plusieurs comptes destinataires) : la part « frais de plateforme » part directement vers le compte Schooly, le reste vers le compte de l'école, dans la même transaction. Résultat : zéro facture à recouvrer, zéro risque d'impayé sur la licence.
- Repli si l'agrégateur ne supporte pas le split : deux appels de paiement déclenchés ensemble au guichet (transparents pour le caissier), tracés comme deux lignes d'une même transaction logique.

### 14.5 Cas particuliers
- **Pas de proratisation** : la totalité est due dès la confirmation, quel que soit le moment de l'année — la complexité de la proratisation ne se justifie pas sur un montant aussi faible (principe KISS).
- **Réinscription** : chaque nouvelle année académique génère une nouvelle inscription `CONFIRMED` → nouveau prélèvement automatique, naturel avec le moteur de bascule d'année (§7.9).
- **Élèves affectés de l'État** : à trancher entre tarif plat (simplicité) ou réduit (ex. 500 FCFA, cohérent avec des frais annexes déjà plus bas). Recommandation : démarrer plat, ajuster seulement si l'adoption dans les écoles à forte proportion d'affectés le justifie.
- **Fratries** : le prix est par élève, pas par famille — s'applique naturellement puisqu'il est calculé par inscription.

### 14.6 Non-paiement : dégrader, jamais bloquer les données académiques
Ne jamais verrouiller notes, bulletins ou registre élève : ce sont les données des enfants, pas un levier de pression légitime. Dégrader plutôt les fonctionnalités périphériques (visibilité Trouvetou suspendue, exports comptables désactivés, nouvelles pré-inscriptions bloquées) via le système `school_features` (§12.7).

### 14.7 Pilotage (Super-Admin)
Le tableau de bord `/super-admin` expose : élèves actifs facturables par école, MRR équivalent, écoles en retard de reversement, historique de collecte — construit sur `platform_invoices`.

### 14.8 Comptabilité côté école
Prévoir un compte dédié dans le mapping SYSCOHADA de chaque école (ex. « Frais de plateforme numérique ») pour que cette ligne n'entre pas dans les frais de scolarité de l'établissement lors des exports comptables (§7.5).

---

## 15. Glossaire rapide
- **RLS** : Row Level Security — sécurité au niveau ligne, Postgres.
- **DRENA** : Direction Régionale de l'Éducation Nationale (Côte d'Ivoire).
- **SYSCOHADA** : référentiel comptable en vigueur en zone OHADA.
- **Rollover** : bascule d'une année académique à la suivante.
