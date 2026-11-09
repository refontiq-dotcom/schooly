# Intégration Schooly ↔ Trouvetou

## 1. Objectif du projet

Schooly est la source de vérité pour les établissements scolaires, les niveaux,
les capacités et les réservations. Trouvetou est la plateforme qui présente des
établissements de plusieurs catégories.

Pour les écoles :

- l'administrateur Schooly choisit volontairement de publier son établissement ;
- Trouvetou affiche l'établissement dans sa catégorie `ecoles` ;
- l'utilisateur consulte la fiche, les informations, la photo, la localisation,
  l'itinéraire et les places disponibles par niveau ;
- l'utilisateur remplit le formulaire de réservation depuis Trouvetou ;
- Trouvetou gère le paiement ;
- Schooly vérifie la place au dernier moment, crée la réservation et protège la
  capacité contre la survente ;
- l'administrateur Schooly reçoit la réservation et confirme l'inscription.

## 2. Fonctionnalité dans Schooly

Le module se trouve dans la sidebar administrateur :

```text
Dashboard admin > Partenaires > Trouvetou
```

Page correspondante :

```text
/dashboard/admin/trouvetou
```

Depuis cette page, l'administrateur peut :

- activer ou désactiver la publication de son établissement ;
- vérifier le nom, la ville et la catégorie publiée ;
- créer une publicité optionnelle ;
- renseigner le titre, le message, l'URL d'une photo, l'URL de destination,
  une date de début et une date de fin ;
- voir ses publicités créées et leur état.

La publication est désactivée par défaut. Un établissement non publié n'est pas
retourné par l'API Trouvetou.

## 3. Parcours utilisateur sur Trouvetou

1. Trouvetou demande à Schooly le catalogue des écoles publiées.
2. L'utilisateur recherche une école ou consulte la catégorie `ecoles`.
3. Il ouvre la fiche de l'école et voit ses détails, sa photo si elle est
   renseignée, son adresse et son itinéraire, notamment avec ses coordonnées
   GPS, ainsi que ses niveaux et places disponibles.
4. Il choisit un niveau et remplit le formulaire avec le nom de l'élève, le nom
   du parent et son téléphone. La date de naissance et l'email sont facultatifs.
5. Trouvetou appelle Schooly. Schooly crée un dossier `pending_payment`.
6. L'utilisateur paie les frais de réservation dans Trouvetou.
7. Trouvetou confirme le paiement à Schooly.
8. Schooly réserve atomiquement une place dans une section du niveau choisi.
9. La réservation devient `reserved` et un délai d'expiration est appliqué.
10. L'administrateur voit la réservation dans son dashboard Schooly.
11. Il clique sur **Confirmer**. Schooly crée l'élève et passe la réservation à
    `confirmed`.
12. Le QR code de réservation peut ensuite être présenté à l'établissement pour
    finaliser l'inscription sur place.

## 4. Contrat API Schooly pour Trouvetou

Les appels serveur-à-serveur de réservation utilisent le secret dédié :

```http
x-trouvetou-booking-secret: <TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET>
```

Le pepper HMAC `TROUVETOU_API_KEY_PEPPER` n'est jamais accepté comme jeton et ne doit jamais être transmis à Schooly.

URL de base en production : `https://<domaine-schooly>/api/v1/public`.

### 4.1 Catalogue des écoles

```http
GET /ecoles
x-trouvetou-booking-secret: <secret>
```

Retourne les établissements publiés avec leur catégorie, leurs informations publiques et leurs médias.

### 4.2 Disponibilité par niveau

```http
GET /schools/{school_id}/availability
```

Cette route publique en lecture seule retourne les niveaux, capacités, inscriptions confirmées et places encore disponibles. La disponibilité doit être revalidée au moment de la demande et de la confirmation du paiement.

### 4.3 Création d'une demande de réservation

```http
POST /ecoles/{school_id}/request
x-trouvetou-booking-secret: <secret>
Content-Type: application/json
```

Corps attendu :

```json
{
  "level_id": "uuid",
  "student_full_name": "Nom de l'élève",
  "student_birthdate": "2018-04-12",
  "parent_full_name": "Nom du parent",
  "parent_phone": "+225...",
  "parent_email": "parent@example.com"
}
```

Schooly vérifie la publication de l'école et l'appartenance du niveau, puis crée une demande `pending_payment`. Cette étape ne réserve pas encore la capacité.

### 4.4 Confirmation après paiement

Uniquement après confirmation serveur du paiement :

```http
POST /ecoles/{school_id}/reserve
x-trouvetou-booking-secret: <secret>
Content-Type: application/json
```

```json
{
  "reservation_id": "uuid",
  "payment_reference": "reference-fournisseur",
  "amount": 25000
}
```

Schooly appelle `reserve_seat()`, verrouille la section et réserve atomiquement une place. Une réservation déjà traitée répond `409`.

## 5. Confirmation par l'administrateur

Les réservations apparaissent dans le dashboard admin, dans le bloc **Dernières
réservations**. Une réservation au statut `reserved` possède le bouton
**Confirmer**.

Cette action appelle la fonction Supabase :

```text
finalize_reservation(reservation_id)
```

La fonction :

- vérifie que l'utilisateur est admin, secrétariat ou censeur ;
- vérifie que la réservation appartient à son établissement ;
- crée la ligne dans `students` ;
- rattache automatiquement le parent lorsqu'un email ou téléphone correspond ;
- passe la réservation à `confirmed`.

## 6. Données et migrations Supabase

Les migrations doivent être exécutées dans le projet **Supabase de Schooly**,
pas dans Trouvetou, dans cet ordre après le schéma de base :

```text
supabase/migrations/20260902190000_trouvetou_integration.sql
supabase/migrations/20260902200000_trouvetou_payment_flow.sql
supabase/migrations/20260902210000_trouvetou_ads.sql
```

Rôle de chaque migration :

- `20260902190000` ajoute `establishments.published_to_trouvetou` et la fonction
  de création de réservation partenaire ;
- `20260902200000` remplace cette fonction pour créer `pending_payment`, afin
  que la capacité ne soit réservée qu'après paiement ;
- `20260902210000` crée `trouvetou_ads`, ses index, ses grants et sa policy RLS.

Important : la migration `20260902200000` doit être exécutée après
`20260902190000`, car elle met à jour la même fonction SQL.

## 7. Variables d'environnement

Dans Schooly, configurer côté serveur :

```env
TROUVETOU_API_KEY=<clé provider tv_live_... pour la synchronisation>
TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET=<secret dédié aux appels de réservation>
TROUVETOU_SYNC_URL=https://trouvetou.vercel.app
TROUVETOU_INSTANCE_URL=https://admin.schooly.ci
```

La valeur de `TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET` doit correspondre à la variable `TROUVETOU_BOOKING_SECRET_SCHOOLY` dans Trouvetou. Ce secret est transmis uniquement dans l'en-tête `x-trouvetou-booking-secret`.

`TROUVETOU_API_KEY_PEPPER` appartient exclusivement à l'environnement serveur Trouvetou pour vérifier les empreintes HMAC. Il ne doit pas être configuré comme jeton partenaire ni envoyé à Schooly.

Autres variables nécessaires à Schooly :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

La clé Supabase secrète reste exclusivement côté serveur Schooly et n'est jamais transmise à Trouvetou.

## 8. Fichiers importants

```text
src/app/dashboard/admin/layout.tsx
  Entrée Trouvetou dans la sidebar Partenaires.

src/app/dashboard/admin/trouvetou/page.tsx
  Module admin de publication et de publicité.

src/app/dashboard/admin/_ops-forms.tsx
  Toggle de publication, formulaire de publicité et confirmation admin.

src/lib/operations/actions.ts
  Actions serveur de publication, publicité et confirmation d'inscription.

apps/schooly/src/app/api/v1/public/ecoles/route.ts
  Catalogue des établissements publiés (authentification partenaire).

apps/schooly/src/app/api/v1/public/schools/[id]/availability/route.ts
  Disponibilité publique par niveau.

apps/schooly/src/app/api/v1/public/ecoles/[id]/request/route.ts
  Création d'une demande pending_payment.

apps/schooly/src/app/api/v1/public/ecoles/[id]/reserve/route.ts
  Confirmation post-paiement et réservation atomique de la place.

supabase/migrations/20260902190000_trouvetou_integration.sql
  Publication et première fonction de réservation partenaire.

supabase/migrations/20260902200000_trouvetou_payment_flow.sql
  Version finale du flux pending_payment puis reserved.

supabase/migrations/20260902210000_trouvetou_ads.sql
  Publicités Trouvetou.
```

## 9. Points à terminer ou améliorer

- Connecter réellement le module de paiement Trouvetou au callback
  `/api/trouvetou/reservations/<id>/payment`.
- Ajouter un mécanisme de signature ou d'idempotence des callbacks de paiement,
  en complément de la clé Bearer.
- Ajouter une interface Schooly pour modifier directement la fiche publiée et
  téléverser une photo, au lieu de dépendre de `cover_image_url` déjà enregistré.
- Ajouter l'édition, la désactivation et la suppression des publicités.
- Configurer un cron Supabase ou un workflow n8n pour appeler
  `release_expired_reservations()`.
- Ajouter des tests d'intégration avec une base Supabase de test pour vérifier
  les migrations, le RLS et les courses concurrentes.
- Aligner les noms de champs avec le contrat définitif du dépôt Trouvetou dès
  que ce dépôt sera accessible.

## 10. Vérification locale

Depuis la racine de Schooly :

```bash
npx tsc --noEmit
npm run test:run
npm run build
```

## 11. Connecteur écosystème Refontiq (Étape 10) — Schooly → Trouvetou

> Implémenté en mars-période actuelle. Mécanisme aligné sur le connecteur
> Séjoura → Trouvetou : **push HTTP** depuis le produit vers l'API publique de
> Trouvetou, avec la clé API du provider (`tv_live_`). Aucun accès direct à la
> base Supabase de Trouvetou depuis Schooly.

### 11.1 Flux

1. L'admin Schooly publie son école (`published_to_trouvetou = true`) et
   complète la fiche publique (description, itinéraire, photos 360,
   `video_url` YouTube, grille tarifaire).
2. `npm run trouvetou:sync` lit toutes les écoles publiées + leurs niveaux
   (capacités, prix, places) côté Schooly.
3. Pour chaque école, le script envoie `POST {TROUVETOU_SYNC_URL}/api/v1/sync/schooly`
   avec l'en-tête `x-trouvetou-api-key: tv_live_<providerId>.<secret>`.
4. L'endpoint Trouvetou valide la clé (HMAC/pepper + provider actif) puis
   exécute le RPC `schooly_sync_school` (upsert école + niveaux + log).

### 11.2 Côté Trouvetou (nouveau)

- Endpoint : `src/app/api/v1/sync/schooly/route.ts`
  (même mécanisme d'auth que `/api/v1/sync`, payload dédié `{ school, levels }`).
- Base : SQL du connecteur déjà exécuté manuellement
  (`trouvetou-migrations/20260913000000_schooly_connector.sql` : tables
  `schooly_schools`, `schooly_grade_levels`, `schooly_sync_log`, fonction
  `schooly_sync_school`, RLS lecture publique).
- Provider : SQL à exécuter une fois côté Trouvetou
  (`trouvetou-migrations/20260913010000_provider_schooly.sql`) — UPSERT du
  provider `Schooly` + empreinte HMAC de la clé (`admin.schooly.ci` en webhook).

### 11.3 Variables d'environnement Schooly (`.env.local`)

```env
TROUVETOU_SYNC_URL=https://trouvetou.vercel.app   # ou URL complète /api/v1/sync/schooly
TROUVETOU_API_KEY=tv_live_...                     # clé du provider (voir SQL provider)
TROUVETOU_INSTANCE_URL=https://admin.schooly.ci
```

### 11.4 Fichiers (Étape 10)

```text
schooly :
  packages/billing/scripts/sync-trouvetou.mjs   → script push HTTP (npm run trouvetou:sync)
  apps/schooly/src/app/dashboard/admin/trouvetou/page.tsx   → page admin publication
  apps/schooly/src/app/api/v1/admin/trouvetou/*             → API internes (publish, profile…)
  packages/db/supabase/migrations/20260913000000_trouvetou_champs_etendus.sql
  trouvetou-migrations/20260913000000_schooly_connector.sql  → SQL Trouvetou (exécuté)
  trouvetou-migrations/20260913010000_provider_schooly.sql   → SQL provider (à exécuter)

trouvetou :
  src/app/api/v1/sync/schooly/route.ts → endpoint d'ingestion dédié Schooly
```

### 11.5 Points à terminer

- Exécuter `trouvetou-migrations/20260913010000_provider_schooly.sql` côté
  Trouvetou (fournit le provider + la clé attendue par Schooly).
- Vérifier que `TROUVETOU_API_KEY_PEPPER` côté serveur Trouvetou correspond au
  pepper utilisé dans le SQL provider (partagé avec `src/lib/sync/api-key.ts`).
- Publier une école de test et `npm run trouvetou:sync`.

La clé locale doit être présente dans `.env.local`, qui ne doit pas être
commitée. Le dépôt Trouvetou fourni précédemment était inaccessible ; vérifier
son URL et son contrat avant de modifier l'API partenaire.
