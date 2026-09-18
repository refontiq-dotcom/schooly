# Cahier des Charges — SCHOOLY

*SaaS de gestion scolaire multi-établissements — Côte d'Ivoire / Afrique de l'Ouest*
*Document de référence pour l'agent IA de développement*
*Version 1.6 — 18/09/2026 — **compte parent permanent / autorisation scolaire annuelle** : le téléphone n'est plus un droit d'accès mais une clé d'éligibilité et un identifiant de connexion ; l'accès aux données est déduit de la relation parent ↔ élève ↔ établissement ↔ **année scolaire** (§4.3, §4.5), avec années clôturées en lecture seule et parcours « numéro perdu » validé par l'école. Voir `architecture-compte-parent.md`.*
*Version 1.5 — 18/09/2026 — consolidation : troisième enseignement de production (§9.1) — une fonction SQL `security definer` peut se créer sans erreur et échouer à 100 % ; contact d'urgence rattaché au module Vie scolaire (§7.4).*
*Version 1.4 — 18/09/2026 — parcours d'inscription & réinscription : formulaire public intelligent et facultatif, réinscription en 1 clic, vérification des places en temps réel, contact d'urgence, scolarité antérieure, orientation État, accès parent par le téléphone. Ajout des synthèses « état livré » (§7.1, §7.2, §7.8), des règles d'accessibilité (§8.1) et des enseignements de production (§9.1).*
*Version 1.3 — ajout des spécifications du module d'évaluation intelligente : configuration, calculs, temporalité, saisie temps réel et bulletins*

> ⚠️ **À lire avant toute reprise de développement** : trois documents de référence encadrent ce cahier des charges.
> - `refontiq-architecture-ecosysteme.md` et `refontiq-plan-de-travail-prompts.md` — composants partagés à l'échelle de tout l'écosystème Refontiq (pas seulement Schooly). En cas de doute, les documents d'écosystème font foi sur les questions transverses (facturation, identité, alertes internes).
> - **`architecture-compte-parent.md`** — frontière **identité parent (permanente)** / **autorisation scolaire (annuelle)**, parcours « numéro perdu ou changé », dashboard parent multi-années et cible RLS. **À lire obligatoirement avant toute modification** des policies RLS, de la table `guardians` ou de la PWA parent.

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
16. Synthèse pour la présentation aux établissements

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
| Parent / Tuteur | **Téléphone (clé d'éligibilité) + mot de passe** choisi au premier accès | `/parent` (PWA) |

> **Le téléphone n'est pas un droit d'accès** (cf. §4.5) : il sert à **vérifier que le parent est connu de l'école**, puis de **identifiant de connexion** combiné à un mot de passe. Un numéro inconnu de tout établissement ne permet pas de créer un compte.

### 4.3 Identité globale du parent — permanente par construction

Le **compte parent est permanent** : il ne dépend ni de l'année scolaire, ni de l'établissement. Un parent avec des enfants dans 3 écoles Schooly différentes garde **un seul compte**, un seul mot de passe, et bascule entre enfants et établissements via un sélecteur. Chaque transaction financière reste néanmoins strictement cloisonnée par établissement (compte marchand, reçu, RLS).

**Ce qui expire, ce n'est pas le parent : c'est son autorisation scolaire, rattachée à une année** (cf. §4.5).

```
COMPTE PARENT ───────────────────────────────────────────► PERMANENT
  (téléphone + mot de passe + identité)
  │
  └── RATTACHEMENTS SCOLAIRES ──────────────────────────► PAR ANNÉE
        ├── 2025-2026 · École A · Enfant 1 · terminée   → lecture seule
        ├── 2026-2027 · École A · Enfant 1 · active     → accès complet
        └── 2027-2028 · en attente d'inscription        → aucun accès
```

- **Pendant les vacances**, le parent se connecte normalement et consulte notes, bulletins et reçus de l'année écoulée en **lecture seule**. Il ne voit pas l'année suivante tant que l'école ne l'a pas validée.
- **À la rentrée**, dès que l'école valide la nouvelle inscription, **le même compte** retrouve l'accès complet. Le parent **ne recrée rien** et **ne change pas de numéro**.
- **Changement d'établissement** : même compte, mêmes liens ; l'historique de chaque école reste consultable, année par année.

> Le détail de conception (frontière identité / autorisation, parcours « numéro perdu », cible RLS et plan d'implémentation) est fixé dans **`docs/product/architecture-compte-parent.md`** — document à lire avant toute modification des policies RLS, de la table `guardians` ou de la PWA parent.

### 4.4 Routage par rôle
Le middleware Next.js lit les custom claims du JWT Supabase (`role`, `school_id`) et redirige. Toute tentative d'accès à une route hors périmètre déclenche un retour automatique à la page d'accueil du rôle.

### 4.5 Contrôle d'accès parent — gating par inscription, jamais par le téléphone

> **Règle fondatrice** : le téléphone n'est **pas** un droit d'accès. C'est une **clé d'éligibilité** et un **identifiant de connexion**.

Trois fonctions distinctes, à ne jamais confondre :

| Fonction | Quand | Ce qu'elle prouve | Ce qu'elle ne prouve **pas** |
|---|---|---|---|
| **Clé d'éligibilité** | Premier accès | « Ce numéro correspond à un parent connu d'au moins une école Schooly » | Que la personne devant l'écran est bien ce parent |
| **Identifiant de connexion** | Chaque connexion | Rien à lui seul — il doit être **combiné à un mot de passe** | L'identité, à lui seul |
| **Clé de rapprochement** | Numéro perdu / changé | Point de départ d'une procédure **validée par l'école** | Que le numéro appartient encore au parent |

**Conséquence technique** : `guardians.phone` (et son miroir `phone_norm`) ne doit **jamais** apparaître seul dans une condition d'autorisation. Il sert à *trouver* le compte, pas à *l'autoriser*.

#### 4.5.1 Création du compte — aucune inscription ouverte

1. Le parent saisit son numéro sur la PWA.
2. Le backend **normalise le numéro** (`phone_norm`, cf. §7.8.4) puis le cherche parmi les tuteurs liés à au moins une inscription, toutes écoles confondues.
3. **Numéro inconnu → accès refusé** : impossible de créer un compte parent avec un numéro que l'école n'a jamais vu. Message neutre (« code envoyé si ce numéro est reconnu ») pour empêcher l'énumération des familles.
4. **Numéro connu → autorisation de créer le compte** : le parent **choisit son mot de passe**. À partir de là, il se connecte par **numéro + mot de passe** ; l'OTP WhatsApp reste un canal de **vérification du numéro**, jamais le seul facteur d'accès.

#### 4.5.2 Autorisation = relation parent ↔ élève ↔ établissement ↔ année

L'accès aux données n'est jamais déduit du numéro : il est déduit de la chaîne

```
Parent connecté → son guardian_id → élèves rattachés → inscriptions (enrollments)
   → école + année scolaire → statut de l'année → droits
```

| Statut de l'année | Droits du parent |
|---|---|
| `en_cours` | Accès complet (notes, bulletins, paiements, absences) ; paiement en ligne possible |
| `cloturee` | **Lecture seule** — historique consultable, aucune écriture |
| `planifiee`, ou aucune inscription | **Aucun accès** aux données de cette année |

`enrollments` porte déjà les quatre clés (`guardian_id`, `student_id`, `school_id`, `academic_year_id`) : la relation est donc **native**, sans table de droits à maintenir.

**Mise en œuvre livrée** :
- `guardians.phone_norm` : **numéro canonique indexé** — `0700000000`, `+225 07 00 00 00 00` et `002250700000000` désignent **le même parent**. Sans cela, un parent saisi au guichet dans un format différent de celui du formulaire en ligne aurait pu se voir refuser l'accès à son propre dossier.
- `guardians.user_id → auth.users` : rattache la fiche tuteur au **compte Auth** du parent, avec **unicité garantie** (un compte parent ↔ une fiche tuteur).
- Helpers RLS `current_guardian_id()`, `parent_owns_enrollment()`, `parent_can_write_enrollment()` : l'autorisation est **revérifiée en base à chaque requête**, jamais côté client (migration `20260918190000`).
- **Moindre privilège** : le parent n'a **aucune** écriture sur les données académiques. Il n'écrit que sur ses propres coordonnées et, dans une année `en_cours`, un paiement.

#### 4.5.3 Numéro perdu ou changé — le compte et les liens survivent

Le compte parent **n'est jamais supprimé** parce que le numéro change. On modifie le numéro **du compte**, pas l'identité du parent ni ses liens scolaires (enfants, inscriptions, historique).

| Situation | Parcours |
|---|---|
| Parent **connecté** | Réglages → Compte → Numéro de téléphone → **mot de passe actuel** + nouveau numéro. L'école reçoit une notification (« le numéro du parent de [élève] a été modifié »). |
| Parent **déconnecté**, ancien numéro perdu | « Je n'ai plus accès à mon numéro » → vérification **par l'administration de l'école** (jamais une simple question secrète) → remplacement du numéro. |
| Cas explicitement interdit | Nouveau numéro + ancien mot de passe **ne donne pas** accès automatiquement : un ancien numéro recyclé ne doit jamais permettre de reprendre un compte. |

> Note coût : l'OTP relève de la catégorie « authentication », déjà facturée par Meta. Prévoir des sessions longues (ex. 90 jours) pour limiter le nombre d'OTP envoyés par foyer et par an.

---

## 5. Modèle de données — vue d'ensemble

Organiser les migrations par domaine, dans cet ordre (respecter les dépendances) :

**A. Tenancy & Auth** — `schools`, `users`, `roles`, `user_school_roles`, `school_features` *(nouveau, voir §12.7)*

**B. Structure académique** — `academic_years`, `grade_levels`, `classes`, `subjects`, `class_subject_assignments`

**C. Élèves & Inscriptions** — `students`, `guardians` *(tuteurs, identité globale multi-écoles, voir §4.5)*, `pre_enrollments`, `enrollments`, `financial_profiles` *(généralisé, voir §12.1)*

**Colonnes ajoutées le 18/09/2026** (migration de rattrapage `20260918180000_catchup_18_09.sql`, idempotente) :

| Table | Colonnes | Objet |
|---|---|---|
| `pre_enrollments` | `guardian_relation`, `emergency_contact_name`, `emergency_contact_phone` | Lien du parent avec l'élève + contact d'urgence (§7.1.1) |
| `pre_enrollments` | `previous_school`, `previous_class` | Scolarité antérieure pour un élève venant d'un autre établissement |
| `pre_enrollments` | `enrollment_type`, `state_orientation`, `orientation_number`, `previous_matricule` | Nouvelle inscription vs réinscription ; orienté État ou non ; matricule d'origine |
| `pre_enrollments` | `source` (`form` / `trouvetou` / `counter`) | Traçabilité du canal d'origine (§7.8.3) |
| `students` | `previous_school`, `previous_class` | Historique conservé au dossier de l'élève |
| `enrollments` | `enrollment_type`, `state_orientation`, `orientation_number` | Traçabilité de l'origine, année par année |
| `guardians` | `relation`, `emergency_contact_name`, `emergency_contact_phone` | Ces informations vivent au dossier tuteur, pas seulement sur la demande |
| `guardians` | `phone_norm` (indexé, calculé par trigger) | Clé de recherche parent, indépendante du format de saisie (§7.8.4) |
| `guardians` | `user_id` → `auth.users` (unique) | Accès du parent à son tableau de bord par le téléphone (§4.5) |

> **Principe appliqué** : une information se saisit **une fois**, au plus près de la personne qui la connaît, puis circule vers le dossier définitif sans ressaisie (pré-inscription → fiche élève / fiche tuteur → inscription de l'année).

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

> **Légende** : ✅ **livré** = utilisable dès aujourd'hui · 🔜 **cible** = spécifié, à implémenter.
> Les blocs ✅ sont rédigés pour être **lus tels quels par un chef d'établissement** : chacun décrit un bénéfice concret pour l'école ou pour la famille.

#### 7.1.1 ✅ Pré-inscription en ligne — intelligente, et jamais obligatoire

Le parent remplit un formulaire public (`/enroll/{schoolId}`), **sans créer de compte**, depuis son téléphone. **La pré-inscription en ligne reste facultative** : toute famille qui ne maîtrise pas le numérique — ou qui préfère le contact humain — est inscrite directement au guichet, avec exactement les mêmes informations collectées. Aucun élève n'est refusé parce qu'il n'a pas rempli le formulaire.

**Ce que le formulaire demande** (14 champs dont 10 obligatoires) et ce qu'il fait à la place du parent :

| Bloc | Champs | Intelligence embarquée |
|---|---|---|
| Élève | Prénom, Nom, Date de naissance, N° acte de naissance, Niveau souhaité | Capitalisation automatique des noms (`jean-paul` → `Jean-Paul`, `n'guessan` → `N'Guessan`) ; **âge affiché en direct** sous la date ; date future impossible ; alerte orange si l'âge est incohérent avec le niveau |
| Scolarité antérieure | ☑ Première scolarisation · École précédente · Dernière classe fréquentée | **Classe précédente pré-remplie automatiquement** avec le niveau juste avant celui demandé (6ème → CM2, modifiable) ; tout le bloc **disparaît** si l'élève n'a jamais été scolarisé |
| Type & orientation | Type d'inscription · Orientation · Matricule · N° de notification | « Réinscription » masque la scolarité antérieure et révèle le matricule ; « Orienté(e) par l'État » révèle le n° de notification d'affectation |
| Fournitures scolaires | Cases à cocher (+ montant indicatif) | Listes et tarifs définis par l'établissement |
| Pièces à fournir | Cases à cocher | Liste filtrée selon le niveau visé |
| Moyen de paiement | Choix unique | Uniquement les moyens que l'école a activés |
| Parent ou tuteur | **Lien avec l'élève** · Nom du parent ou tuteur · Téléphone · ☑ Même contact en cas d'urgence | Lien obligatoire (Père / Mère / Tuteur légal / Autre parent / Autre → champ de précision) ; **téléphone formaté automatiquement** (`0700000000` → `+225 07 00 00 00 00`) ; case urgence **cochée par défaut**, la décocher révèle le nom + téléphone du contact d'urgence |

**Confort de la famille** :
- **Brouillon automatique** : la saisie est conservée sur l'appareil. Coupure réseau, rafraîchissement, fermeture d'onglet, batterie faible — rien n'est perdu. Au retour : bandeau « Brouillon restauré » et bouton « Repartir de zéro ».
- **Remplissage assisté par le navigateur / gestionnaire de mots de passe** : le parent déjà connu remplit nom, date de naissance et téléphone d'un seul geste.
- **Aucun jargon technique** : pas de matricule à connaître, pas d'identifiant, pas de pièce à scanner. Le parent est guidé par des libellés en français courant et des exemples (« Ex. : KOUASSI Jean »).
- Résultat : un **code à 6 caractères valable 72 heures**. La place est réservée ; l'inscription devient définitive au guichet.

#### 7.1.2 ✅ Réinscription en 1 clic — le parent confirme, il ne ressaisit rien

Pour une famille déjà connue de l'établissement, **aucun formulaire technique n'est demandé**. Le parent indique **son numéro de téléphone** (celui utilisé lors de l'inscription initiale) : le système retrouve ses enfants inscrits, affiche **la classe de l'année suivante déjà calculée**, et le parent **confirme d'un bouton**.

- Un seul geste utile : « oui, mon enfant continue ici ».
- Les informations d'identité, le parent, le contact d'urgence et le matricule sont **repris du dossier existant** — zéro double saisie, zéro risque d'erreur de recopie.
- **Anti-doublon** : le matricule de l'élève permet de réinscrire **sur sa fiche existante** plutôt que de créer un second dossier.
- **Idempotent sur 72 h** : si le parent clique deux fois ou recharge la page, une seule réinscription est créée.

#### 7.1.3 ✅ Places disponibles vérifiées avant d'accepter

Le nombre de places est calculé **en temps réel** à partir de la capacité déclarée des classes de l'école. Une inscription ou une réinscription est **refusée d'emblée si l'établissement est complet** pour le niveau visé, avec un message clair pour la famille — jamais une promesse de place qui ne pourrait pas être tenue. Le contrôle est refait au moment de la confirmation, pour couvrir le cas où la dernière place part entre-temps.

#### 7.1.4 ✅ Validation au guichet — le contrôle humain reste souverain

Le secrétariat saisit le **code à 6 caractères** : le dossier se pré-remplit, le secrétariat **vérifie visuellement les pièces papier**, encaisse si nécessaire, puis valide. À cet instant seulement : création de l'élève, **matricule** et **badge QR** générés, inscription rattachée à l'année et à la classe.

- Les informations du parent (lien de parenté, contact d'urgence, scolarité antérieure, type d'inscription, orientation État) sont **transférées automatiquement** vers la fiche élève et la fiche tuteur : elles restent au dossier de façon permanente, sans ressaisie.
- Un dossier non validé dans les 72 heures expire sans intervention (aucun nettoyage manuel à prévoir).
- **Ce que le secrétariat voit à l'écran** : pour chaque demande, une ligne de contexte (`Mère : Mariam Kone · Urgence : Ibrahim Kone (+225 …) · Venant de : EPP Bingerville 1 (CM2) · Ancien matricule : …`) et des badges `Réinscription` / `Orienté(e) État` — le dossier est qualifié avant même d'être ouvert.

#### 7.1.5 ✅ Référence de paiement adaptée au mode choisi

Le champ « référence » n'apparaît que lorsqu'il a un sens : **obligatoire pour un chèque**, proposé (facultatif) pour un virement ou un mobile money, **absent pour les espèces**. Le secrétariat n'est plus arrêté par un champ inutile au guichet, et ne peut plus valider un chèque sans son numéro.

#### 7.1.6 🔜 Reste à implémenter sur ce module

- Import CSV/Excel de la liste officielle du Ministère pour les élèves affectés.
- Moteur d'affectation automatique de classe (algorithme « serpentin » ; contraintes dures : capacité, options obligatoires ; contraintes souples : équilibre filles/garçons, niveau académique) avec écran de prévisualisation et ajustement manuel (drag & drop).

### 7.2 Structure & gestion académique

**État livré (✅)** — écran `/dashboard/academic-structure` :
- Création et gestion des **années académiques**, **niveaux** (avec rang d'ordre et cycle), **classes** (capacité, professeur principal), **matières** (code, coefficient) et **affectations classe × matière × professeur**.
- **Sélecteur d'année académique** transversal, avec alerte explicite quand on consulte un écran hors de l'année courante.
- **Bascule d'année** assistée (§7.9) : la capacité déclarée par classe est ce qui alimente le calcul des places disponibles côté parents et Trouvetou (§7.8.2) — saisir la capacité n'est donc pas une formalité administrative, c'est ce qui protège l'école d'un sur-effectif.
- L'écran respecte les exigences d'accessibilité (§8.1) et les messages d'erreur y sont **explicites** : « Action réservée à un rôle supérieur », « Aucune école rattachée », « Erreur serveur » sont distingués (cf. §9.1) — le secrétariat sait immédiatement s'il doit changer de compte, faire rattacher l'utilisateur, ou signaler un incident.

**Cible (🔜)** :
- Configuration multi-cycles (primaire → supérieur) complète, coefficients variables par niveau/série.
- Matrice classe × matière × professeur avancée (multi-professeurs par classe), professeur principal avec droits étendus.
- Sous-groupes (TP/TD), matières optionnelles inter-classes.
- Emplois du temps, gestion des salles, remplacements.

### 7.3 Pédagogie & évaluation intelligente

**Périmètre attendu** : les exigences ci-dessous constituent la cible fonctionnelle à implémenter et à valider, et non un inventaire de fonctionnalités déjà livrées. Le cahier de texte numérique (devoirs, supports téléchargeables) reste inclus dans ce module.

#### 7.3.1 Configuration établissement & cycles — Direction / Censeur

- Paramétrage guidé par l'administrateur/directeur ; le censeur intervient selon les permissions déléguées. Règles par établissement et année, avec surcharge explicite par cycle ; coefficients par classe et matière. Afficher les valeurs héritées et les exceptions.
- **Mode d'évaluation**, choisi par cartes radio : `TRIMESTRE` (3 périodes), `SEMESTRE` (2 périodes), `COMPOSITION_PRIMAIRE` (compositions périodiques et composition de passage distincte).
- **Calendrier** : DatePicker pour début, fin et verrouillage strict de saisie de chaque période ; dates comprises dans l'année, ordre cohérent et absence de chevauchement dans un même cycle. Préciser le fuseau de l'école et l'heure limite effective.
- **Seuil de passage & barème** : champ numérique (ex. 10,00/20 au secondaire ou un total de points au primaire). Le seuil et les résultats comparés doivent utiliser la même échelle ; aucune conversion implicite entre points et /20.
- **Matières & coefficients** : table classe × matière pour affectation et coefficient (ex. Mathématiques 4, Histoire-Géographie 2), en cohérence avec la matrice classe × matière × professeur (§7.2). Coefficients strictement positifs ; matière exclue explicitement plutôt que coefficient ambigu.
- **Pondérations** : curseurs et champs numériques pour interrogations, devoirs et compositions. Distinguer les poids par évaluation des pourcentages fixes par catégorie ; afficher un exemple de calcul et vérifier que les pourcentages totalisent 100 %.
- Versionner les paramètres appliqués aux calculs. Tout changement après saisie exige une confirmation et une trace d'audit ; les bulletins publiés conservent leurs règles et résultats historiques.

#### 7.3.2 Moteur de calcul — matière, période, année

**A. Moyenne matière sur une période**

Pour un élève, une matière et une période, normaliser les notes sur un barème commun avant agrégation si les évaluations utilisent des barèmes différents :

```text
Note normalisée = Note brute / Barème évaluation × Barème de référence
Moyenne matière = Σ(Note normalisée_i × Poids_i) / Σ(Poids_i)
```

La somme inclut les interrogations, devoirs **et compositions** comptabilisés. Un poids nul est exclu ; un dénominateur nul donne « Non calculable », jamais 0.

Lorsque les curseurs représentent des **pourcentages par catégorie**, calculer d'abord la moyenne de chaque catégorie puis appliquer ses pourcentages : multiplier chaque note par le pourcentage ferait dépendre la répartition du nombre d'interrogations/devoirs. La politique de catégorie manquante (résultat incomplet ou redistribution explicite des poids disponibles) doit être configurée et visible ; aucune redistribution silencieuse.

**B. Moyenne générale périodique**

```text
Moyenne période = Σ(Moyenne matière_m × Coefficient matière_m) / Σ(Coefficients matière_m)
```

Les coefficients sont ceux de la classe, de l'année et de l'établissement concernés. Les matières non calculables ne sont jamais assimilées à zéro ; afficher la couverture des matières et le statut provisoire/incomplet.

**C. Moyenne annuelle & proposition automatique de passage**

| Mode | Formule annuelle | Proposition automatique |
|---|---|---|
| `TRIMESTRE` | `(T1 + T2 + T3) / 3` | Admis si résultat ≥ seuil |
| `SEMESTRE` | `(S1 + S2) / 2` | Admis si résultat ≥ seuil |
| `COMPOSITION_PRIMAIRE` | `Moyenne compositions périodiques × 0,4 + Composition de passage × 0,6` | Admis si résultat ≥ seuil |

- Au primaire, la moyenne des compositions périodiques exclut la composition de passage ; toutes sont exprimées sur la même échelle. Les compositions périodiques ont le même poids par défaut.
- Une période ou composition obligatoire manquante donne un résultat annuel **provisoire/incomplet**, sans admission automatique définitive.
- Sous le seuil : **Ajourné** ; afficher **Repêchable** dans une zone de rachat paramétrée (ex. 9,85 pour un seuil de 10). Cette zone ne constitue pas une admission automatique.
- Conserver la précision de calcul ; arrondir pour l'affichage seulement. Comparer au seuil la valeur non arrondie et afficher clairement les cas limites (9,999 ne devient pas une admission par affichage à 10,00).
- La proposition calculée ne remplace pas la décision validée par la direction/conseil de classe : Admis, Redouble ou Exclu. Une exclusion ne se déduit jamais d'une moyenne seule. La bascule annuelle (§7.9) utilise la décision validée.

#### 7.3.3 Absences, modération & audit

- Distinguer **note zéro**, **ABS justifiée** et **note non saisie**. Zéro compte dans les calculs ; ABS justifiée exclut la note et son poids du dénominateur ; note manquante signale une saisie incomplète. Toutes les notes ABS donnent « Non calculable ».
- Prévoir une politique explicite pour les absences non justifiées et les évaluations de remplacement ; aucune transformation silencieuse d'une absence en zéro.
- **Rachat manuel** : la direction peut admettre un élève ajourné avec motif obligatoire. Conserver moyenne, proposition initiale, décision finale, auteur et horodatage dans l'historique sans altérer les notes pour simuler le passage.
- Tracer les modifications de notes, paramètres, clôtures et réouvertures avec ancienne/nouvelle valeur et contexte établissement/année/période.

#### 7.3.4 Temporalité & verrouillage

- États : **À venir**, **Ouverte**, **Verrouillée**, **Publiée**. La saisie est autorisée à partir du début inclus et avant l'échéance exclusive, sauf clôture manuelle anticipée.
- Par défaut, la fin de période est l'échéance de saisie. Une date de verrouillage distincte définit une dérogation explicite et auditée (délai de correction), visible aux enseignants ; sans dérogation, aucune écriture après la fin.
- Contrôler l'heure serveur, les permissions et l'état de période à chaque écriture, dans la transaction ; un écran ouvert avant l'échéance ne permet pas de la contourner. Le verrouillage reste effectif même si le traitement planifié est en retard.
- Rappels automatiques aux enseignants à **X jours** de l'échéance, configurables, ciblés sur les saisies incomplètes et dédupliqués via `notification_outbox`.
- Réouverture réservée à la direction, avec motif obligatoire. Après publication, toute correction produit une nouvelle version du bulletin et conserve l'ancienne dans l'historique.

#### 7.3.5 Saisie professeur & synchronisation

- Sélecteurs en cascade **Classe → Matière → Évaluation**, limités aux affectations de l'enseignant et à l'année sélectionnée.
- Grille avec élèves en lignes, barème visible, saisie numérique contrôlée et navigation **Entrée**, **Tabulation**, **Flèche bas**. Contrôle ABS justifiée distinct de la note zéro et de la cellule vide ; utilisable au clavier et sur mobile.
- Auto-save après validation de cellule, avec regroupement raisonnable des écritures. États visibles : **Brouillon** orange, **Enregistrement**, **Sauvegardé** avec coche verte, **Erreur / Réessayer**, **Verrouillé** avec cadenas. Ne jamais afficher « Sauvegardé » avant confirmation serveur.
- L'auto-save réalise une écriture authentifiée ; **Supabase Realtime diffuse les changements validés, il ne remplace pas la sauvegarde**. Le serveur reste la source de vérité ; les calculs locaux éventuels sont provisoires.
- Après sauvegarde, actualiser moyenne matière, moyenne périodique et cumul annuel provisoire ; la direction voit le taux de remplissage par classe/matière (notes ou absences renseignées / entrées attendues).
- Gérer les éditions concurrentes par numéro de version et signaler les conflits sans écrasement silencieux. À la reconnexion, relire les données canoniques pour récupérer les événements manqués.
- Hors réseau, conserver les brouillons localement sans les présenter comme enregistrés. Revalider droits et période à la reprise ; les notes arrivant après verrouillage sont refusées sans perdre le brouillon. Purger les données locales au changement de compte.

#### 7.3.6 Direction, clôture & bulletins

- Tableau de bord : couverture des saisies, élèves sous le seuil, moyennes par classe et comparaison des distributions par matière pour repérer les écarts de notation. Ces écarts sont des indicateurs à examiner, pas des sanctions automatiques.
- Alertes précoces avec badge rouge et texte accessible ; éviter le clignotement continu et respecter la réduction des animations. Distinguer une moyenne provisoire d'un résultat complet.
- Action **Clôturer la période** avec récapitulatif des notes manquantes, anomalies et décisions à valider. Bloquer la publication incomplète, sauf dérogation explicite, motivée et visible sur le bulletin.
- Verrouiller et figer un instantané cohérent des notes, coefficients, règles et calculs avant génération. Générer les bulletins PDF en tâche de fond, avec progression, reprise sur erreur et idempotence ; n'envoyer aux parents qu'après publication réussie.
- Bulletin : établissement, année, période, élève/classe, notes et absences, moyennes, coefficients, rangs, appréciations, résultats et décision annuelle validée lorsque pertinente. Les périodes intermédiaires n'affichent pas une admission définitive.
- Rangs calculés sur les résultats non arrondis et comparables de la classe ; égalités au même rang selon la convention **1, 2, 2, 4**. Les résultats incomplets sont non classés, sauf règle explicite publiée.
- PDF généré depuis l'instantané versionné, sans imposer d'archivage de fichiers lourds contraire au principe texte-only. QR Code signé pour vérifier l'authenticité et la version ; aucune note ni identité de mineur exposée publiquement par le QR. Téléchargement soumis aux droits habituels.
- Envoi automatique via l'outbox existante, sans doublons pour un même destinataire et une même version. Un échec d'envoi ne doit ni rouvrir la période ni régénérer les décisions.

#### 7.3.7 Portails parent / élève

- Fil des notes et notifications push après enregistrement et selon la politique de publication de l'école ; notifications discrètes, sans détail sensible sur écran verrouillé, avec consentement et préférences de réception.
- Consultation des seuls résultats autorisés de l'élève ou des enfants liés au parent, conformément au gating du §4.5 ; téléchargement du bulletin officiel et de sa version corrigée le cas échéant.
- **Simulateur de performance** : déterminer la note minimale nécessaire aux évaluations restantes à partir des coefficients, pondérations et barèmes connus. Afficher les hypothèses, les données manquantes et les cas « objectif déjà atteint » ou « impossible avec les évaluations prévues ». Simulation indicative, sans écriture de notes et sans garantie d'admission en cas de changement des hypothèses ou de décision du conseil.

#### 7.3.8 Architecture multi-tenant & contrats applicatifs

- Toute donnée académique du module appartient à un `school_id` et, selon sa portée, à une année, un cycle, une classe, une matière et une période. Les relations doivent empêcher le rattachement d'une note à un élève ou une évaluation d'un autre établissement.
- Isolation par RLS, permissions serveur et abonnements Realtime autorisés ; le `school_id` actif provient du contexte authentifié, jamais d'une valeur client acceptée sans contrôle. Professeur limité à ses affectations ; direction à son école ; parent à ses enfants autorisés.
- **Modèle conceptuel à raccorder au schéma existant avant migration** : configuration académique versionnée, périodes datées, évaluations (type, barème, poids), notes (valeur ou statut d'absence, version), agrégats calculés, décisions/modérations auditées et instantanés de bulletins. Réutiliser les affectations classe/matière, `grades`, `report_cards` et `notification_outbox` lorsque compatibles, sans créer de tables concurrentes pour un même concept.
- Contraintes : une note par inscription/évaluation, barème strictement positif, note entre zéro et barème, statut ABS incompatible avec une valeur numérique, poids non négatifs et décisions finales attribuées à un auteur autorisé.
- **Contrats d'actions serveur/API à prévoir**, sans imposer de nouvelles routes : lire/configurer les règles ; créer une évaluation ; sauvegarder une note avec version attendue et identifiant d'opération ; consulter moyennes et couverture ; clôturer/réouvrir une période ; modérer une décision ; consulter/télécharger un bulletin autorisé.
- Chaque mutation renvoie un état canonique ou une erreur métier explicite (hors barème, période verrouillée, conflit de version, droits insuffisants). Réessais idempotents ; aucune écriture partielle d'un lot annoncé comme atomique.
- Recalcul ciblé sur l'élève/matière/période touché ; index tenant/année/classe/période et abonnements limités au contexte affiché. Traitements lourds de clôture, PDF et notifications en arrière-plan avec suivi et reprise ; pas de recalcul global de toutes les écoles à chaque note.
- Valider la montée en charge avec un scénario représentatif de centaines d'écoles et de milliers d'enseignants simultanés ; mesurer latences de sauvegarde/recalcul, erreurs, retards de diffusion et saturation. Les objectifs chiffrés et capacités d'hébergement seront fixés puis vérifiés par des tests de charge, sans promettre « zéro bug ».

#### 7.3.9 Workflow & critères de recette

```text
Direction : année → règles par cycle → calendrier → matières / coefficients
    ↓
Professeur : classe → matière → évaluation → notes / ABS → auto-save confirmé
    ↓
Moteur : moyenne matière → moyenne période → cumul annuel → proposition
    ↓
Direction : contrôle de complétude → modération → clôture → publication
    ↓
Parent / Élève : notification → bulletin officiel ; décision validée → bascule N+1
```

**Tests obligatoires avant livraison du module** :

1. Calculs déterministes : notes 10 et 14 de poids 1 et 2 → `38/3` ; matières 12 coef 4 et 15 coef 2 → moyenne 13 ; trimestres 8, 10, 12 → annuel 10 ; semestres 9 et 11 → annuel 10 ; primaire 12 et passage 15 → global 13,8.
2. Pourcentages fixes par catégorie : interros 10 et 14, devoir 18, répartition 40/60 → 15,6 (et non une pondération dépendant du nombre de notes). Inclure une composition dans les calculs et tester les catégories manquantes.
3. Seuils : 10,00 admis au seuil 10 ; 9,85 ajourné/repêchable selon configuration ; 9,999 sous le seuil malgré l'arrondi. Vérifier également un barème primaire en points et une décision manuelle motivée sans modification des notes.
4. Absences : 0 et 10 à poids égaux → 5 ; ABS justifiée et 10 → 10 ; toutes ABS → non calculable ; note manquante ou période obligatoire absente → incomplet, sans admission définitive.
5. Temporalité : avant début, pendant ouverture, exactement à l'échéance, clôture anticipée, dérogation et réouverture ; une sauvegarde concurrente à la clôture ne doit jamais modifier un instantané publié.
6. Synchronisation : navigation clavier, confirmation serveur, perte réseau, reprise après verrouillage, conflits simultanés, reconnexion Realtime et déduplication des écritures/notifications.
7. Cloisonnement : école A sans accès aux notes, paramètres, canaux Realtime ou bulletins de B ; professeur non affecté refusé ; parent sans lien autorisé refusé. Vérifier séparément droits de configuration, clôture et modération.
8. Publication : rangs ex æquo, appréciations, décision annuelle, instantané reproductible, QR vérifiable sans fuite de données, génération et envoi réessayables sans doublons ; correction publiée en nouvelle version et bascule fondée sur la décision validée.
9. Simulateur : objectif réalisable, déjà atteint, impossible, hypothèses incomplètes ; aucune modification des résultats officiels.

### 7.4 Vie scolaire
- **Appel/assiduité par cours et par professeur** (pas par scan global à l'entrée) : chaque enseignant marque sa propre liste à chaque créneau, ce qui capture le cas d'un élève présent en heure 1 avec un professeur et absent en heure 2 avec un autre. C'est la source de vérité, **indépendante de tout matériel de scan** — fonctionne pour toutes les écoles, y compris celles sans portail équipé.
- Discipline : rapports d'incident, retenues, conseils de discipline.
- Contrôle d'accès par scan QR (portail, examens) *(optionnel, écoles équipées uniquement)*, logique anti-passback.
- 🆕 Pour les écoles équipées d'un scan de portail : croisement automatique avec l'appel par cours pour détecter « élève entré dans l'établissement mais absent en cours » → alerte de décrochage envoyée à la surveillance.
- 🆕 **Contact d'urgence disponible au dossier** : le nom et le téléphone de la personne à prévenir sont portés par la fiche tuteur, saisis **dès l'inscription** (par défaut le parent lui-même, cf. §7.1.1). La surveillance ou l'infirmerie dispose donc immédiatement du bon numéro, sans dépendre d'un appel au secrétariat ni de la mémoire d'un agent. Le **lien de parenté** et la **scolarité antérieure** (école et classe précédentes) sont au même endroit — utiles pour reconstituer un parcours en cas d'incident ou d'orientation.

### 7.5 Finance & recouvrement
- Grille tarifaire par classe (généralisée en profils financiers configurables, cf §5).
- Échéanciers (comptant/trimestriel/mensuel), remises automatiques (fratries).
- Encaissement multicanal (espèces, Mobile Money, chèque), reçu numéroté avec QR anti-fraude et page de vérification publique.
- Clôture de caisse quotidienne (comptage à l'aveugle, réconciliation, rapport Z, verrouillage, alerte écart).
- Relances graduées (J-5 préventif, J+1 formel, J+7 avertissement + restriction d'accès), moratoires avec scoring de fiabilité familiale et arbitrage direction (individuel ou en masse).
- Export comptable SYSCOHADA (mode synthétique/analytique, formats Sage/Excel/CSV), équilibre débit=crédit vérifié automatiquement.

### 7.6 Portails utilisateurs dédiés
- **Parent (PWA)** : **compte permanent** (téléphone + mot de passe), **sélecteur d'année scolaire** (année en cours = accès complet, années clôturées = **lecture seule**, cf. §4.3 et §4.5), sélecteur enfant/établissement, situation financière en temps réel, paiement Mobile Money en 1 clic, téléchargement reçus/bulletins, demande de moratoire, mode hors-ligne.
- **Élève** : planning, devoirs, notes.
- **Professeur** : appel rapide, cahier de texte, saisie de notes.

### 7.7 Modules complémentaires (activables à la carte)
Transport scolaire · Cantine · Internat (bâtiments → dortoirs → chambres → lits, inventaire de chambre, permissions de sortie) · Bibliothèque · Infirmerie · Inventaire fournitures (collecte au guichet, bons de sortie, alertes de seuil) · Anti-vol tenues (macaron QR sublimé, étiquette thermocollante, ou puce RFID textile lavable en option premium).

### 7.8 Intégration Trouvetou

Trouvetou est le **canal d'acquisition** : c'est lui qui présente les établissements aux familles et initie les inscriptions. Schooly reste la source de vérité (structure, places, dossiers) et expose une API publique protégée par clé (`Authorization: Bearer`, `TROUVETOU_API_KEY`), versionnée sous `/api/v1/public/`.

> **Règle produit non négociable** : un établissement n'est visible et réservable via Trouvetou que s'il est explicitement **publié** (`schools.published_to_trouvetou`). Le contenu de son offre (niveaux, places) n'est jamais exposé par défaut.

#### 7.8.1 ✅ Routes livrées

| Route | Rôle |
|---|---|
| `GET /api/v1/public/ecoles` | Catalogue des établissements publiés |
| `GET /api/v1/public/ecoles/{id}` | Fiche établissement (structure, niveaux, moyens de paiement) |
| `GET /api/v1/public/schools/{id}/availability` | **Places disponibles en temps réel**, par niveau |
| `POST /api/v1/public/ecoles/{id}/request` | Création d'une demande de place (`pending_payment`) |
| `POST /api/v1/public/ecoles/{id}/reserve` | Encaissement en ligne → dossier `reserved`, QR token, validité 72 h |
| `POST /api/v1/public/ecoles/{id}/reinscription/check` | **Réinscription 1 clic — étape 1** : retrouve les enfants à partir du téléphone du parent, calcule la classe suivante et vérifie les places |
| `POST /api/v1/public/ecoles/{id}/reinscription/confirm` | **Réinscription 1 clic — étape 2** : le parent confirme, la pré-inscription est créée (`source = 'trouvetou'`) |
| `POST /api/v1/admin/trouvetou/reservations/finalize` | Finalisation d'une réservation par le secrétariat (création élève + inscription) |

#### 7.8.2 ✅ Places disponibles — une seule règle, jamais deux

La capacité d'un niveau est la **somme des capacités de ses classes**, et les élèves comptés sont ceux des inscriptions **vivantes** (hors brouillon, refus, transfert). La règle est calculée par une fonction partagée (`loadLevelsWithSeats`) utilisée par **toutes** les routes qui exposent ou vérifient les places : impossible que l'affichage Trouvetou et le contrôle d'acceptation divergent. La décrémentation des quotas est donc **automatique et cohérente** avec la réalité de l'école.

#### 7.8.3 ✅ Traçabilité de l'origine des dossiers

Chaque pré-inscription porte sa **source** : `form` (lien public de l'école), `trouvetou` (parcours Trouvetou), `counter` (saisie directe au guichet). L'école peut ainsi mesurer, année après année, ce que chaque canal lui apporte — et l'équipe peut diagnostiquer un dossier sans deviner son origine.

#### 7.8.4 ✅ Anti-doublon inter-canal (téléphone normalisé)

Un même parent peut saisir son numéro de plusieurs façons : `0700000000` au guichet, `+225 07 00 00 00 00` sur le formulaire en ligne, `002250700000000` via un partenaire. Sans traitement, ces trois écritures créent **trois tuteurs distincts** pour la même personne, et la réinscription en 1 clic ne retrouve plus l'enfant.

Correctif livré : un **format canonique unique** (`+225` + chiffres) calculé par la base elle-même (trigger sur `guardians.phone`), stocké dans `guardians.phone_norm` et indexé. **Toutes les recherches de parent passent par `phone_norm`, jamais par le numéro brut** — le miroir JavaScript et la fonction SQL appliquent exactement la même règle. Le numéro affiché à l'utilisateur reste, lui, dans son format d'origine.

#### 7.8.5 🔜 Reste à implémenter sur cette intégration

- Journal de synchronisation (`trouvetou_sync_log`) : traçabilité fine des échanges, utile en cas de litige sur une réservation.
- Publication automatique des nouveaux quotas à l'ouverture de l'année suivante (cf. §7.9).


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

#### 8.1 ✅ Accessibilité — exigence de qualité, pas option

L'interface est utilisée par un secrétariat en plein jour, parfois sur écran médiocre, et par des parents sur téléphone d'entrée de gamme. Elle doit donc être **conforme WCAG AA**, ce qui est vérifié automatiquement à chaque déploiement (audit Vercel / axe).

Règles obligatoires pour tout nouvel écran :

| Règle | Attendu |
|---|---|
| **Étiquetage des champs** | Chaque champ de formulaire a un `<label>` réellement relié (`htmlFor` ↔ `id`). Un champ sans étiquette accessible est un bug bloquant pour la mise en production. |
| **Nom accessible des fenêtres modales** | Toute boîte de dialogue porte un titre annoncé (`aria-labelledby`) ou un libellé de secours ; le bouton de fermeture a un nom explicite (« Fermer »), jamais un simple « ✕ ». |
| **Contraste des textes** | Ratio minimal 4,5:1 (texte normal) et 3:1 (grand texte / éléments d'interface). Corrigé le 18/09 : verts et rouges trop clairs sur fond coloré, gris de la barre latérale, boutons en survol. |
| **Couleur jamais seule** | Une information d'état (validé, en attente, refusé) est portée par un texte ou une icône **en plus** de la couleur. |
| **Navigation au clavier** | Tout est atteignable sans souris, l'élément sélectionné est visible (focus), `Échap` ferme les dialogues. |
| **Annonce des erreurs** | Les messages d'erreur sont annoncés aux lecteurs d'écran (`role="alert"`), pas seulement affichés. |

---

## 9. Exigences non-fonctionnelles

- **Performance réseau** : fonctionnement acceptable en 2G/3G ; toute donnée déjà consultée reste disponible hors-ligne.
- **Précision financière** : montants stockés en entiers (le FCFA n'a pas de sous-unité) — jamais de type flottant pour l'argent.
- **Idempotence** : tout webhook de paiement traité une seule fois même livré plusieurs fois.
- **Auditabilité** : écriture financière immuable après clôture ; toute suppression est un soft-delete tracé.
- **Confidentialité mineurs** : données d'élèves particulièrement sensibles — principe de moindre privilège strict (RLS + UI).
- **Scalabilité multi-écoles** : aucune requête ne doit scanner l'ensemble de la base sans filtre `school_id`.

#### 9.1 ✅ Trois règles apprises en production (18/09/2026)

**1. Un `GRANT` est aussi obligatoire que la policy RLS.**
Sur PostgreSQL, une policy RLS n'est évaluée **qu'après** le privilège SQL de base sur la table. Une table avec une policy parfaite mais sans `GRANT` au rôle `authenticated` renvoie `42501 permission denied` — et non « accès refusé par la politique ». C'est exactement ce qui a produit, en production, un message « Aucune école rattachée » pour des comptes pourtant correctement rattachés : la lecture échouait avant même d'atteindre la policy.

Règle : **toute nouvelle table** destinée au client de session doit avoir ses `GRANT` explicites (`select`, plus `update`/`insert` si le rôle doit écrire) dans la **même migration** que sa création. Le moindre privilège reste la règle ; les migrations de rattrapage sont un pansement, pas une méthode.

Corollaire côté code : **une garde d'accès ne doit jamais confondre « pas de données » et « erreur serveur »**. Une erreur SQL remontée comme « aucune école rattachée » envoie l'équipe sur une fausse piste pendant des heures. Les causes sont désormais distinguées : `Non autorisé` (session), `Action réservée à un rôle supérieur` (rôle), `Aucune école rattachée` (données), `Erreur serveur` (technique).

**2. Les migrations doivent être idempotentes et vérifiables.**
Toutes les migrations sont ré-exécutables sans erreur (`if not exists`, `create or replace`, `drop ... if exists`). Pour un rattrapage d'exploitation, un **script unique consolidé** est fourni (`20260918180000_catchup_18_09.sql`) : appliquer six fichiers à la main est une source d'oubli, et une migration manquée se traduit par un formulaire qui échoue silencieusement. Le script porte en fin de fichier les requêtes de contrôle permettant de vérifier que tout est bien appliqué.

**3. Une fonction SQL peut être « valide » et ne jamais fonctionner.**
`finalize_reservation()` (finalisation d'une réservation Trouvetou) écrivait dans `students (birth_date)` — une colonne **inexistante** (la vraie est `date_of_birth`, et elle est obligatoire). La fonction se créait sans la moindre erreur, mais **100 % des finalisations échouaient ensuite**, en erreur 500 sans message exploitable : rien dans les journaux ne désignait la ligne fautive. Le bug était invisible depuis l'interface et ne se voyait que sur un appel réel.

Règle : une fonction `security definer` qui écrit en base se **valide par un appel réel sur une base de recette**, jamais en se contentant de vérifier qu'elle se compile. Et une fonction appelée depuis un webhook ou une route publique doit **refuser explicitement un état incomplet** (année académique active absente, date de naissance manquante) plutôt que de laisser remonter une erreur SQL opaque — le dossier reste alors en attente, complétable par le secrétariat, au lieu d'être perdu.

Corollaire métier appliqué : la finalisation **réutilise** le tuteur (retrouvé par téléphone normalisé, cf. §7.8.4) et l'élève (même nom + même date de naissance dans la même école) au lieu de créer systématiquement de nouvelles fiches — sinon chaque réservation en ligne fabriquait un doublon, et la réinscription en 1 clic devenait inopérante faute de retrouver l'enfant.

---

## 10. Roadmap de développement (phases pour l'agent IA)

> Chaque phase indique Objectif, Livrables et Critère d'acceptation. Respecter l'ordre : chaque phase dépend structurellement de la précédente, sauf mention « piste parallèle ».

> **État au 18/09/2026** : les phases **0 à 4** sont opérationnelles (fondations, multi-tenant/auth, structure académique, élèves & inscriptions, finance), ainsi que l'essentiel de la phase **10** (Trouvetou : catalogue, disponibilité temps réel, réservation, réinscription en 1 clic). La phase **6** (pédagogie) est intégralement spécifiée (§7.3) et en cours d'implémentation. Pour la lecture côté établissement, voir le statut de mise en service §16.4.

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
PWA Parent, portail élève, portail professeur.
**Compte parent (spécifié, cf. `architecture-compte-parent.md`)** : compte **permanent** identifié par le téléphone + mot de passe choisi au premier accès (éligibilité vérifiée en base, aucune inscription ouverte) ; **sélecteur d'année scolaire** — année `en_cours` = accès complet, année `cloturee` = **lecture seule**, année `planifiee` = aucun accès ; multi-enfants **et** multi-établissements sur un même compte ; parcours « numéro perdu / changé » validé par l'administration de l'école.
*Acceptation* : un parent suit son enfant d'une année sur l'autre et change d'établissement **sans jamais recréer de compte** ; les données d'une année clôturée restent consultables mais non modifiables.

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
- [ ] **GRANT explicites** posés dans la même migration que la création de table (cf. §9.1)
- [ ] **Accessibilité WCAG AA** : labels reliés, contraste ≥ 4,5:1, dialogues nommés, erreurs annoncées (cf. §8.1)
- [ ] Aucune valeur métier codée en dur (tarif, statut, coefficient)
- [ ] Fonctionne en mode dégradé réseau (offline ou message clair)
- [ ] États vide / chargement / erreur tous conçus
- [ ] **Message d'erreur compréhensible par le rôle concerné** (jamais un code technique, jamais un message générique qui masque la cause)
- [ ] Tests automatisés sur la logique métier (pas seulement le rendu)
- [ ] Vocabulaire adapté au rôle concerné (pas de jargon technique visible)
- [ ] **Documentation à jour** : toute fonctionnalité livrée est décrite dans ce cahier des charges (§7.x du module concerné). Si elle est visible par l'école ou par la famille, elle est **aussi** ajoutée à la synthèse « présentation aux établissements » (§16) et au statut de mise en service (§16.4) — c'est ce document qui sert à expliquer Schooly aux écoles intéressées, il ne doit jamais être en retard sur le code.

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

**Technique**
- **RLS** : Row Level Security — sécurité au niveau ligne, Postgres. Ne s'applique qu'**après** un `GRANT` explicite (cf. §9.1).
- **GRANT** : privilège SQL de base accordé à un rôle (`authenticated`, `service_role`). Indispensable en plus de la policy RLS.
- **Rollover** : bascule d'une année académique à la suivante.
- **Soft-delete** : suppression logique (`deleted_at`) — la donnée n'est jamais effacée physiquement.
- **Idempotent** : opération ré-exécutable sans effet supplémentaire (une migration, un webhook, une réinscription confirmée deux fois).

**Métier — inscriptions**
- **Pré-inscription** : demande remplie par la famille (en ligne ou au guichet), **non définitive**, valable 72 h, matérialisée par un code à 6 caractères. Elle ne crée ni élève ni matricule.
- **Inscription** : acte définitif prononcé **au guichet** après vérification des pièces — crée la fiche élève, le matricule et le badge QR.
- **Réinscription** : élève **déjà connu** de l'établissement qui poursuit sa scolarité. Se fait en un clic, sans ressaisie.
- **Matricule** : identifiant permanent de l'élève, stable d'une année à l'autre — c'est lui qui permet de réinscrire sur la fiche existante sans créer de doublon.
- **Orienté État / non orienté** : élève affecté dans l'établissement par l'État (notification DECO/DRENA) ou inscrit à l'initiative de sa famille. Le numéro de notification est conservé au dossier.
- **Contact d'urgence** : personne à appeler en cas d'incident — par défaut le parent lui-même, sinon une autre personne désignée dès l'inscription.
- **`phone_norm`** : forme canonique d'un numéro (`+225` + chiffres), calculée par la base. Deux écritures du même numéro désignent ainsi **un seul** parent (cf. §7.8.4).

**Écosystème & référentiels**
- **Trouvetou** : plateforme de découverte d'établissements (écosystème Refontiq) — canal d'acquisition qui alimente Schooly en dossiers.
- **DRENA** : Direction Régionale de l'Éducation Nationale (Côte d'Ivoire).
- **DECO** : Direction de l'Éducation et de l'Orientation — émet les affectations d'élèves.
- **SYSCOHADA** : référentiel comptable en vigueur en zone OHADA.
---

## 16. Synthèse pour la présentation aux établissements

> Cette section est destinée à être **parlée telle quelle** à un directeur ou un fondateur d'école. Elle ne contient aucun terme technique.

### 16.1 Ce que l'école gagne, concrètement

| Le problème de l'école aujourd'hui | Ce que Schooly fait à la place |
|---|---|
| Les inscriptions se font au guichet, sur papier, avec des files d'attente | La famille peut pré-inscrire son enfant **depuis son téléphone en 3 minutes**, ou passer au guichet — l'école choisit, la famille aussi |
| Les parents remplissent des formulaires longs et se trompent (noms, dates, numéros) | Le formulaire **corrige automatiquement** les noms, formate les numéros, calcule l'âge, pré-remplit ce qu'il peut deviner — et **sauvegarde la saisie** si le réseau coupe |
| Les élèves réinscrits repassent par tout le circuit administratif | La réinscription se fait **en un clic** : le parent confirme, le dossier est déjà complet |
| L'école promet des places puis découvre qu'elle est complète | Les **places disponibles sont vérifiées en temps réel** avant d'accepter une inscription — plus de promesse impossible à tenir |
| Le secrétariat retape les mêmes informations pour chaque année, chaque frère et sœur | Une information saisie **une fois** suit l'élève et sa famille : scolarité antérieure, lien de parenté, contact d'urgence, tuteur |
| En cas d'urgence, personne ne sait qui appeler | Le **contact d'urgence est au dossier**, saisi dès l'inscription (et par défaut : le parent lui-même) |
| Le suivi des élèves orientés par l'État se perd dans les cahiers | Chaque dossier indique s'il est **orienté par l'État** ou non, avec le numéro de notification — filtrable et exportable |
| Le parent n'a aucun moyen de suivre son enfant sans appeler l'école | Le **même numéro de téléphone** donné à l'inscription **identifie** le parent et ouvre son tableau de bord (notes, paiements, absences), année par année — sans rien recréer à chaque rentrée |
| Les dossiers créés via un partenaire finissent en doublons | Le téléphone est normalisé : un parent = **un seul dossier**, quel que soit le canal qui l'a saisi |
| Le secrétariat se bloque sur des erreurs techniques incompréhensibles | Les messages sont **en français et parlants** : « action réservée à un rôle supérieur », « aucune école rattachée », jamais « erreur 42501 » |

### 16.2 Trois arguments de vente à retenir

1. **« Vos familles n'ont rien à apprendre — et ne recreent jamais leur compte. »** Le parent **s'identifie par son numéro** (déjà connu de l'école) et choisit une fois son mot de passe : ni application à installer, ni matricule à retrouver, ni inscription à refaire chaque année. La réinscription se fait en un seul bouton, et le compte suit l'enfant même s'il change d'établissement.
2. **« Votre secrétariat ne ressaisit jamais deux fois la même information. »** Ce que le parent déclare circule automatiquement jusqu'au dossier définitif de l'élève et du tuteur.
3. **« Vous ne promettez jamais plus de places que vous n'en avez. »** L'école déclare la capacité de ses classes une fois ; le système refuse automatiquement toute inscription au-delà, partout — guichet, lien public, Trouvetou.

### 16.3 Ce que l'école doit fournir pour démarrer

1. Sa **structure** : niveaux, classes et **capacité de chaque classe** (déterminant pour les places disponibles).
2. Ses **frais et échéanciers** par niveau, et les moyens de paiement acceptés.
3. Sa **liste des fournitures et des pièces à fournir** (par niveau si elle diffère).
4. Les **comptes utilisateurs** de son personnel, avec le rôle de chacun (direction, secrétariat, comptabilité, professeur, surveillance).

Le reste — formulaire public, calcul des places, réinscription en 1 clic, accès parent — est **opérationnel dès la mise en service**.

### 16.4 Statut de mise en service au 18/09/2026

Tableau honnête à montrer tel quel à un établissement : ce qui est **utilisable aujourd'hui**, et ce qui reste **à venir**. Ne jamais présenter un élément 🔜 comme disponible.

| Domaine | État | Détail |
|---|---|---|
| Inscriptions & admissions | ✅ en service | Formulaire public intelligent et facultatif, pré-inscription par code 72 h, validation au guichet, matricule + badge QR |
| Réinscription en 1 clic | ✅ en service | Le parent confirme par téléphone, la classe suivante est pré-calculée |
| Places disponibles | ✅ en service | Calcul en temps réel depuis la capacité déclarée des classes ; refus automatique au-delà, guichet comme en ligne |
| Dossier famille | ✅ en service | Lien de parenté, contact d'urgence, scolarité antérieure, orientation État, tuteur unique anti-doublon |
| Accès parent (compte permanent) | ✅ mécanisme livré | Rattachement tuteur ↔ compte parent, numéro normalisé (`phone_norm`) et **autorisation par année scolaire** (année en cours = accès complet, année clôturée = lecture seule) via la migration `20260918190000` ; l'écran d'accès PWA suit la Phase 8 de la roadmap |
| Structure académique | ✅ en service | Années, niveaux, classes, matières, affectations, bascule d'année |
| Finance | ✅ socle en service | Tarification, encaissement, reçus, caisse, référence de paiement adaptée au mode |
| Pédagogie & bulletins | 🔜 spécifié | Module d'évaluation intelligente entièrement spécifié (§7.3), implémentation en cours |
| Vie scolaire, portails, modules à la carte | 🔜 spécifié | Specs prêtes (§7.4, §7.6, §7.7), développement selon la roadmap (§10) |
| Import de la liste du Ministère, affectation automatique de classe | 🔜 à venir | Décrit en §7.1.6, utile surtout pour les gros effectifs |

> **Règle de communication** : un établissement peut démarrer **dès maintenant** sur les inscriptions, la structure et la caisse — c'est le cœur de sa rentrée. Le reste s'ajoute sans réinstallation ni reprise de données.
