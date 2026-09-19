# Phase 13 — Guide de déploiement production

## Pré-déploiement : checklist

### 1. Variables d'environnement (production)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
SUPABASE_SECRET_KEY=<supabase-secret-key>

# Billing
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
TELEGRAM_ADMIN_URL=https://<schooly-admin-domain>/billing
WAVE_MERCHANT_ID=<wave-merchant-id>
WAVE_WEBHOOK_SECRET=<wave-webhook-secret>

# Intégrations
TROUVETOU_API_KEY=<trouvetou-api-key>
METRICS_PUSH_SECRET=<metrics-push-secret>
CONTROL_CENTER_URL=https://<control-center-domain>

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
- [ ] Latence p95 < 3000 ms

### 5. Sécurité
- [ ] Aucun secret dans le code (vérifié : `.env.local` non tracké)
- [ ] CORS configuré (domaine de production)
- [ ] Rate limiting (à ajouter via middleware Next.js si nécessaire)

## Déploiement

### Vercel
1. Connecter le repo GitHub
2. Framework : Next.js
3. Root directory : `apps/schooly`
4. Variables d'environnement : renseigner les valeurs dans Vercel
5. Build command : `cd ../.. && npx turbo build --filter=schooly`
6. Deploy

## Post-déploiement
- [ ] Vérifier `/api/health` sur l'URL prod
- [ ] Créer le Super Admin initial (`npm run create-super-admin -- email@ecole.ci`)
- [ ] Configurer le provider Schooly côté Trouvetou (pepper + clé API)
- [ ] Activer les backups quotidiens Supabase
- [ ] Mettre en place l'uptime monitoring sur `/api/health`
