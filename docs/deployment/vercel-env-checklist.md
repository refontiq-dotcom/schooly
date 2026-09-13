# Vercel - Variables environnement (Production + Preview)

Copier chaque bloc dans Vercel > Projet > Settings > Environment Variables.

```
NEXT_PUBLIC_SUPABASE_URL=https://xoihidpejrzknmkvlceo.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaWhpZHBlanJ6a25ta3ZsY2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjkyNDcsImV4cCI6MjA5NTU0NTI0N30.IQVhlUabnjAt8rb6nyrU7ZSC8qmL6ly-lztdZeNYogE
```

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaWhpZHBlanJ6a25ta3ZsY2VvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk2OTI0NywiZXhwIjoyMDk1NTQ1MjQ3fQ.8BuDtCwE_7k-DISrFSfo_xHXcCO9ebh877Nxy-UzDGk
```

```
TELEGRAM_BOT_TOKEN=8882268453:AAGNSyYytK2Wyo57sKAlw2Vps1HNBg11ZvE
```

```
TELEGRAM_CHAT_ID=8958821599
```

```
TELEGRAM_ADMIN_URL=https://admin.schooly.ci/billing
```

```
WAVE_MERCHANT_ID=M_ci_RImDyQYI8ccj
```

```
WAVE_WEBHOOK_SECRET=votre_wave_webhook_secret
```

```
TROUVETOU_API_KEY=tv_live_79402646-081e-490e-9096-e1cd3caa7a8c.vK3y2tbrEe__uRMYg7YB55mUI_4plz1bKZajM5cMuog
```

```
METRICS_PUSH_SECRET=e4f6a8b2c0d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3
```

```
CONTROL_CENTER_URL=http://localhost:3000
```

## Notes

- WAVE_WEBHOOK_SECRET: placeholder, a remplacer quand API Wave disponible
- CONTROL_CENTER_URL: localhost:3000 = dev, changer pour https://admin.refontiq.com en prod
- Domaine post-deploy: admin.schooly.ci (CNAME > cname.vercel-dns.com)
