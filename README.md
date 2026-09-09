# SCHOOLY - SaaS de Gestion Scolaire Multi-établissements

Ce fichier sert de point d'entrée pour tout développeur ou agent IA rejoignant le projet. Il définit l'architecture, la stack technique et la marche à suivre. **Si vous êtes un agent IA reprenant ce projet, lisez attentivement ce fichier avant de proposer des modifications.**

## 1. Contexte du projet
**Schooly** est une plateforme SaaS de gestion scolaire (Côte d'Ivoire / Afrique de l'Ouest) avec pour principes non négociables :
- **Zero-Training UX** : utilisable sans formation.
- **Offline-first & Mobile-first** : pour s'adapter aux réalités du terrain (instabilité réseau).
- **Multi-tenant strict (Base de données RLS)** : sécurité absolue et séparation des données entre les écoles.
- **Sobriété technique** : pas de stockages lourds.

📄 **Le Cahier des Charges complet se trouve ici :** [`cahier-des-charges-schooly-1.md`](./cahier-des-charges-schooly-1.md) (consultez sa section de suivi pour connaître l'avancement).

## 2. Architecture du Monorepo
Ce projet utilise un monorepo (probablement via Turborepo / pnpm workspace) structuré ainsi :
- `apps/web-admin/` : Le frontend administratif pour la Direction, Secrétariat, Comptabilité, etc. (Next.js App Router).
- `apps/pwa-parent/` : Le portail PWA pour les parents et élèves (Next.js PWA offline-first).
- `packages/ui/` : Bibliothèque de composants partagés (basée sur shadcn/ui et Tailwind CSS).
- `packages/db/` : Dossier contenant la configuration Supabase, le schéma, les migrations SQL, et les tests RLS.

## 3. Stack Technique
- **Frontend** : Next.js (App Router), React, TypeScript strict, Tailwind CSS, shadcn/ui.
- **Backend & BDD** : Supabase (PostgreSQL, Auth, Realtime). La sécurité repose intégralement sur les règles **RLS (Row Level Security)**.
- **Tests** : Vitest (unitaires, calculs financiers, RLS) et potentiellement Playwright (E2E).

## 4. Conventions de développement strictes
1. **Pas de valeurs en dur** : Tous les tarifs, statuts, et coefficients doivent être gérés dynamiquement via la base de données.
2. **Priorité aux tests RLS** : Toute nouvelle table doit s'accompagner de ses politiques RLS strictes (faisant référence au `school_id`) et des tests validant l'isolation AVANT de développer l'UI.
3. **Types financiers** : Les montants financiers (FCFA) doivent toujours être des entiers (BIGINT), **jamais** de flottants.
4. **Soft-deletes** : Aucune donnée métier sensible n'est supprimée définitivement (`deleted_at`).
5. **Isolation de la logique multi-écoles** : Toutes les données sont liées par un `school_id`.

## 5. Comment reprendre le développement (Pour un agent IA / Développeur)
1. Lisez **obligatoirement** ce `README.md`.
2. Ouvrez le [`cahier-des-charges-schooly-1.md`](./cahier-des-charges-schooly-1.md) et descendez à la **Section 10 (Roadmap)** pour identifier l'étape en cours marquée d'un `[ ]` (case non cochée).
3. Observez la **Section 11 (Checklist de démarrage)** pour vérifier que toutes les étapes de fondations sont remplies.
4. Vérifiez les migrations dans `packages/db/supabase/migrations` pour connaître l'état de la base de données.
5. Proposez toujours un **plan d'implémentation** avant toute modification de masse.
