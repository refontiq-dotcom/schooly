# AGENTS.md — Schooly

Guide de contribution pour les agents Kilo travaillant sur Schooly.

## Environnement

- **Framework** : Next.js 16 (React 19) + TypeScript strict
- **Base de données** : Supabase (PostgreSQL) — local ou hébergé `pprsngmvrkxbzuvghgef`
- **Tests unitaires** : Vitest (jsdom)
- **Tests E2E** : Playwright
- **Lint** : ESLint 9 (flat config via `eslint.config.mjs`)

## Commandes de vérification

```bash
# Typecheck (bloquant — à lancer avant toute PR)
npx tsc --noEmit

# Lint (non bloquant — les warnings existants sont dans du code legacy)
npm run lint

# Tests unitaires
npx vitest run

# Tests E2E (nécessite supabase start + DB seedé)
npx playwright test
```

### E2E — démarrage local

```bash
supabase start                          # démarre Postgres + Auth + Edge runtime locaux
./supabase/setup-local-db.sh            # applique schema + migrations + seed
npm run dev                             # démarre Next.js (lit .env.local)
npx playwright test                     # ouvre Chromium et exécute les tests
```

## Structure du projet

```
supabase/
├── schema.sql              # schéma de base (tables, enums, RLS)
├── migration-*.sql         # migrations de setup (rôles, opérations, grants)
├── migrations/             # migrations d'intelligence (vues + fonctions)
│   ├── *_school_health_intelligence.sql
│   ├── *_auth_active_sessions.sql
│   ├── *_notification_system.sql
│   └── ...
├── seed.sql                # données de démonstration
├── functions/
│   └── schooly-notifications/   # Edge Function d'envoi de notifications
├── config.toml             # config locale Supabase
└── setup-local-db.sh       # applique le schéma complet (dev + CI)

src/
├── lib/
│   ├── school-intelligence/   # miroir TS de school_health_overview
│   ├── auth-health/           # miroir TS de auth_health + sessions
│   ├── *[*-intelligence]/      # modules par domaine
│   └── supabase/
├── app/
│   ├── (public)/              # pages publiques (auth, home)
│   ├── etablissement/[id]/    # fiche école + formulaire réservation
│   ├── reservation/confirmation/[id]/  # page paiement/QR
│   └── dashboard/{admin,parent,professeur,secretariat}/
└── types/

e2e/
├── playwright.config.ts      # configuré en racine du projet
├── global-setup.ts           # seed des données de test
└── tests/
    ├── reservation-flow.spec.ts
    ├── payment-flow.spec.ts
    └── finalization-flow.spec.ts
```

## Conventions

- **Idempotence** : toutes les migrations SQL utilisent `IF NOT EXISTS` / `DROP IF EXISTS`.
- **Sécurité** : les vues accèdent à `auth.users` en lecture seule ; les fonctions métier sont `security definer`.
- **Miroir TS** : chaque module `*-intelligence` possède un miroir TS (`scoring.ts`) + tests vitest.
- **Pas de comments inutiles dans le code**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
