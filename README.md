# Schooly v2

SaaS de gestion d'établissements scolaires : classes, élèves, paiements,
documents, internat et communication avec les parents. Les établissements
publiés sont exposés à **Trouvetou** (plateforme publique de découverte) via
une API partenaire. Développé par **Refontiq** (Abidjan, Côte d'Ivoire).

## Rôles

| Rôle | Accès | Création de compte |
|---|---|---|
| `parent` | Suivi de ses enfants | Connexion par téléphone uniquement (numéro présent dans `students.parent_phone`) |
| `admin` | Configuration complète de l'établissement | Devient admin en créant un établissement ou sur invitation |
| `professeur`, `secretariat`, `censeur` | Espaces dédiés | Uniquement sur invitation d'un administrateur |

Règle absolue : **un parent ne se connecte que si son numéro correspond à un
enfant inscrit**. Pas d'inscription libre, pas de rôle staff auto-attribué.

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | Next.js 16 (App Router) / React 19 / Tailwind CSS |
| Backend & base | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Proxy (middleware) | `src/proxy.ts` (convention Next.js 16) |
| Tests unitaires | Vitest (jsdom) |
| Tests E2E | Playwright |

## Structure

```
src/
├── app/
│   ├── (public)/auth/          # connexion parent (OTP téléphone)
│   ├── dashboard/              # accueil dashboard (rôle-aware)
│   └── page.tsx                # landing
├── components/                 # composants React
├── lib/
│   ├── auth/                   # rôles, permissions par chemin
│   ├── supabase/               # clients browser / server / admin
│   └── test/                   # setup vitest
├── proxy.ts                    # garde auth + rôles sur /dashboard
└── types/                      # types TypeScript partagés
supabase/
├── schema.sql                  # schéma de base (tables, fonctions, RLS)
├── seed.sql                    # données de démonstration
└── config.toml                 # config CLI Supabase
e2e/tests/                      # tests Playwright
```

## Démarrage rapide

### 1. Environnement

```bash
cp .env.example .env.local   # renseigner les clés Supabase
npm install
```

### 2. Supabase local (optionnel, pour développer)

```bash
supabase start               # Postgres + Auth sur 127.0.0.1:54321
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/schema.sql     # schéma de base
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/seed.sql       # données de démo
```

Ou avec un projet Supabase hébergé : exécuter `supabase/schema.sql` puis
`supabase/seed.sql` dans le **SQL Editor**.

### 3. Lancer et vérifier

```bash
npm run dev                  # http://localhost:3000
npx tsc --noEmit             # typecheck (bloquant avant toute PR)
npm run lint                 # ESLint
npm run test:run             # tests unitaires
npm run test:e2e             # tests Playwright (nécessite npm run dev)
```

## Conventions

- **Migrations idempotentes** : `IF NOT EXISTS` / `DROP IF EXISTS` partout.
- **Sécurité** : RLS activée sur toutes les tables ; les changements de rôle
  passent uniquement par des fonctions `security definer` ; le trigger
  `enforce_profiles_guard` bloque toute écriture directe de `role`,
  `establishment_id` ou `email`.
- **Anti-survente** : la réservation d'une place passe par
  `confirm_reservation()` (UPDATE atomique sur `levels.reserved_count`).
- **Proxy unique** : toute logique de routage/autorisation de requête vit dans
  `src/proxy.ts` (Next.js 16 a renommé `middleware.ts` en `proxy.ts`).

## Interdits produit (à préserver)

- Ne jamais permettre l'inscription libre d'un parent (email/mot de passe).
- Ne jamais exposer l'écriture de `published_to_trouvetou` au client.
- Ne jamais autoriser `/api/trouvetou/*` sans la clé Bearer.
- Ne jamais permettre à un parent de créer un établissement ni de devenir
  admin sans passer par une fonction `security definer` vérifiée.

## Licence

Propriété de Refontiq. Usage interne / démonstration client.
