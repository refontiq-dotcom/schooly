# Schooly — Audit 5 axes & Plan d'amélioration XXL

> Document de pilotage produit/technique. Établi à partir d'un audit en 5 axes
> (cartographie fonctionnelle, intelligence système, cohérence structurelle,
> UX, scalabilité/résilience) et d'un lot de correctifs livré (« P1 »).

---

##1. Synthèse de l'audit

### Axe 1 — Cartographie fonctionnelle

**Périmètre couvert (constaté dans le code) :**

| Domaine | Fonctionnalités | Maturité |
|---|---|---|
| Admissions | Pré-inscription publique `/enroll/[schoolId]` (code + expiration), validation → matricule + QR, inscription au guichet (pré-remplissage), transferts/orientations, import CSV, affectations Ministère | ✅ solide |
| Finance | Grilles tarifaires, échéanciers générés, encaissement via RPC `record_payment`, annulation avec motif obligatoire, moratoires, remises (fratrie idempotente en masse, manuelle plafonnée), relances J-5/J+1/J+7 (outbox) | ✅ solide |
| Caisse | Sessions ouverture/clôture avec écart attendu/compté, historique paginé, discipline (encaissement refusé sans session) | ✅ solide |
| Direction | Cockpit KPI réels (effectifs, recouvrement, séries, file d'action, alertes décrochage), rapports | ✅ |
| Pédagogie | Niveaux, notes, bulletins | ✅ |
| Services | Cantine, internat, transport | ✅ |
| Socle | Recherche globale (annuaire), portail élève, vérification publique des reçus, notifications Telegram + worker, Control Center super_admin, facturation `@refontiq/billing` | ✅ |

**Lacunes :** pas de portail parent/tuteur ; SMS/WhatsApp annoncés dans les
schémas de relance mais non branchés ; exports rapporteurs (PDF/CSV) limités.

### Axe 2 — Intelligence système & logique métier

**Forces (à préserver) :**
- Paiement **atomique et idempotent** (RPC `record_payment`, clé serveur par appel, cash refusé sans session de caisse).
- **Garde multi-tenant** systématique (`requireSchoolRole` ; IDOR documenté dans `docs/security/audit-socle-auth-tenancy.md`, tests dédiés).
- Règles métier vérifiées : plafond des remises au solde attendu, moratoires bornés (1–12 échéances), remise fratrie idempotente sans défaut silencieux, devis par niveau, quotes à expiration, orientation État.
- Entrées validées par **zod** côté serveur avec messages FR lisibles (`parseForm`), couvertes par `schemas.test.ts`.
- Guidance intelligente + file d'action + relances idempotentes par gabarit.

**Faiblesses :**
- Historique de validations molles (`parseInt(...) || 0`) : **corrigé pour finance/admissions/moratoires ; subsiste dans `services/actions.ts`** (hors lot P1).
- Peu de tests sur les **flows critiques UI** (modal guichet mockée ; aucun E2E).
- Logique métier dispersée entre actions et composants (règles de statut recopiées).

### Axe 3 — Cohérence structurelle

- **Monolithes** : `dashboard/finance/actions.ts` (~1 400 lignes) et `dashboard/admissions/actions.ts` (~1 100 lignes) dépassent le plafond 800 — à découper par sous-domaine.
- **Bon socle transversal** : `lib/schemas/*` (+ tests), `utils/supabase/require-role`, `route-rules`, pagination (`usePagination`, `ListPagination`, `ListPaginationLinks`), `cache-tags.ts` (source unique des tags de cache).
- `dashboard-data.ts` : helpers purs testés / loader injecté `AdminLike` — modèle à conserver ; exports consommés uniquement par les widgets direction (pas de redondance).
- Doublons restants : lectures « liste complète » réimplémentées par page (caisse vs direction).

### Axe 4 — UX

**Acquis :** libellés FR cohérents, états vides, badges de statut, compteurs
`aria-live` de pagination (dont navigation par URL `?page=N` côté serveur),
toasts d'erreur d'action.

**Restes :**
- 2 usages de `window.location.href` dans `direction/admissions` (warnings lint) → `router.push`.
- Constante morte `STATE_ORIENTATION_LABELS` ; `formData` inexploité dans `generateDueReminders`.
- Écran de chargement brut (« Chargement... ») au lieu de squelettes.
- Aucun filtre/recherche local sur les onglets Pré-inscriptions / Tuteurs / Inscriptions.
- Onglet titré « Pré-inscriptions en attente » mais listant tous les statuts (confusion possible).

### Axe 5 — Scalabilité & résilience

**Avant P1 :** zéro `unstable_cache`/`revalidateTag` dans tout `src` ; historique
caisse chargé intégralement ; listes direction entières en mémoire.

**Corrigé dans P1 (voir §2).** **Reste à traiter :**
- `getEnrollments`, `getStudentBalances`, snapshot annuaire : toujours « tout charger ».
- Le dashboard direction scanne **toutes les lignes** `payments` pour calculer séries et agrégats en JS → plafond à quelques milliers de transactions.
- Recherche globale = snapshot de 4 listes complet côté client.
- Résilience existante (idempotency, soft-delete + audit, outbox retry, CHECK DB) : bonne base ; manque observabilité structurée, rate-limiting des actions et E2E de non-régression.

---

##2. Lot P1 livré (cycle d'audit)

| Lot | Contenu | État |
|---|---|---|
| **P1-A — Validation zod** | `feeScheduleSchema` + `manualDiscountSchema` (remplacent 2 `parseInt(...)\|\| 0`) ; rewiring vérifié de `paymentActionSchema`, `preEnrollmentPublicSchema`, `counterEnrollmentSchema`, schémas moratoires ; **fix des 3 erreurs tsc historiques** via surcharges typées de `fcfaInt` ; +8 tests (28 au total) | ✅ |
| **P1-B — Cache de lecture** | `unstable_cache` + tags + TTL 60 s sur `getPayments`, `getPreEnrollments` et les 11 lectures du dashboard direction ; purges `updateTag` à chaque encaissement/annulation/validate/contre-inscription ; tags centralisés dans `lib/cache-tags.ts` | ✅ |
| **P1-C — Pagination** | `getPayments(schoolId, { page, pageSize })` en base (`.range` + count exact) branché sur `/dashboard/caisse/history` avec `?page=N` + `ListPaginationLinks` ; onglets Pré-inscriptions/Tuteurs/Inscriptions paginés côté client (`usePagination`) ; `getPreEnrollments(schoolId, opts)` paginé en base (rétrocompatible) | ✅ |
| **Hygiène** | Typage des `any` de `direction/admissions/page.tsx` (types du modal exportés) ; fix des 2 erreurs `set-state-in-effect` du modal guichet (pattern « adjust state during render ») ; imports morts retirés | ✅ |

**Validations :** `tsc --noEmit` 0 erreur · `eslint` 0 erreur (4 warnings
préexistants) · `next build` OK · **602 tests / 52 fichiers verts**.

---

##3. Plan d'amélioration XXL

Priorité : 🔴 bloquant échelle · 🟠 élevé · 🟡 moyen.

### 3.1 Architecture

| # | Action | Phase | Pri |
|---|---|---|---|
| A1 | Découper `finance/actions.ts` et `admissions/actions.ts` en modules par sous-domaine (`payments/`, `cash/`, `discounts/`, `pre-enrollments/`…), façade d'exports conservée pour compatibilité | P2 | 🟠 |
| A2 | Basculer `direction/admissions` (page « use client » qui fetch tout) vers Server Components + `searchParams` comme état de filtre/onglet (pattern inauguré par `?page=N`) | P3 | 🟠 |
| A3 | Frontière stricte : getters = lecture pure testable, actions = écriture + révalidation ; `parseForm` imposé sur toute nouvelle action | P2 | 🟠 |
| A4 | Centraliser les règles de statut (pré-inscription/inscription) dans un module métier partagé UI/serveur | P3 | 🟡 |
| A5 | Types Supabase générés (Database types) pour supprimer les casts `as unknown as X[]` | P3 | 🟡 |

### 3.2 Automatisation

| # | Action | Phase | Pri |
|---|---|---|---|
| B1 | CI GitHub Actions sur PR : `lint` + `tsc` + `vitest` + `next build` (verts aujourd'hui — les verrouiller) | P2 | 🔴 |
| B2 | Seuils de qualité : `--max-warnings=0` après nettoyage des warnings résiduels ; couverture ≥ 80 % sur `lib/` et actions money | P2 | 🟠 |
| B3 | E2E Playwright : (1) smoke login → caisse → encaissement → historique paginé ; (2) tunnel `/enroll` complet ; (3) validation pré-inscription → matricule → reçu vérifiable | P2–P3 | 🔴 |
| B4 | Tests de non-régression sur les actions critiques (`createPayment`, `cancelPayment`, `validatePreEnrollment`) ; mocks `next/cache` alignés (`unstable_cache: fn => fn`) | P2 | 🟠 |
| B5 | Nettoyage lint : `window.location.href` → `router.push`, suppression `STATE_ORIENTATION_LABELS`, paramètre `formData` de `generateDueReminders` | P2 | 🟡 |
| B6 | `security-review` obligatoire sur les PR touchant auth/argent + `npm audit` en CI | P2 | 🟠 |

### 3.3 UX

| # | Action | Phase | Pri |
|---|---|---|---|
| U1 | Squelettes de chargement (Skeleton shadcn) partout où « Chargement... » est affiché ; `loading.tsx` par section du dashboard | P2 | 🟠 |
| U2 | Recherche/filtre local sur les onglets Pré-inscriptions, Tuteurs, Inscriptions (comme l'onglet Élèves) ; corriger l'intitulé « en attente » qui liste tous statuts | P2 | 🟠 |
| U3 | Feedback d'action unifié : toasts succès/échec sur toutes les Server Actions (aujourd'hui : la moitié des écrans) | P3 | 🟡 |
| U4 | Accessibilité : audit complet (contrastes, focus, `aria-live` des totaux de caisse, clavier sur tableaux) | P3 | 🟡 |
| U5 | Portail parent (suivi notes/paiements/relances) — nouveau produit | P4 | 🟡 |

### 3.4 Scalabilité

| # | Action | Phase | Pri |
|---|---|---|---|
| S1 | **Agrégats en base** : vues/RPC Postgres pour les KPI du dashboard (séries journalières, taux de recouvrement, encours) — remplacer le scan JS de toutes les lignes `payments` | P2 | 🔴 |
| S2 | Paginer en base `getEnrollments`, `getStudentBalances` et les listes de `getDirectorySnapshot` (pattern `getPayments` : opts optionnelle + `.range()` + métadonnées uniformes) | P2 | 🔴 |
| S3 | Recherche annuaire côté Postgres (`pg_trgm`/FTS + endpoint paginé) au lieu du snapshot complet en mémoire | P3 | 🟠 |
| S4 | Pagination curseur (keyset) sur l'historique des très gros volumes (au-delà de ~10 pages, `offset` se dégrade) | P3 | 🟡 |
| S5 | Streaming RSC : décrocher les sections du dashboard en `Suspense` parallèles pour afficher le premier écran plus tôt | P3 | 🟠 |
| S6 | Index DB vérifiés par `EXPLAIN` sur les colonnes paginées/filtrées (`payments.received_at`, `pre_enrollments.created_at`, `school_id` + `deleted_at`) | P2 | 🟠 |

### 3.5 Résilience

| # | Action | Phase | Pri |
|---|---|---|---|
| R1 | Observabilité : logger structuré (pino) sur les Server Actions money + ID de corrélation ; erreurs serveur remontées (Sentry) — aujourd'hui aucun logging | P2 | 🔴 |
| R2 | Rate-limiting des actions publiques (`/enroll`, `/verify`, relances) au niveau edge/middleware | P2 | 🟠 |
| R3 | Surveillance des caches : invariant « purge `updateTag` à chaque mutation money » — test d'intégration ; TTL 60 s en garde-fou, documenté dans `cache-tags.ts` | P2 | 🟠 |
| R4 | Outbox notifications : dead-letter + tableau de suivi visibles direction ; bascule SMS/WhatsApp réelle (canaux déjà présents dans les schémas) | P3 | 🟠 |
| R5 | Sauvegardes PITR Supabase + runbook de restauration testé ; plan de rapprochement des sessions de caisse orphelines | P3 | 🔴 |
| R6 | Endurance : tests de charge ciblés (pic d'encaissement, dashboard à 10 k paiements) pour valider S1/S2 | P4 | 🟡 |

### Séquencement

```
P2 (0–6 semaines) : B1 CI verrouillée · S1/S2 agrégats+pagination · R1 logging
                    · A1 découpage monolithes · U1/U2 UX quick wins · B3 smoke E2E
P3 (2–5 mois)     : A2 RSC+URL state · S3 recherche PG · S5 streaming
                    · R4 outbox complet · B3 E2E étendu · U4 a11y
P4 (5–12 mois)    : U5 portail parent · S4 keyset · R6 endurance
```

---

##4. Métriques de succès

| Indicateur | Cible |
|---|---|
| PR avec CI verte (lint + tsc + tests + build) | 100 % |
| Couverture `lib/` + actions money | ≥ 80 % |
| TTFB p95 du cockpit direction | < 500 ms |
| Taux de cache hit (Data Cache) | > 80 % |
| Durée du smoke E2E | < 5 min |
| Erreurs lint | 0 (warnings inclus après B5) |
| Incident cross-tenant / fuite de données | 0 (défaut) |

##5. Dettes suivies

1. `services/actions.ts` — validations zod à migrer (reste de P1-A).
2. ~~Monolithes `finance/actions.ts` / `admissions/actions.ts`~~ — résolu par A1 (façades 22/14 lignes + 14 modules spécialisés).
3. ~~Warnings lint résiduels : 7 warnings historiques~~ — résolu par B2-bis (`npm run lint` = `eslint . --max-warnings=0`).
4. `getEnrollments` paginé côté serveur (S2), mais la page direction fetch encore la liste complète pour ses filtres/onglets.
5. Comportement `unstable_cache` en contexte Server Action à confirmer en préproduction (le Data Cache est lu hors rendu) — sans hit, l'exécution reste correcte et le TTL 60 s borne la fraîcheur.
6. Le brouillon public conserve des PII (nom, naissance, téléphone) dans `localStorage` : comportement utile mais exposé aux XSS et aux postes partagés ; migration vers session IndexedDB chiffrée/expiration courte à concevoir.

---

##6. Suivi d'exécution

### P2 — vague 1 (livrée)

| Cible | Livrable |
|---|---|
| **B1** | `.github/workflows/ci.yml` : `npm ci` → **typecheck** + **tests** bloquants, **lint en baseline visible non bloquante** (`continue-on-error`, redevient bloquant à la fin de B2), **build** bloquant avec variables factices documentées. |
| **B5** | 4 warnings → **0** : `router.push` (×2), `STATE_ORIENTATION_LABELS` supprimée, paramètre `formData` de `generateDueReminders` retiré. |
| **R1** | `lib/server-logger.ts` (JSON structuré, zéro dép. — pino prévu en R1) + 8 points d'instrumentation : `payment.created/rejected/cancelled/cancel_failed`, `cash.closed` (warn si écart ≠ 0), `discount.applied`, `enrollment.validated/counter_completed/payment_failed`. |
| **U1** | `components/ui/skeleton.tsx` + squelette de chargement des admissions (remplace « Chargement... »). |
| **U2** | Recherche locale commune aux 4 onglets (nom, matricule, téléphone, code, niveau) avec états vides contextuels ; titre « Pré-inscriptions » corrigé. |
| **S2** | `getEnrollments(schoolId, { page, pageSize })` : pagination `.range()` + count exact, contrat uniforme, **rétrocompatible** (sans `opts` → liste complète pour les callieurs actuels). `getStudentBalances` : volontairement non paginé (usage lookup, pas de rendu). |
| **Tests** | Mock `next/navigation` ajouté à `page.test.tsx` (la page utilise `useRouter`) ; `any[]` → `unknown[]` dans les mocks du même fichier. |

**Validations P2-v1** : `tsc` 0 erreur · `next build` EXIT=0 · suite complète verte · lint des fichiers touchés 0 erreur.

### P2 — vague 2 · B2 (livrée)

| Cible | Livrable |
|---|---|
| **Baseline lint** | **137 erreurs → 0** : suppression des `any` applicatifs, contrats Supabase explicites, casts PostgREST validés, apostrophes JSX échappées, effets React rendus sans `setState` synchrone. |
| **React** | Brouillon public hydraté via `parsePreEnrollmentDraft` (parseur pur testé) ; guidance branchée à `useSyncExternalStore`, minuterie d’expiration et persistance multi-onglets conservées. |
| **CI** | Le job `Lint (bloquant)` ne contient plus `continue-on-error` : toute erreur ESLint bloque désormais la PR. |
| **Tests** | +1 test comportemental guidance ; fixture mouvements alignée sur `MovementActivation.expired`. **59 tests ciblés verts** (44 structure, 11 mouvements, 3 brouillon, 1 guidance). |

**Validations P2-v2** : suite complète **606/606** · typecheck racine 5/5 · lint global **0 erreur / 7 warnings** · build admin **EXIT=0** · 59 tests ciblés verts.

**Warnings conservés** : 7, non bloquants à ce stade (images/`alt` et configuration ESLint) ; passage à `--max-warnings=0` après une vague dédiée.

### P2 — vague 3 · A1 (livrée)

| Cible | Livrable |
|---|---|
| **Façades** | `finance/actions.ts` : **1439 → 22 lignes** ; `admissions/actions.ts` : **1202 → 14 lignes**. Les 24 exports Finance et 15 actions Admissions restent importables par les chemins historiques. |
| **Modules Finance** | `fee-schedules` (257), `payments` (260), `cash` (169), `receipts` (46), `accounting` (152), `balances` (185), `discounts` (296), `reminders` (122). |
| **Modules Admissions** | `pre-enrollments` (268), `counter-enrollments` (436), `people` (144), `enrollments` (139), `financial-profiles` (60), `directory` (35), helpers privés `_shared` (158). |
| **Sécurité** | `actions-guard.test.ts` suit désormais les **14 implémentations** au lieu de 2 monolithes ; exceptions publiques bornées à `createPreEnrollment` et `verifyReceipt`. |
| **Tests** | 2 tests de façade + 13 scénarios Admissions + 21 contrôles sécurité ; **620/620 tests** verts après extraction. |

Les fonctions ont été déplacées mécaniquement, sans réécriture métier. Aucun écran ne connaît les nouveaux chemins : tous importent encore la façade historique. Les façades sont des barrels neutres (Next 16 ne propage pas les réexports d’un fichier lui-même marqué `"use server"`), tandis que chaque implémentation conserve son directive serveur.

**Validations P2-v3** : **620/620 tests** · typecheck racine 5/5 · lint global **0 erreur / 7 warnings** · build admin **EXIT=0** · sécurité A1 revue sans blocker.

### P2 — vague 4 · B2-bis (livrée)

| Cible | Livrable |
|---|---|
| **Zéro warning** | Les 7 warnings historiques sont supprimés : 5 `<img>` DOM migrés vers `next/image` avec dimensions/`sizes`, exception PDF documentée, export ESLint nommé. |
| **CI stricte** | `npm run lint` exécute désormais `eslint . --max-warnings=0` ; toute régression warning bloque la PR. |
| **Images accessibles** | Logos SVG avec ratios explicites ; médias Trouvetou avec alternatives textuelles distinctes ; QR PDF non-DOM exclu à juste titre. |
| **Sécurité URL** | `lib/safe-url.ts` impose une allowlist `http(s)` (longueur/listes bornées, identifiants refusés) ; Zod valide les écritures profil/publicité ; lectures dashboard et API publiques filtrent les anciennes données. |
| **Observabilité** | Erreurs inattendues des routes profil/publicité journalisées côté serveur sans body ni PII, réponses client génériques. |
| **Tests** | +32 tests : URL app, schémas d’écriture, normalisation historique, alternative textuelle et helper du script Billing. |

**Validations P2-v4** : **652/652 tests** · typecheck racine 5/5 · lint global **0 erreur / 0 warning** avec seuil strict · build admin **EXIT=0**.

### P2 — vague 5 · S1 agrégats financiers (livrée partiellement)

| Cible | Livrable |
|---|---|
| **RPC d'agrégats** | Migration `20260924000000_p2_dashboard_kpis_rpc.sql` : 2 index partiels sur `payments` (`school_id, received_at` et `cash_session_id`) et `get_direction_financial_kpis(p_school_id, p_academic_year_id, p_now, p_daily_window)` — `security definer`, `search_path` figé, JSONB unique (cumul exercice, M, M-1, ventilation par mode triée, série journalière continue via `generate_series`) ; `execute` révoqué pour `public/anon/authenticated`, accordé au seul `service_role`. Idempotente (`CREATE OR REPLACE` + `IF NOT EXISTS`). |
| **Frontière typée** | Nouveau module `financial-kpis.ts` (193 lignes) : `RpcCall` en forme awaitable — supabase-js renvoie un `PostgrestFilterBuilder`, pas une `Promise` —, `parseFinancialKpis` traite le JSONB **comme une entrée non fiable** (montants finis, dates `YYYY-MM-DD`, structure stricte, toute forme inattendue → `null`) et `loadDirectionFinancialKpis` passe par `unstable_cache` avec le tag/TTL du dashboard : une seule purge `updateTag` invalide lignes et KPI. |
| **Intégration loader** | `dashboard-data.ts` (772 lignes) : `AdminLike.rpc?` optionnel, helper `sumAmountsByMethod` extrait (DRY, testé), puis **RPC d'abord** pour `collectedThisYear/ThisMonth/PreviousMonth`, `byMethod` et `daily` ; `collectedDeltaPercent` reste dérivé des deux cumuls, donc formule unique quelle que soit la source. |
| **Dégradation gracieuse** | Client sans `rpc`, erreur base ou charge utile invalide → `null` → agrégation JS historique, échec journalisé (`logServerEvent`, sans PII). Ni écran en erreur, ni KPI faux : la migration peut être déployée après le code sans fenêtre de panne. |
| **Tests** | +14 (suite **652 → 666**) : 9 sur le module (normalisation, listes vides, 5 rejets de JSONB non conforme, appel/erreur/exception, aucun appel sans RPC), 3 sur le chemin RPC du loader (KPI servi, erreur base, charge utile invalide) et 2 sur `sumAmountsByMethod`, fixtures RPC typées sans `as any`. |
| **Vérification SQL** | Migration rejouée sur la base locale **dans une transaction annulée**, fixtures incluses : cumul exercice 100 k (paiement annulé 99 k et paiement d'un autre exercice 55 k exclus), M 70 k, M-1 10 k, ventilation `cash 50 k / mobile_money 30 k / check 20 k` triée décroissante, série de 14 jours du 02/01 au 15/01 totalisant exactement le mois (70 k), branche « sans année » = 5 jours à zéro. Après `rollback` : 0 paiement, 0 fonction, 0 index — base locale intacte. |

**Validations P2-v5** : **666/666 tests** · typecheck racine 5/5 · lint global **0 erreur / 0 warning** (`--max-warnings=0`) · migration exécutée puis rollback vérifiés sur la base locale.

**Reste côté S1** : `recoveryRate`, `outstanding`/`topDebtors` et les totaux de session restent calculés en JS ; le chargement complet de `payments` est encore requis pour les soldes par inscription. Le retrait du scan suppose un second RPC (soldes par inscription + sessions de caisse) qui réutilisera les index de cette vague.

### P2 — vague 6 · S1 soldes et encours en base (S1 livrée)

| Cible | Livrable |
|---|---|
| **RPC des soldes** | Migration `20260925000000_p3_direction_balance_kpis_rpc.sql` : `get_direction_balance_kpis(p_school_id, p_academic_year_id, p_cash_session_id)` → JSONB `{ enrollment_paid[], session_paid }`. `language sql stable`, `security definer`, `search_path` figé, `execute` réservé au `service_role`. Seules les inscriptions porteuses d'un encaissement sont renvoyées : le volume transporté suit le nombre d'élèves crédités, plus le nombre de lignes de paiement. |
| **Loader** | `payments` quitte les lectures mises en cache ; les deux RPC sont interrogées **en parallèle** et une lecture de repli (`loadFallbackPayments`, jeton de cache distinct, même tag) n'est déclenchée que si un agrégat manque — client sans RPC, erreur base, charge utile invalide, soldes incohérents. Le chemin nominal ne fait plus aucun scan de `payments` (nombre d'allers-retours inchangé : 2, comme avant). |
| **Garde-fou** | Des soldes citant des inscriptions inconnues du jeu de lignes sont traités comme un échec (`direction.balance_kpis_unmatched` + repli) : un encours nul silencieusement faux est le pire scénario possible sur un tableau de bord de recouvrement. |
| **Découpage** | Nouveau `dashboard-helpers.ts` (240 lignes) : helpers purs, dates UTC et types de lignes. `dashboard-data.ts` repasse de **844 → 637 lignes**. `computeBalances` consomme désormais une `ReadonlyMap` des totaux par inscription — source unique, RPC ou repli — au lieu d'un tableau de paiements. |
| **Tests** | +12 (suite **666 → 678**) : 9 sur le module (normalisation, 5 rejets de JSONB non conforme, appel, erreur base, exception, absence de client RPC) et 3 sur le loader — dont l'assertion centrale du chemin nominal, `expect(from).not.toHaveBeenCalledWith("payments")`. |
| **Vérification SQL** | Migration rejouée sur la base locale **dans une transaction annulée** : `enrollment_paid` = 50 k pour la seule inscription créditée de l'exercice (99 k annulés et 62 k de l'autre exercice exclus), `session_paid` = 47 k (40 k + 7 k — le total de session n'est pas borné par l'exercice, comme le calcul historique), session nulle → 0. Après `rollback` : 0 paiement, 0 session, 0 utilisateur, 0 fonction. |

**Validations P2-v6** : **678/678 tests** · typecheck racine 5/5 · lint global **0 erreur / 0 warning** (`--max-warnings=0`).

**S1 est livrée** : le tableau de bord Direction ne rapatrie plus les lignes de paiement sur son chemin nominal. Le repli (base dégradée ou migration pas encore appliquée) conserve le scan historique — c'est un filet de sécurité assumé, pas le chemin normal.

### P2 — vague 7 · S2 pagination en base (S2 livrée)

| Cible | Livrable |
|---|---|
| **Contrat partagé** | Nouveau `lib/pagination.ts` : `resolvePageRequest` (bornage page/taille, neutralisation des `NaN` et fractions), `pageRange` (plage `.range()`) et `buildPageResult` (métadonnées uniformes). Le motif existait en **trois copies non testées** — il est désormais défini une fois et couvert par **11 tests**. |
| **Getters paginés** | `getStudentBalances` (nouveau `opts`), `getStudents`, `getGuardians` (nouveau `opts`) rejoignent `getPayments` / `getEnrollments` / `getPreEnrollments`, tous refactorés sur le contrat commun. Les trois getters existants passent de ~50 lignes de boilerplate à une dizaine. |
| **Bug corrigé** | `getPayments` ne demandait pas `count: "exact"` : PostgREST renvoyait `count: null`, donc `totalPages` valait **toujours 1** et l'historique de caisse n'affichait aucun lien vers la page 2. Corrigé au passage. |
| **Snapshot d'annuaire borné** | `getDirectorySnapshot` lit ses quatre listes avec `{ pageSize: MAX_PAGE_SIZE }` au lieu de rapatrier l'école entière à chaque ⌘K, et renvoie `meta { loaded, total, truncated }`. `GlobalSearch` affiche « Recherche locale limitée à N entrées sur M » quand la couverture est partielle : la dégradation est **visible**, pas silencieuse. |
| **Compatibilité** | Sans `opts`, chaque getter renvoie la liste complète et les métadonnées de page — la caisse (carte des soldes), les onglets annuaire et les dropdowns ne changent pas de comportement. Le refus de rôle expose désormais les mêmes métadonnées, donc plus de branche à trous. |
| **Tests** | +16 (suite **678 → 694**) : 11 sur le contrat de pagination (bornes, `NaN`, repli sans `count`, page hors borne ramenée à la dernière) et 5 sur le snapshot (plafond transmis aux 4 getters, couverture partielle signalée, `pageSize` excessif plafonné, refus de rôle sans lecture, getter en échec toléré). |

**Validations P2-v7** : **694/694 tests** · typecheck racine 5/5 · lint global **0 erreur / 0 warning** (`--max-warnings=0`).

**Limite assumée** : la recherche ⌘K reste une recherche **locale** sur un instantané borné. Au-delà de 100 personnes par liste, la couverture n'est plus complète — c'est ce que `truncated` signale. La suppression de cette limite suppose la recherche côté Postgres (`pg_trgm`/FTS + endpoint paginé), déjà planifiée en **S3 (P3)** ; agrandir le snapshot n'en serait pas la solution.

### P2 — reste à faire (prochaines vagues)

- **B3** : E2E Playwright (le script `test:e2e` et `playwright.config.ts` existent mais `@playwright/test` n'est pas installé — décision de dépendance à trancher).
- **R2** : rate-limiting des actions publiques.





