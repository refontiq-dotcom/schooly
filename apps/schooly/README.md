# Schooly — Web Admin (Direction, Secrétariat, Comptabilité)

Frontend administratif de Schooly, la plateforme SaaS de gestion scolaire multi-établissements (Côte d'Ivoire / Afrique de l'Ouest).

**Stack** : Next.js (App Router), React, TypeScript strict, Tailwind CSS, Supabase (Auth + PostgreSQL + RLS).

## Développement

Depuis la racine du monorepo :

```bash
npm run dev:admin
```

Ou directement :

```bash
cd apps/schooly
npm run dev
```

L'application est accessible sur http://localhost:3000.

## Structure

```
apps/schooly/
├── src/
│   ├── app/          # Routes Next.js App Router (dashboard, inscription, vérification…)
│   ├── components/   # Composants UI (sidebar, etc.)
│   └── lib/          # Utilitaires (clients Supabase, Telegram, etc.)
├── public/           # Assets statiques (logo, icônes)
├── package.json
└── tsconfig.json
```

## Variables d'environnement

Copier `.env.example` (racine du repo) en `.env.local` et renseigner les clés Supabase et intégrations. Voir `docs/deployment/` pour la checklist complète.

## Déploiement

Voir `docs/deployment/vercel-deploy.md` et `docs/deployment/production-readiness.md` à la racine du monorepo.
