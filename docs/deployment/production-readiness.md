# Phase 13 — Guide de déploiement production

## Pré-déploiement : checklist

### 1. Variables d'environnement (production)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-jwt>
SUPABASE_SECRET_KEY=<service-role-key>

# Billing
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
TELEGRAM_ADMIN_URL=https://admin.schooly.ci/billing
WAVE_MERCHANT_ID=M_ci_RImDyQYI8ccj
WAVE_WEBHOOK_SECRET=<a-configurer-quand-API-Wave-disponible>

# Intégrations
TROUVETOU_API_KEY=tv_live_xxx
METRICS_PUSH_SECRET=<secret-partage-avec-control-center>
CONTROL_CENTER_URL=https://admin.refontiq.com

# Monitoring (optionnel)
SENTRY_DSN=
```

### 2. Base de données
- [ ] Migrations appliquées (`supabase db push` OK)
- [ ] RLS activée sur toutes les tables (audit `docs/security/audit-rls-phase13.md`)
- [ ] Seed démo exécuté (école de test)
- [ ] Backup automatique activé (Supabase Dashboard → Scheduled backups)

### 3. Monitoring
- [ ] Health check : `GET /api/health` (sans auth) → `{ status: "ok", db: "connected" }`
- [ ] Alertes Telegram : configurées via `billing_configs` (alertes validation paiement)
- [ ] Métriques Control Center : `npm run billing:metrics` (push MRR + comptes actifs)

### 4. Performance
- [ ] Test de charge validé : 100 inscriptions concurrentes, 0 erreur (`scripts/load-test-enrollments.mjs`)
- [ ] Latence p95 < 3000 ms (testé à ~1905 ms)

### 5. Sécurité
- [ ] Aucun secret dans le code (vérifié : `.env.local` non tracké)
- [ ] CORS configuré (domaine `admin.schooly.ci`)
- [ ] Rate limiting (à ajouter via middleware Next.js si nécessaire)

## Déploiement

### Option A — Vercel (recommandé)
1. Connecter le repo GitHub
2. Framework : Next.js
3. Root directory : `apps/web-admin`
4. Variables d'environnement : copier celles ci-dessus
5. Build command : `cd ../.. && npx turbo build --filter=web-admin`
6. Deploy

### Option B — Self-hosted (Docker)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx turbo build --filter=web-admin

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web-admin/.next ./.next
COPY --from=builder /app/apps/web-admin/public ./public
COPY --from=builder /app/apps/web-admin/package.json ./
EXPOSE 3000
CMD ["npx", "next", "start"]
```

## Post-déploiement
- [ ] Vérifier `/api/health` sur l'URL prod
- [ ] Créer le Super Admin initial (`npm run create-super-admin -- email@ecole.ci`)
- [ ] Configurer le provider Schooly côté Trouvetou (pepper + clé API)
- [ ] Activer les backups quotidiens Supabase
- [ ] Mettre en place l'uptime monitoring (ex: UptimeRobot sur `/api/health`)
