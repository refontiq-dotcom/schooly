# Vercel — Variables d'environnement (Production + Preview)

Ce document contient uniquement des **placeholders**. Les vraies valeurs doivent être stockées dans Vercel, Supabase ou le gestionnaire de secrets approprié — jamais dans Git.

Dans Vercel → Project → Settings → Environment Variables, configurer les variables pour **Production** et **Preview** selon les besoins.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
SUPABASE_SECRET_KEY=<supabase-secret-key>
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
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` est la clé client publique à utiliser dans le navigateur et le SSR utilisateur.
- `SUPABASE_SECRET_KEY` est la clé backend privilégiée : jamais dans le navigateur, jamais dans Git et jamais dans les logs.
- Les anciennes clés `anon` / `service_role` restent désactivées uniquement après validation complète de tous les clients, jobs et intégrations.
- Tous les tokens, secrets webhook, clés API et secrets de push doivent rester hors du dépôt.
- Les valeurs de production doivent être saisies directement dans Vercel/Supabase.

## Rotation urgente

Les valeurs qui figuraient auparavant dans ce fichier ont été considérées comme exposées. Voir `docs/security/secret-rotation-schooly.md` pour la procédure de rotation.

## Développement local

Créer `.env.local` localement à partir de `.env.example`. Ne jamais committer `.env.local`.