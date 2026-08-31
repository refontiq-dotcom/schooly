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
supabase/schema.sql   # tables, fonctions, RLS
supabase/seed.sql      # données de démonstration (optionnel)
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
- `/dashboard/professeur` — cartes par niveau → sections
- `/dashboard/professeur/classe/[id]` — présences & notes
- `/dashboard/secretariat` — réservations à finaliser
- `/dashboard/secretariat/scan` — vérification QR code + finalisation
- `/dashboard/parent` — suivi de l'enfant

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
policies Row Level Security de `supabase/schema.sql` :
- Un **parent** ne voit que les données de son/ses enfant(s).
- Un **professeur** ne voit/modifie que les sections qui lui sont affectées
  (table `teacher_assignments`).
- Un **administrateur** gère les niveaux/sections de son propre établissement.

⚠️ En v1, les dashboards affichent le premier établissement/élève trouvé à des
fins de démonstration. Avant mise en production, brancher l'authentification
Supabase (`supabase.auth`) et filtrer chaque requête par
`profiles.establishment_id` / `auth.uid()` réel de l'utilisateur connecté.

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
- **Authentification complète par rôle** et écrans de connexion/inscription.

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
│   │   └── api/reservations/                 # endpoints réservation
│   ├── lib/supabase/        # clients Supabase (browser/server/admin)
│   └── types/                # types TypeScript partagés
└── README.md
```

## Licence

Propriété de Refontiq. Usage interne / démonstration client.
