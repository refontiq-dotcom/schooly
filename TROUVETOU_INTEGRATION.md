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

Toutes les routes partenaires sont protégées par :

```http
Authorization: Bearer <TROUVETOU_API_KEY_PEPPER>
```

URL de base en production :

```text
https://<domaine-schooly>/api/trouvetou
```

### 4.1 Catalogue des écoles

```http
GET /api/trouvetou
Authorization: Bearer <clé>
```

La réponse contient les établissements publiés. Chaque élément contient :

- `category: "ecoles"` ;
- les informations de l'établissement ;
- `availability`, la liste des places par niveau ;
- `advertisements`, les publicités actives dans leur période.

Exemple de forme de réponse :

```json
{
  "establishments": [
    {
      "id": "uuid",
      "name": "École Exemple",
      "description": "Présentation de l'école",
      "city": "Abidjan",
      "address": "Cocody",
      "school_type": "college",
      "latitude": 5.35,
      "longitude": -4.01,
      "website_url": "https://ecole.example",
      "cover_image_url": "https://.../photo.jpg",
      "reservation_fee_amount": 25000,
      "category": "ecoles",
      "availability": [
        {
          "level_id": "uuid",
          "establishment_id": "uuid",
          "level_name": "6ème",
          "total_capacity": 120,
          "total_taken": 80,
          "seats_available": 40
        }
      ],
      "advertisements": []
    }
  ]
}
```

### 4.2 Création d'un dossier de réservation

```http
POST /api/trouvetou
Authorization: Bearer <clé>
Content-Type: application/json
```

Corps minimal :

```json
{
  "establishment_id": "uuid",
  "level_id": "uuid",
  "student_full_name": "Nom de l'élève",
  "parent_full_name": "Nom du parent",
  "parent_phone": "+225..."
}
```

Champs facultatifs : `student_birthdate`, `parent_email`.

Cette route :

- vérifie que l'école est publiée ;
- vérifie que le niveau appartient à l'école ;
- choisit une section qui possède une place ;
- crée une réservation `pending_payment` ;
- ne décrémente pas encore la capacité.

Réponses principales :

- `201` : dossier créé ;
- `400` : données invalides ;
- `401` : clé absente ou invalide ;
- `409` : école non publiée ou aucune place disponible.

### 4.3 Confirmation du paiement

Après confirmation réelle du paiement côté Trouvetou :

```http
POST /api/trouvetou/reservations/<reservation_id>/payment
Authorization: Bearer <clé>
Content-Type: application/json
```

```json
{
  "payment_reference": "transaction-123",
  "amount_paid": 25000
}
```

Schooly appelle la fonction PostgreSQL `reserve_seat`, qui verrouille la section
avant de vérifier et décrémenter la capacité. Deux demandes concurrentes ne
peuvent donc pas prendre la même dernière place.

Réponses principales :

- `200` : réservation payée et statut `reserved` ;
- `400` : paiement incomplet ou réservation invalide ;
- `401` : clé absente ou invalide ;
- `404` : réservation introuvable ;
- `409` : réservation expirée, déjà traitée ou place devenue indisponible.

La réponse contient notamment `id`, `status`, `qr_code_token` et `expires_at`.

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
TROUVETOU_API_KEY_PEPPER=<clé-secrète-partagée>
```

Le code accepte aussi temporairement `TROUVETOU_API_KEY` comme solution de
compatibilité locale, mais le nom recommandé est `TROUVETOU_API_KEY_PEPPER`.

La même clé doit être configurée dans Trouvetou. Elle ne doit jamais être
exposée dans le frontend, dans un fichier commité ou dans une URL.

Autres variables nécessaires à Schooly :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Le client service role est utilisé uniquement côté serveur pour les appels
partenaires et ne doit jamais être envoyé à Trouvetou.

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

src/app/api/trouvetou/route.ts
  Catalogue et création de dossier de réservation.

src/app/api/trouvetou/reservations/[id]/payment/route.ts
  Confirmation du paiement partenaire.

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

La clé locale doit être présente dans `.env.local`, qui ne doit pas être
commitée. Le dépôt Trouvetou fourni précédemment était inaccessible ; vérifier
son URL et son contrat avant de modifier l'API partenaire.
