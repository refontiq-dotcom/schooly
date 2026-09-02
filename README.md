# Schooly

Plateforme de réservation de place scolaire et de gestion d'établissement,
connectée à **Trouvetou**. Développé par **Refontiq** (Abidjan, Côte d'Ivoire).

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
supabase/schema.sql                 # tables, fonctions, RLS (auth + inscriptions)
supabase/migration-operations.sql   # rentrée, paiements, documents, messages
supabase/seed.sql                   # données de démonstration (optionnel)
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env.local
# Renseignez NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY depuis Project Settings > API sur Supabase.
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
