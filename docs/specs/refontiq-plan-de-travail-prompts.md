# Refontiq — Plan de Travail & Prompts pour Agent IA

*Document opérationnel — à utiliser en complément de « cahier-des-charges-schooly.md » et « refontiq-architecture-ecosysteme.md »*
*Version 1.0*

## Comment utiliser ce document

Chaque tâche est autonome et formatée pour être **copiée-collée directement à l'agent IA**, dans le repo concerné. Respecter l'ordre indiqué : les tâches de Priorité 0 débloquent tout le reste. Chaque tâche indique le repo cible, un prompt prêt à l'emploi, et des critères d'acceptation à vérifier avant de passer à la suivante.

---

## Ordre d'exécution global

1. **Priorité 0** — Correctifs transverses (découplage, extraction, généralisation)
2. **Schooly** — développement complet (référence au cahier des charges dédié)
3. **Docly** — migration Next.js puis développement métier
4. **Trouvetou** — autonomie technique + multi-catégories
5. **Séjoura** — adaptation post-extraction
6. **Refontiq Control Center** — nouveau projet
7. **refontiq.com** — mises à jour du catalogue au fil de l'eau

---

## PRIORITÉ 0 — Correctifs transverses urgents

### Tâche 0.1 — Découpler Trouvetou de Séjoura
**Repo** : Trouvetou (monorepo actuel partagé avec Séjoura)
**Contexte** : Trouvetou et Séjoura partagent aujourd'hui le même repo et la même base Supabase. Ce couplage direct doit disparaître avant que Docly et Schooly ne rejoignent l'écosystème.

**Prompt** :
```
Analyse la structure actuelle du monorepo (dossiers sejoura/ et trouvetou/,
base Supabase partagée). Prépare et exécute la séparation de Trouvetou :

1. Crée un nouveau projet Supabase dédié à Trouvetou.
2. Identifie toutes les tables/requêtes que Trouvetou lit actuellement
   directement dans la base de Séjoura.
3. Remplace ces accès directs par des appels à une API HTTP que Séjoura
   devra exposer (endpoints de type GET /api/v1/public/listings et
   POST /api/v1/public/listings/{id}/request), en respectant le format
   décrit dans le document refontiq-architecture-ecosysteme.md, section 3
   (contrat "Trouvetou Connector").
4. Extrais le code de Trouvetou dans son propre repo si techniquement
   possible, sinon isole-le clairement dans le monorepo en attendant
   la séparation complète.
5. Ne touche à aucune fonctionnalité visible ni pour les utilisateurs
   de Séjoura ni pour ceux de Trouvetou — c'est un refactor
   d'architecture, pas un changement de comportement.
6. Documente les changements dans un fichier MIGRATION-DECOUPLAGE.md
   à la racine du repo concerné.
```
**Critères d'acceptation** :
- Trouvetou ne fait plus aucune requête directe vers la base Supabase de Séjoura.
- Toutes les fonctionnalités existantes de Trouvetou et Séjoura fonctionnent identiquement après le changement.
- Le contrat d'API est documenté et versionné.

---

### Tâche 0.2 — Extraire le Control Center hors de Séjoura
**Repo** : Séjoura → nouveau repo `refontiq-control-center`
**Contexte** : `/admin/dashboard` dans Séjoura fait déjà office de hub multi-produits (cartes Séjoura/Docly/Schooly, auth par mot de passe, alertes Telegram). Il doit devenir un projet neutre.

**Prompt** :
```
Crée un nouveau projet Next.js + Supabase nommé "refontiq-control-center".

1. Reprends la logique d'authentification Super Admin par mot de passe
   seul actuellement présente dans /admin de Séjoura (sans exigence
   d'email), adaptée à ce nouveau projet indépendant.
2. Reprends le système d'alertes Telegram (variables TELEGRAM_BOT_TOKEN
   et TELEGRAM_CHAT_ID) tel qu'implémenté dans Séjoura.
3. Crée une table `portfolio_metrics` avec les colonnes :
   projet (text), nom (text), mrr (integer), comptes_actifs (integer),
   statut_sante (text), derniere_synchro (timestamptz).
4. Crée un endpoint API sécurisé (clé partagée par produit) que chaque
   SaaS (Séjoura, Schooly, Docly) pourra appeler pour pousser ses
   métriques : POST /api/metrics/push.
5. Construis un tableau de bord affichant la liste des produits avec
   leurs métriques, un indicateur de santé, et un lien vers le
   super-admin détaillé de chaque produit (URL configurable par produit,
   pas de SSO complet dans cette première version — un simple lien
   suffit pour démarrer).
6. Une fois ce projet fonctionnel, retire le code de /admin de Séjoura
   qui devient redondant (garde uniquement ce qui est propre à la
   gestion interne de Séjoura, comme la validation des paiements
   d'abonnement — voir tâche 0.3).
```
**Critères d'acceptation** :
- Connexion par mot de passe fonctionnelle sur le nouveau projet.
- Séjoura peut pousser ses métriques réelles vers `portfolio_metrics` et elles s'affichent correctement.
- Les alertes Telegram sont testées et arrivent bien sur le compte Super Admin.

---

### Tâche 0.3 — Généraliser le moteur de facturation Wave
**Repo** : Séjoura (extraction) → nouveau package `@refontiq/billing`
**Contexte** : le flux `subscription_payment_requests` (lien Wave → soumission numéro → validation manuelle par le Super Admin) fonctionne déjà dans Séjoura. Il doit devenir réutilisable pour Schooly et Docly.

**Prompt** :
```
Extrais le mécanisme de facturation/validation de paiement de Séjoura
dans un package partagé @refontiq/billing (schéma de table, fonctions
RPC de validation/rejet, composants UI de soumission et de validation,
notification Telegram associée).

Généralise-le pour supporter deux modes de calcul de montant :
1. Mode "abonnement à palier" (le mode actuel de Séjoura : un montant
   fixe par plan tarifaire).
2. Mode "événementiel" (le montant s'accumule par événement métier,
   ex. 1000 FCFA par inscription confirmée pour Schooly) — ajoute une
   table platform_fee_ledger qui enregistre chaque événement facturable,
   agrégée périodiquement dans une facture consolidée.

Le mécanisme de collecte (lien Wave + soumission + validation manuelle
+ alerte Telegram) reste identique dans les deux modes.

Réintègre ce package dans Séjoura à la place du code dupliqué, sans
changer son comportement actuel pour les utilisateurs.
```
**Critères d'acceptation** :
- Séjoura fonctionne à l'identique après avoir migré vers le package partagé.
- Le mode "événementiel" est testé avec des données factices (simuler des inscriptions Schooly).
- Le package est documenté avec un exemple d'intégration pour un nouveau produit.

---

## SCHOOLY — Développement

### Tâche S.0 — Kickoff
**Repo** : Schooly (nouveau projet)
**Prompt** :
```
Lis intégralement le fichier docs/product/cahier-des-charges-schooly.md
du repo. Confirme ta compréhension des principes directeurs (section 2),
du stack recommandé (section 3) et de la roadmap par phases (section 10).

Utilise le package @refontiq/billing (voir refontiq-architecture-ecosysteme.md,
section 6.2) pour la facturation SaaS plutôt que de recoder un mécanisme
propre — mode "événementiel", 1000 FCFA par inscription confirmée.

Utilise le système d'alertes Telegram partagé pour toute notification
interne destinée à l'équipe Schooly (nouvelle école inscrite, anomalie
financière détectée, etc.).

Démarre le développement par la Phase 0 (Fondations techniques) de la
roadmap. Ne passe à la Phase 1 qu'une fois les critères d'acceptation
de la Phase 0 vérifiés.
```
**Critères d'acceptation** : voir critères d'acceptation de chaque phase dans cahier-des-charges-schooly.md, section 10.

### Tâches S.1 à S.13 — Phases 1 à 13
Utiliser à chaque nouvelle session le même gabarit de prompt :
```
Nous sommes à la Phase [N] de cahier-des-charges-schooly.md.
Vérifie d'abord que les critères d'acceptation de la Phase [N-1]
sont bien remplis. Si oui, développe les livrables de la Phase [N]
tels que décrits, en respectant les principes directeurs (section 2)
et la Definition of Done (section 13) pour chaque module livré.
```

### Tâche S.14 — Resynchronisation avec les documents d'écosystème
**Contexte** : le développement de Schooly a démarré avant la création de `refontiq-architecture-ecosysteme.md` et `refontiq-plan-de-travail-prompts.md`. Un audit est nécessaire avant de reprendre, en particulier pour la Phase 10 (Trouvetou) et tout ce qui touche à la facturation (Phase 4/§14).

**Prompt** :
```
Avant de poursuivre le développement de Schooly, prends connaissance des
documents suivants, créés après le démarrage du projet :
- refontiq-architecture-ecosysteme.md
- refontiq-plan-de-travail-prompts.md

Ils introduisent des composants partagés à l'échelle de tout l'écosystème
Refontiq (pas seulement Schooly) :
- @refontiq/billing : moteur de facturation mutualisé, qui doit remplacer
  la logique propre décrite à l'origine dans la section 14 du cahier des
  charges Schooly.
- Le contrat "Trouvetou Connector" étendu (photos 360°, itinéraire,
  grille tarifaire publique) pour la Phase 10.
- Les alertes internes via bot Telegram comme canal standard.

Fais un audit de ce qui a déjà été développé dans les phases précédentes
(en particulier la Phase 4 - Finance) et identifie les écarts avec ces
nouveaux standards partagés. Produis un rapport ECART-COHERENCE.md listant :
1. Ce qui a déjà été codé et devra être migré vers @refontiq/billing une
   fois ce package extrait de Séjoura (non fait à ce jour).
2. Ce qui peut être développé dès maintenant en suivant strictement le
   schéma documenté dans refontiq-architecture-ecosysteme.md section 6.2,
   pour rester facilement migrable.
3. Pour la Phase 10 (actuellement sautée) : confirme qu'elle peut être
   traitée après la Phase 11 en cours sans dépendance bloquante, ou
   signale le contraire.

Ne modifie aucun code avant validation de ce rapport.
```
**Critères d'acceptation** : le rapport ECART-COHERENCE.md existe, liste concrètement les écarts, et aucune modification de code n'a été faite sans validation préalable.

---

## DOCLY — Migration puis développement

### Tâche D.0 — Migration vers Next.js
**Repo** : Docly
**Contexte** : Docly est actuellement en HTML/JS vanilla avec Supabase et un Service Worker (PWA). Décision prise : aligner sur Next.js.

**Prompt** :
```
Migre le projet Docly de sa base actuelle (HTML/JS vanilla, Supabase,
Service Worker) vers Next.js (App Router) + TypeScript + Tailwind,
en conservant :
1. Le schéma et les données de la base Supabase existante à l'identique
   (ne pas casser les migrations déjà en place).
2. Les capacités PWA (manifest.json, service worker) — les recréer
   avec l'approche Next.js PWA plutôt que de les perdre.
3. Toutes les fonctionnalités déjà présentes dans les pages HTML
   actuelles (à recenser d'abord avant de commencer la migration).

Documente dans MIGRATION-NEXTJS.md la liste des pages migrées, les
éventuelles fonctionnalités temporairement non portées, et pourquoi.

Une fois la migration technique terminée, applique la checklist
"Refontiq-ready" (refontiq-architecture-ecosysteme.md, section 10) :
stack alignée, alertes Telegram, préparation à l'intégration du
Trouvetou Connector.
```
**Critères d'acceptation** :
- Aucune perte de données Supabase.
- Toutes les fonctionnalités recensées avant migration sont présentes après.
- Le projet suit les mêmes conventions que Séjoura/Schooly (structure de dossiers, TypeScript strict, Tailwind).

### Tâche D.1 — Cahier des charges métier Docly
Ce document n'existe pas encore : les règles métier spécifiques aux cliniques (dossiers patients, rendez-vous, facturation d'actes médicaux, confidentialité renforcée des données de santé) doivent être définies avec toi avant de lancer le développement fonctionnel, sur le même modèle que celui construit pour Schooly. À faire dans un prochain échange dédié.

---

## TROUVETOU — Autonomie & multi-catégories

### Tâche T.1 — Implémenter le contrat Trouvetou Connector (lecture)
**Repo** : Trouvetou (post-découplage, tâche 0.1)
**Prompt** :
```
Implémente côté Trouvetou la consommation du contrat "Trouvetou
Connector" décrit dans refontiq-architecture-ecosysteme.md, section 3.1.
Trouvetou doit pouvoir interroger n'importe quel SaaS partenaire
(Séjoura aujourd'hui, Schooly et Docly demain) via l'endpoint standard
GET /api/v1/public/{categorie}/{id}/availability et agréger les
résultats dans son moteur de recherche, quel que soit le SaaS
d'origine.
```

### Tâche T.2 — Implémenter le contrat Trouvetou Connector (écriture)
**Prompt** :
```
Implémente côté Trouvetou l'envoi de demandes vers les SaaS partenaires
via POST /api/v1/public/{categorie}/{id}/request (section 3.2 du
document d'architecture), pour les 3 catégories prévues : écoles,
hébergements, cliniques.
```

### Tâche T.3 — Recherche multi-catégories réelle
**Prompt** :
```
Étends l'interface de recherche de Trouvetou pour supporter les 3
catégories (écoles, hébergements, cliniques) avec un filtre de
catégorie explicite et une recherche géolocalisée commune aux trois.
```

---

## SÉJOURA — Adaptation post-extraction

### Tâche SJ.1 — Exposer le connecteur Trouvetou côté Séjoura
**Prompt** :
```
Implémente côté Séjoura la partie "fournisseur" du contrat Trouvetou
Connector (section 3 du document d'architecture) : expose les annonces
de résidences/hôtels au format standard, et un endpoint de réception
des demandes de réservation initiées depuis Trouvetou.
```

### Tâche SJ.2 — Nettoyage post-extraction
**Prompt** :
```
Une fois les tâches 0.1, 0.2 et 0.3 terminées, supprime de Séjoura
tout le code désormais redondant (logique Trouvetou, hub multi-produits,
code de facturation dupliqué avec @refontiq/billing). Vérifie
qu'aucune régression n'apparaît sur les fonctionnalités propres à
Séjoura.
```

---

## REFONTIQ.COM — Mises à jour

### Tâche R.1 — Mise à jour du catalogue au fil de l'avancement
**Prompt (à réutiliser à chaque produit qui passe en production)** :
```
Ajoute/mets à jour l'entrée du produit [NOM] dans src/lib/saas.ts
(slug, nom, tagline, audience, description, features, signupUrl,
statut "live"), en suivant le format déjà utilisé pour les produits
existants.
```

---

## Notes de suivi
- Ce document doit être mis à jour au fil de l'avancement : cocher/archiver les tâches terminées plutôt que les laisser en l'état indéfiniment.
- Toute nouvelle tâche transverse découverte en cours de route doit être ajoutée en Priorité 0 si elle bloque plusieurs projets, ou dans la section du projet concerné sinon.
