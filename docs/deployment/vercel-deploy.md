# Déploiement Vercel — Schooly Web Admin

## Étapes de déploiement

### 1. Créer le projet sur Vercel

1. Allez sur [vercel.com/new](https://vercel.com/new)
2. Importez le dépôt GitHub `refontiq-dotcom/schooly`
3. **Framework Preset** : Next.js
4. **Root Directory** : `apps/schooly` ← important !
5. **Build Command** : `npm run build`
6. **Install Command** : `cd ../.. && npm install`
7. **Output Directory** : `.next`

### 2. Configurer les variables d'environnement

Dans Vercel → Settings → Environment Variables, ajoutez pour **Production** et **Preview** :

| Variable | Valement exemple | Source |
|----------|------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xoihidpejrzknmkvlceo.supabase.co` | `.env.local` schooly |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | `.env.local` schooly |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | `.env.local` schooly |
| `TELEGRAM_BOT_TOKEN` | `8882268453:AAGNSyYytK2W...` | `.env.local` schooly |
| `TELEGRAM_CHAT_ID` | `8958821599` | `.env.local` schooly |
| `TELEGRAM_ADMIN_URL` | `https://admin.schooly.ci/billing` | `.env.local` schooly |
| `WAVE_MERCHANT_ID` | `M_ci_RImDyQYI8ccj` | `.env.local` schooly |
| `WAVE_WEBHOOK_SECRET` | `votre_wave_webhook_secret` | À configurer quand API Wave dispo |
| `TROUVETOU_API_KEY` | `tv_live_79402646-...` | `.env.local` schooly |
| `METRICS_PUSH_SECRET` | `<secret>` | `.env.local` schooly |
| `CONTROL_CENTER_URL` | `https://admin.refontiq.com` | À changer quand CC en prod |
| `SENTRY_DSN` | *(laisser vide)* | Optionnel |

### 3. Déployer

1. Cliquez sur **Deploy**
2. Attendez la fin du build (~2-3 min)
3. Vérifiez l'URL fournie par Vercel

### 4. Post-déploiement

1. Créez le domaine personnalisé : `admin.schooly.ci` (Vercel → Settings → Domains)
2. Configurez le DNS : CNAME `admin.schooly.ci` → `cname.vercel-dns.com`
3. Créez le Super Admin initial :
   ```bash
   npm run create-super-admin -- admin@schooly.ci
   ```
4. Vérifiez le health check : `https://admin.schooly.ci/api/health`
   → Réponse attendue : `{"status":"ok","db":"connected"}`

## Commandes Vercel CLI (optionnel)

Si vous installez la CLI Vercel localement (`npm i -g vercel`) :

```bash
# Login
vercel login

# Lier le projet
cd apps/schooly
vercel link

# Ajouter une variable
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... etc

# Déployer
vercel --prod
```
