# Rotation des secrets exposés — Schooly

## Statut

Les secrets précédemment présents dans les documents de déploiement sont considérés comme **exposés**. Les valeurs ont été retirées du dépôt. La rotation effective des credentials doit être réalisée dans leurs consoles respectives avant de considérer l'incident comme clos.

## 1. Supabase — priorité maximale

Secrets concernés :
- ancienne clé `service_role`
- ancienne clé `anon`/clé client documentée

Procédure recommandée :
1. Dans Supabase → Settings → API Keys, créer une nouvelle clé **secret** et une nouvelle clé **publishable** si elles n'existent pas.
2. Mettre à jour les variables Vercel sans les écrire dans Git.
3. Vérifier que Production et Preview utilisent les nouvelles valeurs.
4. Redéployer.
5. Tester authentification, Server Actions, finance, admissions et API.
6. Après vérification, désactiver les anciennes clés legacy exposées.

Supabase recommande désormais les clés `publishable` et `secret`; les anciennes clés `anon` et `service_role` sont en cours de dépréciation. Ne pas régénérer le JWT signing secret simplement pour cette rotation sans plan de migration, car cela peut invalider les credentials legacy et provoquer une interruption.

## 2. Telegram

1. Révoquer/régénérer le token du bot dans BotFather.
2. Remplacer `TELEGRAM_BOT_TOKEN` dans Vercel.
3. Tester l'envoi d'une notification.
4. Ne jamais remettre le nouveau token dans Git.

## 3. Trouvetou

1. Révoquer l'ancienne `TROUVETOU_API_KEY` dans le système Trouvetou.
2. Générer une nouvelle clé.
3. Mettre à jour Vercel.
4. Tester les appels Trouvetou.

## 4. Wave

Le `WAVE_MERCHANT_ID` est un identifiant de configuration ; le `WAVE_WEBHOOK_SECRET` doit être traité comme un secret. Si une vraie valeur Wave a déjà été utilisée ailleurs, la régénérer et la remplacer dans Vercel.

## 5. Metrics / Control Center

Régénérer `METRICS_PUSH_SECRET` et mettre exactement la même nouvelle valeur dans Schooly et le Control Center. Tester ensuite le push métriques.

## 6. Historique Git

Le retrait des secrets du dernier état du dépôt ne supprime pas automatiquement leurs anciennes versions Git. GitHub recommande d'abord de révoquer/faire tourner les credentials, puis d'évaluer si une réécriture de l'historique est nécessaire. Une réécriture modifie les SHA et nécessite de coordonner les clones existants.

Après rotation, rechercher les anciennes valeurs et les formats de secrets dans tout l'historique. Si nécessaire, utiliser `git-filter-repo` sur un clone dédié et force-pusher l'historique nettoyé après validation.

## 7. Contrôles après rotation

- aucune valeur réelle dans `.md`, `.json`, `.ts`, `.tsx`, `.env.example` ou scripts ;
- `.env.local` reste ignoré par Git ;
- activer GitHub Secret Scanning / Push Protection si disponible ;
- vérifier Vercel Production + Preview ;
- vérifier les logs pour détecter une ancienne clé encore utilisée ;
- ne jamais afficher une clé complète dans les tickets, logs ou commits.