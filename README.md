# Schooly

Plateforme de réservation de place scolaire et de gestion d'établissement,
connectée à **Trouvetou**. Développé par **Refontiq** (Abidjan, Côte d'Ivoire).

## Intégration Trouvetou

Un administrateur peut publier ou retirer son établissement depuis son dashboard.
Les établissements non publiés ne sont jamais retournés par l'API partenaire.

L'API est protégée par `TROUVETOU_API_KEY_PEPPER` et attend l'en-tête
`Authorization: Bearer <clé>` :

```text
GET  /api/trouvetou   # établissements publiés dans la catégorie "ecoles" + places
POST /api/trouvetou   # crée une réservation en attente de paiement
POST /api/trouvetou/reservations/:id/payment # confirme le paiement et la place
```

Le premier `POST` attend `establishment_id`, `level_id`, `student_full_name`,
`parent_full_name` et `parent_phone`, avec `student_birthdate` et
`parent_email` facultatifs. Il retourne un dossier `pending_payment`.
Après paiement confirmé par Trouvetou, le second `POST` attend `payment_reference`
et `amount_paid`. Schooly réserve alors la place de manière atomique et retourne
le QR code. La réponse est `409` lorsqu'il n'y a plus de place.

Ce dépôt contient la **version 1 (MVP)** telle que définie dans le cahier des
charges — Phase 1 :

- Fiche établissement publique (recherche, disponibilité en temps réel, visite 360°, itinéraire)
- Gestion des quotas par niveau/section avec décrémentation **atomique** (anti-survente)
- Parcours de réservation en ligne avec génération de **QR code** d'authenticité
- Libération automatique des places non finalisées (**anti no-show**)
- Dashboard **Administrateur** (configuration classes & quotas)
- Dashboard **Professeur** (présences, notes, par section)
- Dashboard **Secrétariat** (vérification QR code, finalisation d'inscription)
- Dashboard **Parent** (suivi de l'enfant : présence, notes)

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | Next.js 16 / React 19 / Tailwind CSS |
| Backend & base de données | Supabase (PostgreSQL, Auth, Storage, RLS) |
| QR code | `qrcode` (génération), scan manuel en v1 |
| Automatisation notifications | n8n + WhatsApp Business API *(Phase 2)* |

## Démarrage rapide

### 1. Créer un projet Supabase
Sur [supabase.com](https://supabase.com), créez un projet, puis dans
**SQL Editor**, exécutez dans l'ordre :

```bash
supabase/schema.sql                                  # tables, fonctions, RLS (base + school_type)
supabase/migration-operations.sql                    # rentrée, paiements, documents, messages
supabase/migrations/20260902180000_internat_module.sql  # module internat
supabase/migrations/20260902190000_trouvetou_integration.sql # publication + API Trouvetou
supabase/migrations/20260902200000_trouvetou_payment_flow.sql # paiement partenaire
supabase/migrations/20260903090000_reservation_intelligence.sql # scoring parent + anti-fraude + file d'attente + dashboard conversion (voir RESERVATION_INTELLIGENCE.md)
supabase/migrations/20260903100000_payment_intelligence.sql # scoring risque impayé + détection anomalies + réconciliation MM + vues agrégées (voir PAYMENT_INTELLIGENCE.md)
supabase/migrations/20260903110000_teacher_intelligence.sql # agrégats classe + détection décrochage + prédiction moyenne + saisie en lot (voir TEACHER_INTELLIGENCE.md)
supabase/migrations/20260903120000_parent_intelligence.sql # synthèse 360° par enfant + alertes + score satisfaction + résumé WhatsApp (voir PARENT_INTELLIGENCE.md)
supabase/migrations/20260903130000_internat_intelligence.sql # dashboard temps réel + élèves à risque + santé + rotation lits + tendances occupation (voir INTERNAT_INTELLIGENCE.md)
supabase/migrations/20260903140000_classes_intelligence.sql # taux de remplissage sections + alertes déséquilibre + charge profs + suggestion section (voir CLASSES_INTELLIGENCE.md)
supabase/migrations/20260903150000_teacher_intelligence_v2.sql # vue par prof (workload + homeroom + élèves à risque + comparatif + retards de saisie) (voir TEACHER_INTELLIGENCE_V2.md)
supabase/migrations/20260903160000_secretariat_intelligence.sql # agrégat actions du jour + complétude dossiers + file QR + finalisation atomique (voir SECRETARIAT_INTELLIGENCE.md)
supabase/migrations/20260903170000_trouvetou_intelligence.sql # catalogue public + performance par établissement + pubs + entonnoir conversion (voir TROUVETOU_INTELLIGENCE.md)
supabase/migrations/20260903180000_messages_intelligence.sql # non-lus + activité + threads + engagement + urgents non répondus + mark read bulk (voir MESSAGES_INTELLIGENCE.md)
supabase/migrations/20260903190000_team_intelligence.sql # effectif par rôle + inactifs + stats staffing + engagement parents + export JSON (voir TEAM_INTELLIGENCE.md)
supabase/migrations/20260903200000_onboarding_intelligence.sql # état onboarding (10 étapes) + établissements incomplets + agrégat par type + création atomique (voir ONBOARDING_INTELLIGENCE.md)
supabase/fix-grants-and-rls.sql                      # correctifs grants + RLS profiles (anti-récursion)
supabase/seed.sql                                    # données de démonstration (optionnel)
```

> Alternative : `supabase/apply-batch-2.sql` regroupe school_type + internat +
> opérations en un seul script idempotent (utile pour migrer une base existante
> qui n'a que `schema.sql` v1).

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env.local
# Renseignez NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY depuis Project Settings > API sur Supabase,
# et TROUVETOU_API_KEY_PEPPER avec la même valeur configurée dans Trouvetou.
```

### 3. Installer et lancer

```bash
npm install
npm run dev
```

L'application est disponible sur `http://localhost:3000`.

- `/` — recherche d'établissements (vitrine Trouvetou)
- `/etablissement/[id]` — fiche établissement + réservation
- `/dashboard/admin` — espace direction (config classes/quotas)
- `/dashboard/admin/classes` — gestion des niveaux, sections, capacités
- `/dashboard/admin/equipe` — invitations du personnel
- `/onboarding/etablissement` — création d'établissement (passe le compte en admin)
- `/auth/invitation?token=…` — acceptation d'une invitation staff
- `/dashboard/professeur` — cartes par niveau → sections
- `/dashboard/professeur/classe/[id]` — présences & notes
- `/dashboard/secretariat` — réservations à finaliser
- `/dashboard/secretariat/scan` — vérification QR code + finalisation
- `/dashboard/parent` — suivi de l'enfant (notes, absences, alertes)
- `/dashboard/parent/rentree` — listes de fournitures et estimation des coûts
- `/dashboard/parent/paiements` — Mobile Money, échéanciers, restes à payer
- `/dashboard/parent/documents` — checklist (acte de naissance, dossiers d'examen)
- `/dashboard/parent/messages` — messagerie école ↔ parents
- `/dashboard/admin/paiements` — catalogue de frais et confirmation des paiements
- `/dashboard/admin/rentree` — publication des listes de rentrée
- `/dashboard/admin/documents` — validation des pièces administratives
- `/dashboard/admin/messages` — communication avec les parents

## Logique métier clé : anti-survente

La fonction Postgres `reserve_seat(reservation_id)` (voir `supabase/schema.sql`)
verrouille la ligne de la section concernée (`FOR UPDATE`) avant de vérifier et
décrémenter le quota. Cela garantit qu'en cas de deux réservations simultanées
sur la dernière place disponible, une seule aboutit — l'autre est rejetée
proprement avec un message d'erreur explicite.

La fonction `release_expired_reservations()` doit être appelée périodiquement
(cron Supabase `pg_cron` ou workflow n8n) pour libérer automatiquement les
places des réservations non finalisées dans le délai imparti
(`reservation_hold_hours`, paramétrable par établissement).

## Rôles et sécurité (RLS)

L'accès aux données est cloisonné par établissement et par rôle via les
policies Row Level Security de `supabase/schema.sql`, plus un contrôle de
route dans `src/middleware.ts` :

- L'inscription publique crée **toujours** un profil `parent` (trigger
  `handle_new_user` sur `auth.users`). Le rôle choisi dans le formulaire
  n'est plus un levier : il n'y a plus de sélecteur « Administrateur ».
- Un **parent** ne voit que les données de son/ses enfant(s)
  (`students.parent_id`). Le rattachement se fait à la finalisation
  d'inscription (email ou téléphone) via `finalize_reservation()`, et au
  login via `link_parent_to_students()`.
- Un **administrateur** s'obtient uniquement en créant un établissement
  (`create_establishment_as_admin`) depuis `/onboarding/etablissement`.
- **Professeur / secrétariat / censeur / admin supplémentaire** : invitation
  par un admin (`staff_invitations`) puis acceptation sur
  `/auth/invitation?token=…`. Un trigger empêche de modifier `role` /
  `establishment_id` / `email` depuis le client.
- Un **professeur** ne voit/modifie que les sections qui lui sont affectées
  (table `teacher_assignments`).
- Le middleware redirige tout utilisateur connecté dont le rôle ne
  correspond pas à la route (`/dashboard/admin` inaccessible aux parents).

## Ce qui n'est PAS encore dans la v1 (roadmap)

Voir le cahier des charges complet pour le détail des phases. Non couvert ici :

- **Paiement en ligne réel** (mobile money / carte) — le flux actuel simule la
  confirmation de paiement (`/api/reservations/[id]/confirm`) pour permettre de
  tester le décrément de quota. À brancher sur un agrégateur (Wave, Orange
  Money, CinetPay...).
- **Scan caméra du QR code** — v1 utilise une saisie manuelle du token ; prévoir
  une librairie de scan (ex. `html5-qrcode`) en Phase 2.
- **Envoi automatique WhatsApp** — voir `automation/n8n-weekly-whatsapp-summary.README.md`
  pour le guide de construction du workflow n8n.
- **Visite virtuelle 360°** hébergée en propre (v1 se contente d'un lien externe).
- **Indicateurs d'alerte intelligents** (élèves/professeurs) — Phase 3.
- **Envoi d'email d'invitation** — v1 affiche le lien à copier dans
  `/dashboard/admin/equipe` ; brancher un provider (Resend, n8n) en Phase 2.

## Structure du projet

```
schooly/
├── supabase/
│   ├── schema.sql          # tables, fonctions, RLS
│   └── seed.sql            # données de démonstration
├── automation/
│   └── n8n-weekly-whatsapp-summary.README.md
├── src/
│   ├── app/
│   │   ├── page.tsx                          # recherche d'établissements
│   │   ├── etablissement/[id]/               # fiche + réservation
│   │   ├── reservation/confirmation/[id]/    # paiement + QR code
│   │   ├── dashboard/
│   │   │   ├── admin/                        # config classes & quotas
│   │   │   ├── professeur/                   # présences & notes
│   │   │   ├── secretariat/                  # scan QR + finalisation
│   │   │   └── parent/                       # suivi enfant
│   │   ├── auth/                             # connexion / inscription parent / invitation
│   │   ├── onboarding/etablissement/         # création d'établissement → rôle admin
│   │   └── api/reservations/                 # endpoints réservation
│   ├── lib/auth/             # actions, rôles, session + sync profiles
│   ├── lib/supabase/         # clients Supabase (browser/server/admin)
│   └── types/                # types TypeScript partagés
└── README.md
```

## Licence

Propriété de Refontiq. Usage interne / démonstration client.
