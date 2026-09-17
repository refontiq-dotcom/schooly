# Refontiq — Architecture d'Écosystème

*Document de cadrage stratégique et technique — indépendant du cahier des charges Schooly*
*Version 1.1 — mis à jour après revue des repos GitHub (Séjoura, Docly, Trouvetou)*

## Résumé exécutif (à lire en premier, avant toute action)

Refontiq possède plusieurs SaaS B2B **indépendants**, chacun avec sa propre base de données et son propre code, qui **ne fusionnent jamais entre eux** :
- **Séjoura** (en production) — gestion de résidences meublées/hôtels.
- **Trouvetou** (en production, actuellement couplé à Séjoura — à découpler) — plateforme de découverte grand public (écoles, hébergements, cliniques).
- **Schooly** (en développement, repo séparé) — gestion scolaire.
- **Docly** (à reconstruire, repo séparé) — gestion de clinique.
- **refontiq.com** — site vitrine institutionnel.

**Une seule exception transversale** : un tableau de bord **Super Admin unique** pour piloter TOUS les produits depuis un seul endroit (vue consolidée : clients actifs, revenus, alertes, par produit).
- Il n'appartient à **aucun** produit individuellement.
- Il vit dans son **propre repo neutre** : `refontiq-control-center` — séparé de Séjoura, Schooly, Docly et Trouvetou.
- Il **reprend** (extrait, ne recode pas) la logique déjà existante dans Séjoura à `/admin/dashboard` : authentification par mot de passe seul, alertes Telegram, validation des demandes de paiement d'abonnement.
- Détails complets : section 5 (le hub) et section 6.2 (le moteur de facturation partagé).

Si un point reste flou après ce résumé, se référer aux sections détaillées ci-dessous plutôt que de supposer.

## Sommaire
1. Vision de l'empire Refontiq
2. Cartographie des produits actuels
3. Le contrat « Trouvetou Connector »
4. Identité unique portée par Trouvetou
5. Refontiq Control Center (hub super-admin)
6. Registre de commerce unique & moteur de facturation mutualisé
7. refontiq.com — structure & rôle
8. Design system partagé
9. Roadmap de mise en œuvre
10. Checklist « Refontiq-ready » pour tout nouveau projet
11. Points à vérifier après revue des repos GitHub

---

## 1. Vision de l'empire Refontiq

Refontiq est la maison mère qui opère plusieurs SaaS verticaux B2B, chacun dédié à un secteur (éducation, hébergement, santé...), unifiés par une plateforme de découverte grand public unique : **Trouvetou**.

Principe directeur : **chaque SaaS vend à l'entreprise cliente (école, résidence, clinique), Trouvetou fait connaître ces entreprises au grand public**. Refontiq orchestre l'ensemble via des standards partagés (identité, facturation, design, reporting), sans jamais fusionner les produits entre eux.

Ce document ne remplace pas les cahiers des charges produit (ex. Schooly) — il définit la couche transverse qui les relie.

---

## 2. Cartographie des produits actuels (mise à jour après revue des repos GitHub, sept. 2026)

| Produit | Statut réel | Stack | Cible | Rôle |
|---|---|---|---|---|
| **Schooly** | Cahier des charges prêt, développement à démarrer | Next.js + Supabase (prévu) | Écoles (B2B) | SaaS vertical gestion scolaire |
| **Séjoura** | En production, le plus avancé (425 commits) | Next.js + Supabase, Bun, Vitest, Vercel | Résidences meublées / Hôtels (B2B) | SaaS vertical gestion d'hébergement — héberge aujourd'hui le hub Super Admin multi-produits (à extraire, §5) |
| **Trouvetou** | En production, mais **couplé à Séjoura** (même repo, même base Supabase) | Next.js + Supabase partagée avec Séjoura | Grand public (B2C) | Hub de découverte multi-catégories — **à découpler en priorité (§2.1)** |
| **Docly** | Embryon (8 commits) | HTML/JS vanilla + Supabase + Service Worker — **migration Next.js décidée** | Cliniques (B2B) | SaaS vertical gestion de clinique |
| **refontiq.com** | Site vitrine déjà en place | Next.js + Tailwind, catalogue extensible (`src/lib/saas.ts`) | Institutionnel | Vitrine + catalogue produits |
| *(futurs projets)* | — | Next.js + Supabase par défaut | — | Doivent respecter la checklist « Refontiq-ready » (§10) dès leur conception |

### 2.1 Découplage Trouvetou / Séjoura — correction prioritaire
Le repo actuel héberge Séjoura et Trouvetou dans un même monorepo, branché sur la même base Supabase — un couplage direct en base, pas via API. Risqué à mesure que Docly et Schooly rejoignent l'écosystème : un incident ou une migration sur la base de Séjoura impacterait Trouvetou, qui doit pourtant rester neutre vis-à-vis de chaque SaaS vertical.

**Correction décidée** :
- Extraire Trouvetou dans son propre repo, avec son propre projet Supabase.
- Basculer la communication Séjoura ↔ Trouvetou du partage direct de base vers le contrat **Trouvetou Connector** (§3) — Séjoura devient un simple fournisseur d'annonces parmi d'autres, au même titre que Schooly et Docly demain.

### Schéma global (cible, après découplage)

```
                    TROUVETOU (grand public, B2C, base Supabase propre)
              « Je cherche une école / un logement / une clinique »
                              │  (via Trouvetou Connector, §3)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
    SCHOOLY               SÉJOURA                DOCLY
  (B2B écoles)      (B2B résidences/hôtels)   (B2B cliniques)
  base propre           base propre            base propre
```

---

## 3. Le contrat « Trouvetou Connector »

C'est la pièce maîtresse technique de l'écosystème : un standard unique que Schooly, Séjoura, Docly et tout futur SaaS implémentent de la même façon pour dialoguer avec Trouvetou.

### 3.1 Lecture (annonces)
Chaque SaaS expose ses annonces dans un format commun :
```json
{
  "id": "uuid",
  "categorie": "ecole | hebergement | clinique",
  "nom": "string",
  "localisation": { "lat": 0.0, "lng": 0.0 },
  "disponibilite": true,
  "prix_min": 0,
  "prix_max": 0,
  "medias": ["url"],
  "badge_verifie": true,
  "attributs_specifiques": { }
}
```
`attributs_specifiques` porte les champs propres à chaque secteur (niveau scolaire pour Schooly, type de chambre pour Séjoura, spécialité médicale pour Docly) sans polluer le contrat commun.

### 3.2 Écriture (demande/réservation)
Route standard : `POST /api/v1/public/{categorie}/{id}/request`
Quand un utilisateur agit sur Trouvetou (pré-inscription, réservation, prise de rendez-vous), Trouvetou appelle cette route et l'événement est créé directement dans le SaaS concerné — même logique que le tunnel déjà conçu pour Schooly (pré-inscription → code → validation guichet), généralisable tel quel.

### 3.3 Pourquoi le poser maintenant
Avec seulement 3-4 produits, standardiser ce contrat coûte trois fois moins cher qu'après le 5ème produit, où chaque intégration ad hoc devient un cas particulier à maintenir indéfiniment.

---

## 4. Identité unique portée par Trouvetou

Puisque Trouvetou est le point de contact que la population doit connaître, c'est lui qui porte l'identité du consommateur — pas chaque SaaS séparément.

- **Clé pivot** : numéro de téléphone + OTP (cohérent avec le modèle d'identité globale déjà défini côté Schooly).
- **Reconnaissance croisée** : Schooly, Séjoura et Docly reconnaissent une identité déjà créée sur Trouvetou, sur le principe d'un « Se connecter avec Trouvetou/Refontiq » — pas de re-création de compte.
- **Bénéfice concret** : un parent qui a cherché une école sur Trouvetou et réserve plus tard un logement via Séjoura n'a jamais besoin de ressaisir ses informations.
- **Portée** : ce mécanisme concerne l'identité du **grand public** (parents, particuliers). L'authentification du personnel de chaque SaaS (direction, staff) reste propre à chaque produit et n'a pas vocation à être mutualisée.

---

## 5. Refontiq Control Center — extraction, pas création

Bonne nouvelle : ce hub existe déjà en embryon dans Séjoura (`/admin/dashboard`), avec une authentification Super Admin par mot de passe seul, et des cartes vers chaque produit (Séjoura actif, Docly/Schooly « Prochainement »). Il ne faut donc pas repartir de zéro — il faut **l'extraire** de Séjoura vers un projet neutre, en conservant les mécanismes déjà éprouvés :

- Authentification par mot de passe seul (pas d'email demandé), cohérente avec un usage strictement interne.
- **Alertes Telegram gratuites** vers le Super Admin (déjà en place côté Séjoura) : nouvelle demande de validation d'abonnement, nouvel établissement inscrit, paiement automatique reçu, abonnement expiré — un canal 100 % gratuit et illimité, à adopter comme convention pour tous les futurs produits (voir §8).
- Le flux de validation de paiement (`subscription_payment_requests`, RPC de validation/rejet) — voir §6.2, ce pattern devient un composant partagé plutôt qu'une fonctionnalité propre à Séjoura.

Le Control Center extrait reste la seule interface où chaque produit pousse ses métriques standardisées (`{ projet, nom, mrr, comptes_actifs, statut_sante, derniere_synchro }`), avec un accès SSO vers le détail de chaque produit.

---

## 6. Registre de commerce unique & moteur de facturation mutualisé

### 6.1 Registre de commerce Refontiq
Un registre de commerce unique au nom de Refontiq, couvrant tous les produits, débloque en une seule démarche :
- L'intégration Mobile Money marchande pour Schooly (actuellement bloquée, cf. discussion sur la facturation SaaS).
- Le même déblocage pour Séjoura, Docly et tout futur produit, sans répéter la démarche.

### 6.2 Moteur de facturation mutualisé — généraliser le pattern déjà existant dans Séjoura

Séjoura a déjà un flux de facturation manuel fonctionnel, à généraliser plutôt qu'à réinventer pour Schooly :
1. Le client (gérant ou directeur d'école) paie via un **lien de paiement Wave**.
2. Il soumet son numéro Wave expéditeur dans un formulaire → création d'une demande dans une table `subscription_payment_requests` (statut `pending`) + notification Telegram au Super Admin.
3. Le Super Admin vérifie le transfert sur son propre compte Wave, puis valide ou rejette via une RPC dédiée — l'abonnement/le solde est mis à jour automatiquement.
4. Un flux automatique optionnel existe déjà en parallèle (webhook de paiement), prêt à prendre le relais dès qu'un compte marchand Wave est disponible pour Schooly.

**Action** : extraire ce pattern (schéma de table + RPCs + UI de validation + notification Telegram) dans un package partagé (`@refontiq/billing`), paramétrable par mode de calcul — abonnement à palier pour Séjoura, événementiel par élève pour Schooly, à définir pour Docly — mais avec le même mécanisme de collecte/réconciliation pour tous.

---

## 7. refontiq.com — structure & rôle

Rôle **institutionnel** : présenter l'entreprise, rassurer partenaires/écoles/investisseurs, rediriger — le trafic grand public réel doit aller vers Trouvetou, pas vers refontiq.com.

Structure recommandée :
- **Accueil** : mission, chiffres clés (nombre d'écoles équipées, familles accompagnées...) — alimentés automatiquement depuis `portfolio_metrics` du Control Center, zéro mise à jour manuelle.
- **Une page courte par produit** : logo, une phrase, bouton « Découvrir Schooly → » vers le sous-domaine (`schooly.refontiq.com`).
- **À propos / Vision**.
- **Contact / Presse**.
- *(Optionnel)* Blog SEO généraliste pour capter du trafic organique redirigé ensuite vers Trouvetou.

Décision de marque : hybride — sous-domaines techniques sous refontiq.com (bon pour le SEO, autorité de domaine consolidée), mais chaque produit garde son identité visible pour l'utilisateur final (« Schooly » reste « Schooly »). Refontiq apparaît discrètement (footer, écran de connexion), jamais en avant sur les écrans opérationnels.

**Règle sur les liens croisés** : contextuels uniquement, jamais intrusifs sur les écrans critiques (jamais de bannière dans le dashboard d'un caissier en pleine rentrée). Les liens de découverte pointent vers **Trouvetou**, pas vers refontiq.com — c'est Trouvetou qui porte la découverte croisée entre secteurs.

---

## 8. Design system & conventions techniques partagées

- Un package `@refontiq/ui` — composants de base (boutons, cartes, sidebar, tokens de couleur) construits une fois, réutilisés dans tous les produits.
- **Stack unifiée : Next.js (App Router) + TypeScript + Tailwind + Supabase** pour tout nouveau projet, et pour Docly après sa migration décidée. Séjoura, Trouvetou (après découplage) et refontiq.com sont déjà alignés.
- **Alertes internes par bot Telegram** (gratuit, illimité) comme canal standard pour tout événement nécessitant l'attention du Super Admin (nouvelle inscription, demande de validation de paiement, anomalie) — déjà éprouvé dans Séjoura, à répliquer dans Schooly et Docly plutôt que d'inventer un canal différent par produit.
- Gestionnaire de paquets à harmoniser (Bun utilisé par Séjoura, à confirmer ailleurs) pour simplifier la distribution du futur package `@refontiq/ui`.

---

## 9. Roadmap de mise en œuvre (mise à jour après revue des repos)

1. **Découpler Trouvetou de Séjoura** — repo et base Supabase séparés (§2.1).
2. **Extraire le Control Center** hors de Séjoura vers un projet neutre, en conservant l'auth par mot de passe et les alertes Telegram (§5).
3. **Généraliser le moteur de facturation** (`@refontiq/billing`) à partir du pattern déjà existant dans Séjoura (§6.2).
4. **Aligner Docly sur Next.js** (migration depuis HTML/JS vanilla).
5. **Contrat « Trouvetou Connector »** (lecture + écriture, catégorisé) — fondation technique du hub de découverte.
6. **Trouvetou multi-catégories** réel (Écoles / Hébergements / Cliniques), recherche géolocalisée par catégorie.
7. **Identité unique portée par Trouvetou**, reconnue par Schooly/Séjoura/Docly.
8. **Registre de commerce Refontiq** — débloque le Mobile Money marchand partout d'un coup (vérifier au passage l'offre « paiement en ligne » déjà proposée sur refontiq.com, §11).
9. **refontiq.com** — mise à jour du catalogue (`src/lib/saas.ts`) au fil de l'avancement de chaque produit ; le mécanisme est déjà en place, aucune reconstruction nécessaire.

> Le détail exécutable de chaque étape (tâches + prompts pour l'agent IA) est dans le document séparé « Refontiq — Plan de Travail & Prompts pour Agent IA ».

---

## 10. Checklist « Refontiq-ready » pour tout nouveau projet

Avant qu'un nouveau SaaS soit considéré comme prêt à rejoindre l'écosystème :
- [ ] Expose le contrat « Trouvetou Connector » si le produit a une composante grand public.
- [ ] Reconnaît l'identité Trouvetou pour ses utilisateurs finaux (pas de ré-authentification).
- [ ] Pousse ses métriques vers le Control Center (`portfolio_metrics`).
- [ ] Utilise le design system partagé (`@refontiq/ui`).
- [ ] Stack Next.js + TypeScript + Tailwind + Supabase (sauf exception documentée).
- [ ] Alertes internes critiques envoyées via le bot Telegram partagé.
- [ ] Prévoit dès la conception son intégration au moteur de facturation mutualisé (`@refontiq/billing`), si applicable.
- [ ] Base de données et backend isolés (jamais fusionnés avec un autre produit).

---

## 11. Constats confirmés après revue des repos GitHub (10 sept. 2026)

- **Séjoura** est le produit le plus mature (425 commits), en production, avec facturation par abonnement et hub Super Admin déjà fonctionnels — base de référence pour généraliser les patterns partagés (§5, §6.2).
- **Trouvetou** est en production mais couplé à Séjoura (même repo, même base Supabase) — correction en cours (§2.1).
- **Docly** est un embryon (8 commits) en HTML/JS vanilla — migration Next.js décidée.
- **refontiq.com** est un site vitrine déjà construit avec un catalogue de produits extensible (`src/lib/saas.ts`), plus deux offres de services propres à Refontiq : création sur-mesure et intégration de paiement en ligne (Mobile Money / PI-SPI) — cette dernière offre est à vérifier comme piste pour débloquer plus vite le compte marchand de Schooly.
