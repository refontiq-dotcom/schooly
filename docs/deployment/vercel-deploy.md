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
| `CRON_SECRET` | `<secret-aleatoire-long>` | secrète, entête `Authorization: Bearer` des deux routes `/api/cron/*` |
| `R2_ACCOUNT_ID` | `fe6f046166fb1f4f7ed1bc7088d89095` | publique, compose l'endpoint S3 R2 |
| `R2_ACCESS_KEY_ID` | *à créer — jamais versionné* | secrète, lecture/écriture du bucket |
| `R2_SECRET_ACCESS_KEY` | *à créer — jamais versionné* | secrète |
| `R2_BUCKET` | `schooly-media` | publique, nom du bucket |
| `R2_PUBLIC_URL` | `https://pub-86f196c5781c428caf42be75e4cce653.r2.dev` | publique, base des URL de médias |
| `R2_S3_ENDPOINT` | *(vide)* | surcharge l'endpoint, pour un émulateur local |
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

#### Contrainte du plan Hobby sur les crons

Le projet est sur le plan **Hobby**. Vercel y limite les cron jobs à **une exécution
par jour** : toute expression plus fréquente fait **échouer le déploiement**, avec
l'erreur *« Hobby accounts are limited to daily cron jobs. This cron expression
would run more than once per day. »*

C'est ce qui a bloqué les déploiements entre le 24 et le 27 septembre 2026 :
`0 * * * *` avait été ajouté à `apps/schooly/vercel.json` par le commit `2b43045`
alors que le dernier déploiement réussi datait de `409b74e`, le commit
immédiatement précédent. Les deux crons sont donc quotidiens (`0 2 * * *` et
`0 3 * * *`) — horaires distincts pour ne pas déclencher les deux ensemble.

Le drain de `notification_outbox` toutes les 5 minutes n'est pas tenable sur Hobby.
Ce n'est pas bloquant aujourd'hui : la route est en **mode preview** (elle stocke
un aperçu et passe les lignes en état terminal, sans envoyer de SMS). Le délai de
5 minutes n'aurait un sens que le jour où un provider WhatsApp sera branché — à ce
moment là, basculer le déclenchement vers `pg_cron` côté Supabase plutôt que vers
Vercel Cron.

> Une modification de `vercel.json` ne prend effet qu'au **prochain déploiement** :
> c'est aussi la raison des commits vides de type « trigger production deployment »
> dans l'historique.

#### Médias : Cloudflare R2

Les photos et la visite 360° sont stockées dans le bucket **`schooly-media`**
(Cloudflare R2, stockage objet compatible S3, sans frais de sortie). L'endpoint S3
retenu est `https://fe6f046166fb1f4f7ed1bc7088d89095.r2.cloudflarestorage.com` —
et non `r2.cloudflarest.com`, qui n'est pas l'endpoint S3 et ferait échouer
toutes les signatures.

**Structure des clés** (déterministe, jamais le nom du fichier d'origine) :

```
schooly/{environnement}/360/{etablissementId}/{mediaId}.jpg        visite 360°
schooly/{environnement}/photos/cover/{etablissementId}/{mediaId}.jpg
schooly/{environnement}/photos/gallery/{etablissementId}/{mediaId}.jpg
schooly/{environnement}/ads/{etablissementId}/{mediaId}.jpg
```

`{environnement}` vaut `production`, `staging` (prévisualisation Vercel) ou
`development`, de sorte qu'une prévisualisation n'écrive jamais dans le préfixe
de la production. `{mediaId}` est un UUID.

Le bucket doit être **public en lecture** et doté d'une règle **CORS** autorisant
le `PUT` depuis l'origine de l'application, sinon le navigateur bloque l'envoi
direct avant même la requête :

```json
[
  {
    "AllowedOrigins": ["https://<domaine-ecole>", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Les identifiants d'accès se créent dans R2 → Manage R2 Access Tokens, avec les droits
**Object Read & Write** limités au bucket. Ce ne sont pas les identifiants de l'API
Cloudflare globale.

**Suppression.** `DELETE /api/v1/admin/trouvetou/media` supprime réellement l'objet
puis sa référence en base, dans cet ordre — R2 d'abord, pour qu'un échec R2 laisse
la référence intacte et permette de réessayer. Trois garde-fous : l'URL doit être une
référence de cet établissement (lu en base), la clé déduite doit appartenir à cet
établissement (structure de clé), et l'objet est vérifié par `HEAD` avant suppression
car `DeleteObject` est idempotent chez R2.

**Envoi direct par URL signée** : la route `POST /api/v1/admin/trouvetou/media` n'héberge
plus le fichier. Elle vérifie le quota, le type MIME et la taille, puis renvoie une URL
signée valable 5 minutes ; le navigateur envoie le fichier **directement sur R2**. Le
fichier ne transite donc jamais par la fonction Next.js, et la limite de 4,5 Mo du
corps de requête de Vercel Hobby porte sur un JSON de quelques octets au lieu d'une
photo. Un aller-retour par le serveur aurait plafonné les photos 360, les plus lourdes.

Conséquence à connaître : le quota est contrôlé au moment où l'URL est signée, pas au
moment du dépôt. Deux envois simultanés peuvent tous deux obtenir une URL ; c'est la
même fenêtre qu'avant le passage à R2, et la contrainte SQL
`schools_trouvetou_gallery_max_4` rattrape le débordement à l'écriture.

#### Migration à appliquer avant le déploiement

Vercel n'applique pas les migrations SQL. `supabase/migrations/20260927005000_limit_trouvetou_media.sql`
pose les contraintes `schools_trouvetou_gallery_max_4` et
`schools_trouvetou_photos_360_max_1` ; elle doit être appliquée manuellement
(`supabase db push` ou éditeur SQL) **avant** de publier le code qui écrit sur ces
colonnes. Le code tronque déjà avant écriture, donc l'application reste sûre, mais
sans la migration les plafonds ne sont garantis que par l'application.

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