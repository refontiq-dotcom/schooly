# AGENTS.md — Schooly v2

Guide de contribution pour les agents travaillant sur Schooly v2.

## Environnement

- **Framework** : Next.js 16 (React 19) + TypeScript strict
- **Base de données** : Supabase (PostgreSQL, Auth, RLS)
- **Tests unitaires** : Vitest (jsdom)
- **Tests E2E** : Playwright
- **Lint** : ESLint 9 (flat config via `eslint.config.mjs`)

## Commandes de vérification

```bash
# Typecheck (bloquant — à lancer avant toute PR)
npx tsc --noEmit

# Lint
npm run lint

# Tests unitaires
npm run test:run

# Tests E2E (nécessite un serveur dev ou supabase local)
npm run test:e2e
```

### Supabase local

```bash
supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/schema.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.sql
```

## Structure du projet

```
src/
├── app/            # App Router (pages publiques, auth, dashboards)
├── components/     # composants React
├── lib/            # clients supabase, rôles, logique métier
├── proxy.ts        # middleware Next.js 16 (garde auth + rôles)
└── types/          # types TypeScript partagés
supabase/
├── schema.sql      # schéma de base (idempotent)
└── seed.sql        # données de démonstration
e2e/tests/          # tests Playwright
```

## Conventions

- **Idempotence** : toutes les migrations SQL utilisent `IF NOT EXISTS` / `DROP IF EXISTS`.
- **Sécurité** : RLS activée partout ; les fonctions métier sont `security definer` ;
  le trigger `enforce_profiles_guard` protège `role`, `establishment_id`, `email`.
- **Anti-survente** : toute réservation de place passe par `confirm_reservation()`.
- **Proxy unique** : la logique de requête globale vit dans `src/proxy.ts`.
- **Pas de comments inutiles dans le code**.
- **Règle produit** : un parent ne se connecte que si son numéro existe dans
  `students.parent_phone` — jamais d'inscription libre.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
