# Schooly — Réservation intelligente

Ce document décrit l'intelligence ajoutée au module **Réservation** :
scoring de confiance parent, anti-fraude, file d'attente et dashboard de
conversion. Il complète `README.md` et `TROUVETOU_INTEGRATION.md`.

## Pourquoi rendre la réservation « intelligente » ?

Le flux v1 (créer une réservation → payer → confirmer) traite toutes les
demandes de la même façon. En production cela pose trois problèmes :

1. **Survente invisible** : la section est choisie côté application (sans
   verrou Postgres), deux requêtes simultanées peuvent sélectionner la même
   section, et `reserve_seat` ne s'exécute qu'à la confirmation — trop tard
   pour certaines files.
2. **Fraude silencieuse** : rien n'empêche un même parent de réserver 50
   places, ou de réserver deux fois pour le même élève dans le même
   établissement.
3. **Prospects perdus** : un parent qui arrive sur une classe complète repart
   sans alternative. Pas de file d'attente, pas de suggestion d'établissement
   voisin.

La migration `20260903090000_reservation_intelligence.sql` corrige les trois.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/reservations                                          │
│       │                                                          │
│       ▼                                                          │
│  create_reservation_smart(establishment, level, ...)             │
│       │                                                          │
│       ├── detect_reservation_fraud()   → 0..4 flags              │
│       ├── compute_parent_trust_score() → 0..100                  │
│       │                                                          │
│       ├─ flags ≥ 2  → INSERT (status=rejected_fraud)             │
│       │                                                          │
│       ├─ section disponible                                          │
│       │      → UPDATE sections SET seats_taken = +1              │
│       │      → INSERT (status=reserved, expires_at=...)          │
│       │                                                          │
│       └─ sinon    → INSERT (status=waitlisted, waitlist_position)│
└──────────────────────────────────────────────────────────────────┘
```

## Scoring de confiance parent

`compute_parent_trust_score(establishment_id, phone, email)` retourne
un score 0..100 basé sur l'historique réel du parent (téléphone normalisé +
email) **dans cet établissement**.

| Composante | Plage |
|---|---|
| Base | 50 (neutre pour les nouveaux parents) |
| Bonus par réservation confirmée | +10 (plafonné +30) |
| Pénalité no-show (taux d'expiration) | -40 × taux (plafonné -30) |
| Pénalité annulation | -5 par annulation (plafonné -20) |

Implémentation miroir TypeScript dans
[`src/lib/reservation-intelligence/scoring.ts`](src/lib/reservation-intelligence/scoring.ts)
pour les tests et l'UX (affichage immédiat côté client).

## Anti-fraude

`detect_reservation_fraud()` retourne un tableau de flags :

| Flag | Condition |
|---|---|
| `DUPLICATE_STUDENT` | Un élève avec le même nom + date de naissance est déjà inscrit |
| `SAME_PHONE_DIFFERENT_NAMES` | Plus de 2 noms de parents différents pour ce téléphone sur 6 mois |
| `MULTIPLE_PENDING_PAYMENT` | ≥ 2 réservations `pending_payment` pour ce contact sur 24h |
| `RAPID_REPEAT` | ≥ 3 réservations créées dans la dernière heure |

Si **2 flags ou plus** sont levés → status `rejected_fraud` (HTTP 403).
Les flags sont stockés sur la réservation pour audit, visibles dans
`/dashboard/admin/reservations/fraud`.

## File d'attente intelligente

Quand aucune place n'est disponible pour le niveau demandé :

1. La réservation est créée en `status = 'waitlisted'` avec une
   `waitlist_position` (1, 2, 3, ...).
2. **Tri par score de confiance**, puis par ancienneté (les parents
   fiables sont promus en premier).
3. **ETA estimé** : la vue `waitlist_eta` calcule un délai attendu en
   jours basé sur le taux d'expiration des 30 derniers jours sur ce
   niveau.
4. **Promotion automatique** : `release_expired_reservations()` et
   `cancel` appellent `promote_waitlist(p_level)` qui :
   - prend le `FOR UPDATE` d'une section qui a une place libre ;
   - sélectionne le meilleur candidat (score desc, ancienneté asc) ;
   - passe sa réservation en `reserved` et lui attribue la section ;
   - renumérote les positions de la file.

## Idempotence de la confirmation

`reserve_seat(p_reservation_id)` est désormais idempotent : si la
réservation est déjà `reserved` ou `confirmed`, la fonction retourne
l'état existant sans modification (plus de double-décrémentation).

Le route handler `POST /api/reservations/[id]/confirm` détecte aussi
l'état avant l'appel RPC et retourne :

- `200 { already_reserved: true }` si la réservation est déjà confirmée ;
- `409 { code: "EXPIRED" | "CANCELLED" | "REJECTED_FRAUD" }` sinon.

## Dashboard admin

| Route | Contenu |
|---|---|
| `/dashboard/admin/reservations` | Tunnel de conversion + 20 dernières réservations |
| `/dashboard/admin/reservations/waitlist` | File d'attente triée par score + ETA + bouton « Promouvoir » |
| `/dashboard/admin/reservations/fraud` | Parents à risque + réservations rejetées pour fraude |

Le tunnel expose deux KPI calculés :
- **Taux de confirmation** : `confirmed / (pending_payment + reserved + confirmed)`
- **Taux de no-show** : `expired / reserved`

## Migration à appliquer

```bash
supabase/migrations/20260903090000_reservation_intelligence.sql
```

Idempotent (utilise `add column if not exists`, `create or replace`,
`do $$ begin ... exception when duplicate_object`).

Ajouter cette ligne au bloc `Démarrage rapide → 1. Créer un projet Supabase`
du `README.md`, après la migration Trouvetou paiement.

## Tests

```
src/lib/reservation-intelligence/scoring.test.ts          — 21 tests
src/app/api/reservations/__tests__/route.test.ts          — 5 tests
src/app/api/reservations/[id]/confirm/__tests__/route.test.ts — 6 tests
```

Total : **59 tests passent** (`npx vitest run`).

## Hooks à venir

La fonction `create_reservation_smart()` est volontairement isolée pour
qu'on puisse y ajouter :

- un appel à un webhook configuré par l'établissement (WhatsApp n8n) ;
- un lock applicatif par `parent_phone` (rate-limiting encore plus strict) ;
- un calcul d'`eta_days` recalculé en temps réel via `LISTEN/NOTIFY` Postgres.

Aucun de ces hooks n'est branché en v1 pour rester compatible avec
l'infra actuelle.