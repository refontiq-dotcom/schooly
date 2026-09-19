# Vercel — Variables d'environnement (Production + Preview)

Ce document contient uniquement des **placeholders**. Les vraies valeurs doivent être stockées dans Vercel, Supabase ou le gestionnaire de secrets approprié — jamais dans Git.

Dans Vercel → Project → Settings → Environment Variables, configurer les variables pour **Production** et **Preview** selon les besoins.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-secret-key>
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<telegram-chat-id>
TELEGRAM_ADMIN_URL=https://<schooly-admin-domain>/billing
WAVE_MERCHANT_ID=<wave-merchant-id>
WAVE_WEBHOOK_SECRET=<wave-webhook-secret>
TROUVETOU_API_KEY=<trouvetou-api-key>
METRICS_PUSH_SECRET=<metrics-push-secret>
CONTROL_CENTER_URL=https://<control-center-domain>
```

## Règles

- `NEXT_PUBLIC_SUPABASE_URL` peut être documentée.
- La clé Supabase côté client doit utiliser une clé **publishable** dès que la migration est effectuée.
- `SUPABASE_SERVICE_ROLE_KEY` est une clé legacy sensible : elle ne doit jamais être commitée, affichée dans les logs ou exposée au navigateur.
- Préférer à terme `SUPABASE_SECRET_KEY` pour le backend, conformément aux nouvelles clés Supabase.
- Tous les tokens, secrets webhook, clés API et secrets de push doivent rester hors du dépôt.
- Les valeurs de production doivent être saisies directement dans Vercel/Supabase.

## Rotation urgente

Les valeurs qui figuraient auparavant dans ce fichier ont été considérées comme exposées. Voir `docs/security/secret-rotation-schooly.md` pour la procédure de rotation.

## Développement local

Créer `.env.local` localement à partir de `.env.example`. Ne jamais committer `.env.local`.