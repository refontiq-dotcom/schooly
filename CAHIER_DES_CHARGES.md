# Cahier des charges — Schooly & Trouvetou

## 1. Vision produit

Schooly est un **SaaS de gestion d'établissements scolaires** : c'est l'outil
interne des écoles (classes, élèves, paiements, documents, internat,
communications).

Trouvetou est une **plateforme publique de découverte** : elle présente les
établissements que chaque école a décidé de publier, et redirige les parents
vers l'inscription (réservation) via une API.

Les deux produits sont **séparés** : Schooly est la source de vérité, Trouvetou
est un canal de publication alimenté par API.

## 2. Rôles et comptes

### 2.1 Rôles

| Rôle | Création de compte | Rattachement |
| --- | --- | --- |
| `parent` | Connexion par téléphone uniquement | Lié à ses enfants via `students.parent_phone` |
| `admin` | Devient admin en créant un établissement (parent sans établissement) ou sur invitation | Rattaché à un seul établissement |
| `professeur`, `secretariat`, `censeur` | Uniquement sur invitation d'un administrateur | Rattaché à l'établissement de l'invitation |

### 2.2 Règle absolue sur la connexion parent

> **Un parent se connecte SEULEMENT si son numéro de téléphone correspond à un
> enfant déjà inscrit dans un établissement.**

- Aucune inscription libre côté parent : pas d'email/mot de passe, pas de
  création de compte autonome.
- Le flux `signInParent` vérifie que le numéro existe dans `students.parent_phone`
  (ou sur un profil parent existant) avant d'envoyer le lien de connexion (OTP).
- Un numéro inconnu ne peut pas créer de compte : l'utilisateur est invité à
  contacter son établissement.
- Aucun parent ne peut créer d'établissement, publier sur Trouvetou, ni
  s'attribuer un rôle staff.

### 2.3 Garde-fous techniques (Supabase)

- Tout nouveau compte auth crée un profil `parent` (`handle_new_user`).
- Le trigger `profiles_guard` interdit à un client de modifier directement
  `role`, `establishment_id` ou `email`.
- Les changements de rôle passent uniquement par des fonctions
  `security definer` vérifiées : `create_establishment_as_admin` (parent sans
  établissement uniquement) et `accept_staff_invitation` (parent uniquement).
- L'accès aux dashboards est contrôlé par rôle dans `src/proxy.ts`
  (`canAccessPath`).

## 3. Création d'un établissement

- Seul un **compte parent sans établissement** peut créer un établissement
  (point d'entrée bootstrap pour un directeur qui démarre son école).
- À la création : le compte devient `admin` et est rattaché au nouvel
  établissement. Les niveaux prédéfinis (par type d'école) et une section par
  défaut sont créés automatiquement.
- Le formulaire de création ne contient **aucune option de publication
  Trouvetou** : la publication est une décision postérieure de l'administrateur.
- Le personnel (professeurs, secrétariat, censeur, autres admins) ne peut pas
  s'inscrire : il est **invité par un administrateur**.

## 4. Publication sur Trouvetou

### 4.1 Principe

> **Trouvetou publie les établissements que chaque administrateur a activés ;
> la publication est pilotée par l'admin, exposée à Trouvetou par API.**

- La publication est **désactivée par défaut** (`published_to_trouvetou = false`).
- Seul **l'administrateur** de l'établissement peut l'activer ou la désactiver,
  depuis son dashboard :
  `Dashboard admin > Partenaires > Trouvetou`
  (`/dashboard/admin/trouvetou`, composant `TrouvetouPublicationToggle`).
- Trouvetou ne lit **jamais** la base Schooly directement : elle consomme
  uniquement l'API partenaire. Un établissement non publié n'est jamais
  retourné par l'API.
- L'administrateur gère aussi sa fiche publique (description, photo, site,
  coordonnées GPS, frais de réservation) et ses publicités depuis la même page.

### 4.2 Contrat API (résumé)

Routes protégées par `Authorization: Bearer <TROUVETOU_API_KEY_PEPPER>` :

| Route | Rôle |
| --- | --- |
| `GET /api/trouvetou` | Catalogue des établissements publiés (infos, disponibilités par niveau, publicités actives) |
| `POST /api/trouvetou` | Création d'un dossier de réservation `pending_payment` (vérifie publication + places) |
| `POST /api/trouvetou/reservations/<id>/payment` | Confirmation du paiement : réserve atomiquement la place (`reserved`) |

Le détail complet du contrat (exemples de réponses, codes d'erreur, flux de
paiement, migrations SQL) est documenté dans
[`TROUVETOU_INTEGRATION.md`](./TROUVETOU_INTEGRATION.md).

## 5. Parcours de bout en bout

1. Un directeur crée son compte (flux établissement) et son établissement → il
   devient administrateur.
2. Il configure l'école, les classes, les frais et son équipe (invitations).
3. S'il le souhaite, il **publie l'école sur Trouvetou** depuis son dashboard.
4. Trouvetou récupère le catalogue via l'API et affiche l'école avec ses places
   disponibles.
5. Un parent réserve une place depuis Trouvetou ; il paie les frais de
   réservation ; la place est réservée atomiquement.
6. L'administrateur confirme l'inscription (`finalize_reservation`) : l'élève
   est créé, le parent est rattaché par email ou téléphone.
7. Le parent se connecte ensuite à Schooly **avec le numéro de téléphone de
   l'enfant inscrit** et suit sa scolarité (notes, présences, paiements,
   documents, messages).

## 6. Interdits (à préserver lors de toute évolution)

- Ne jamais permettre à un parent de créer un établissement depuis le dashboard
  parent ou de devenir admin sans passer par `create_establishment_as_admin`.
- Ne jamais proposer la publication Trouvetou pendant l'inscription ou la
  création d'établissement.
- Ne jamais exposer `published_to_trouvetou` en écriture directe au client
  (RLS : seule la policy admin d'établissement autorise l'UPDATE).
- Ne jamais autoriser l'accès aux routes `/api/trouvetou/*` sans la clé Bearer.
- Ne jamais contourner la connexion parent par téléphone (pas d'inscription
  email/mot de passe pour les parents).
