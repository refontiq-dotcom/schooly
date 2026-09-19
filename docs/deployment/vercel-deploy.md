# Déploiement Vercel — Schooly Web Admin

## Étapes de déploiement

### 1. Créer le projet sur Vercel

1. Importer le dépôt GitHub `refontiq-dotcom/schooly`
2. **Framework Preset** : Next.js
3. **Root Directory** : `apps/schooly`
4. **Build Command** : `npm run build`
5. **Install Command** : `cd ../.. && npm install`
6. **Output Directory** : `.next`

### 2. Configurer les variables d'environnement

Dans Vercel → Settings → Environment Variables.

Ne jamais copier une valeur secrète dans ce document. Les valeurs ci-dessous sont des placeholders :

| Variable | Valeur exemple | Nature |
|----------|----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | publique |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `<supabase-publishable-key>` | clé client, navigateur autorisé |
| `SUPABASE_SECRET_KEY` | `<supabase-secret-key>` | secrète, serveur uniquement |
| `TELEGRAM_BOT_TOKEN` | `<telegram-bot-token>` | secrète |
| `TELEGRAM_CHAT_ID` | `<telegram-chat-id>` | identifiant |
| `TELEGRAM_ADMIN_URL` | `https://<schooly-admin-domain>/billing` | configuration |
| `WAVE_MERCHANT_ID` | `<wave-merchant-id>` | identifiant marchand |
| `WAVE_WEBHOOK_SECRET` | `<wave-webhook-secret>` | secrète |
| `TROUVETOU_API_KEY` | `<trouvetou-api-key>` | secrète |
| `METRICS_PUSH_SECRET` | `<metrics-push-secret>` | secrète |
| `CONTROL_CENTER_URL` | `https://<control-center-domain>` | configuration |
| `SENTRY_DSN` | *(laisser vide si non utilisé)* | optionnelle |

### 3. Déployer

1. Vérifier les variables d'environnement dans Vercel.
2. Lancer le déploiement.
3. Vérifier l'URL et le health check.

### 4. Post-déploiement

1. Configurer le domaine personnalisé.
2. Vérifier `/api/health`.
3. Tester login, logout, admissions, finance et les intégrations dépendantes des secrets.

## Commandes Vercel CLI

```bash
vercel login
cd apps/schooly
vercel link
vercel env add SUPABASE_SECRET_KEY production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TROUVETOU_API_KEY production
vercel --prod
```

Les commandes ci-dessus attendent une saisie interactive et ne doivent pas recevoir les valeurs secrètes dans des scripts versionnés.