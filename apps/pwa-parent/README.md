# Schooly - Portail Parent (PWA)

Application PWA pour les parents et tuteurs afin de suivre la scolarité de leurs enfants.

## Fonctionnalités

- **Multi-enfants / Multi-écoles** : Sélecteur pour naviguer entre les enfants et établissements
- **Situation financière** : Consulter le total dû, payé et en attente
- **Paiement Mobile Money** : EN ATTENTE - voir section "Limitations connues"
- **Documents** : Consultation et téléchargement des reçus
- **Cahier de texte** : Voir les devoirs assignés aux enfants
- **Notes** : Consulter les notes et évaluations
- **Demande de moratoire** : Demander un délai de paiement
- **Mode hors-ligne** : Fonctionne partiellement sans connexion (cache PWA)
- **Bulletins PDF** : Génération et téléchargement des bulletins de notes

## Limitations connues

### Paiement Mobile Money 🚧 EN ATTENTE

Les boutons de paiement Mobile Money (MTN Money, Orange Money, Moov Money) sont actuellement des **placeholders UI**.

**Pourquoi ?**
- Les APIs Mobile Money (MTN MoMo API, Orange Money API, Moov Money API) nécessitent des partenariats commerciaux
- Des accès API sécurisés sont requis (clés API, secrets, webhooks)
- Un contrat avec les opérateurs télécoms est nécessaire

**État actuel :**
- ✅ L'UI est complète et prête
- ✅ La structure du flux est définie (clic → redirection/modal → confirmation → génération reçu)
- ⏳ L'intégration technique est en attente des APIs

**À faire quand les APIs sont disponibles :**
1. Configurer les credentials API dans `.env.local`:
   ```
   MTN_MOMO_API_KEY=
   MTN_MOMO_SHARED_SECRET=
   ORANGE_MONEY_API_KEY=
   ORANGE_MONEY_SHARED_SECRET=
   ```
2. Implémenter les fonctions de paiement dans `src/lib/payments/mobile-money.ts`
3. Configurer les webhooks pour recevoir les confirmations de paiement
4. Tester en environnement de sandbox avant de passer en production

**Approches alternatives possibles :**
- Utiliser les liens de paiement profilés (payment links) si disponible
- Intégrer un service de paiement agrégé (ex: CinetPay, Florence, PayDogo) qui fournit une couche d'abstraction sur les APIs Mobile Money
- Demander aux parents de payer via l'app mobile de l'opérateur et saisir manuellement le transaction ID

## Structure du projet

```
apps/pwa-parent/
├── src/
│   ├── app/
│   │   ├── dashboard/           # Tableau de bord parent
│   │   │   ├── page.tsx         # Dashboard principal
│   │   │   ├── bulletin/        # Bulletins de notes
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Page de visualisation du bulletin
│   │   │   └── moratorium/      # Demande de moratoire
│   │   │       ├── page.tsx     # Formulaire et historique
│   │   │       └── route.ts     # API pour créer une demande
│   │   ├── login/               # Page de connexion
│   │   ├── layout.tsx           # Layout racine
│   │   ├── page.tsx             # Page d'accueil (login)
│   │   └── globals.css          # Styles globaux
│   ├── components/
│   │   └── ui/                  # Composants UI réutilisables
│   ├── hooks/
│   │   ├── use-child-context.tsx # Contexte enfants/écoles
│   │   └── use-offline-status.tsx # Détection hors-ligne
│   ├── lib/
│   │   ├── pdf/
│   │   │   └── bulletin.tsx     # Génération PDF des bulletins
│   │   └── utils.ts             # Utilitaires (cn, formatters)
│   ├── middleware.ts            # Middleware d'authentification
│   └── utils/
│       └── supabase/
│           ├── client.ts        # Client Supabase browser
│           └── server.ts        # Client Supabase server
├── public/
│   ├── sw.js                    # Service Worker (mode hors-ligne)
│   └── manifest.json            # Manifest PWA
├── middleware.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Installation et développement

```bash
cd apps/pwa-parent

# Installer les dépendances
npm install

# Lancer le développement
npm run dev
```

L'application est accessible à http://localhost:3001 (ou le port configuré).

## Variables d'environnement

Copier `.env.local.example` en `.env.local` et configurer :

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=votre_anon_key
```

## PWA / Mode hors-ligne

L'application est conçue comme une PWA (Progressive Web App) :

- **Service Worker** : Cache les pages et ressources pour le mode hors-ligne
- **Manifest** : Installation possible sur mobile (icône sur l'écran d'accueil)
- **Bandeau hors-ligne** : Indication visuelle lorsque la connexion est perdue

Fonctionnalités hors-ligne :
- ✅ Affichage des pages déjà chargées (cache)
- ⚠ Paiement et soumission de formulaires nécessitent une connexion

## Génération de bulletins PDF

Les bulletins sont générés avec **@react-pdf/renderer**. Le composant `BulletinPDF` dans `src/lib/pdf/bulletin.tsx` définit la structure du document.

Pour générer un bulletin :
1. Aller sur `/dashboard/bulletin/[id]`
2. Cliquer sur "Générer le PDF"
3. Télécharger le fichier généré

## Architecture des données

### Sources de données principales

| Données | Table SQL | Description |
|---------|-----------|-------------|
| Écoles | `schools` | Établissements scolaires |
| Enfants | `enrollments` + `students` | Inscriptions et élèves |
| Devoirs | `homeworks` | Cahier de texte |
| Notes | `grade_entries` | Saisie de notes |
| Paiements | `payments` | Encaissements |
| Reçus | `receipts` | Reçus de paiement |
| Tarifs | `fee_schedules` | Grille tarifaire |
| Moratoires | `moratoriums` | Demandes de délai de paiement |
| Bulletins | `report_cards` | Bulletins PDF générés |

### Rôles et accès

- **Parent** : Accès uniquement aux données de ses enfants (via `enrollments`)
- **Élève** : Accès à ses propres données (dans le portail élève)
- **Professeur** : Accès à ses cours et aux notes qu'il a saisies

## Routes principales

| Route | Description |
|-------|-------------|
| `/` | Page de connexion |
| `/dashboard` | Tableau de bord parent |
| `/dashboard/bulletin/[id]` | Visualisation d'un bulletin |
| `/dashboard/moratorium` | Demande de moratoire |

## À faire (TODO)

### Priorité haute
- [ ] Implémenter le chargement réel des enfants (actuellement mock)
- [ ] Connecter le paiement Mobile Money aux APIs (en attente)

### Priorité moyenne
- [ ] Améliorer le mode hors-ligne (synchronisation plus robuste)
- [ ] Ajouter la fonctionnalité "demande de moratoire" complète
- [ ] Tests unitaires

### Priorité basse
- [ ] Icônes PNG pour le manifest (icon-192.png, icon-512.png)
- [ ] Internationalisation (i18n) si multi-langues
- [ ] Thème sombre/améliorations UI

## Contributeurs

À compléter...
