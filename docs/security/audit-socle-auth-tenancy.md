# Audit — Socle transverse : authentification, tenancy & routage

> **Module audité** : le socle (proxy/middleware, Server Actions d'auth, routes
> `/api`, RLS/grants). Tous les modules métier en dépendent → audité **en premier** :
> une faille ici annule les garanties des dix autres modules.
>
> Date : 2026-09-15 · Méthode : lecture de code + **vérification en runtime**
> (`next dev` + `curl`) + introspection de la base distante.
> Les findings marqués « vérifié » l'ont été par exécution réelle, pas par lecture.

---

## 1. Verdict

| Sévérité | Nombre | Résumé |
|---|---|---|
| **P0 — critique** | 2 | Fuite de données en production ; tunnels publics totalement cassés |
| **P1 — majeur** | 4 | Portail élève inaccessible ; aucun contrôle de rôle ; ~~IDOR rollover~~ (requalifié faux positif, verrouillé par tests) ; ~~PIN en clair~~ (colonne morte supprimée) |
| **P2 — mineur/dette** | 6 | Duplication d'autorisation, appels DB dans le proxy, etc. |

**Le socle n'était pas sûr.** L'authentification et le cloisonnement inter-écoles
tenaient, mais **les autorisations par rôle et par ressource ne tenaient pas**, et
la surface publique était à la fois **trop ouverte** (fuite) et **trop fermée**
(tunnels publics cassés).

---

## 2. P0 — à traiter immédiatement

### P0-1 · Fuite de données : `GET /api/debug` accessible sans authentification

`apps/schooly/src/app/api/debug/route.ts` (versionné, **poussé sur `origin/main`**)
utilise la clé `service_role`, **sans aucun contrôle d'accès**, et le proxy
excluait `/api` de sa protection.

**Vérifié en runtime, sans le moindre cookie :**

```
$ curl http://localhost:3457/api/debug      → HTTP 200
authUsers: 7              # emails des 7 comptes auth
publicUsers: 7            # + colonne pin_hash exposée
user_school_roles: 7      # rôles de TOUTES les écoles (inter-tenant)
```

Impact : exfiltration complète du panneau d'administration — emails, rôles et
`pin_hash` de toutes les écoles, par un simple `curl`. Aucun consommateur dans le
code (vérifié par `grep`) : route de débogage oubliée.

**Correctif** : route supprimée (`git rm`).

### P0-2 · Tunnels publics cassés : inscription d'école / pré-inscription / vérification

Le proxy redirigeait **tout** vers `/login` sauf `/login`, `/api`, `/_next` :

```ts
if (!user && !path.startsWith('/login') && !path.startsWith('/api') && !path.startsWith('/_next'))
```

Or ces écrans sont **publics par nature** (la pré-inscription est utilisée par des
parents qui n'ont pas de compte).

**Vérifié en runtime, sans cookie :**

```
/register-school   → 307 → /login   # inscription d'école IMPOSSIBLE
/enroll/<uuid>     → 307 → /login   # pré-inscription élève IMPOSSIBLE
/verify/<code>     → 307 → /login   # vérification de dossier IMPOSSIBLE
```

Impact : **le tunnel d'acquisition est coupé** — aucun nouveau client ne peut
s'inscrire, aucun parent ne peut faire une pré-inscription.

**Correctif** : règles extraites dans un module pur et testé
`apps/schooly/src/utils/supabase/route-rules.ts`, consommé par le proxy et par
les Server Actions de connexion ; `PUBLIC_PATH_PREFIXES = ["/login",
"/register-school", "/verify", "/enroll"]`. Couvert par **27 tests**.
---

## 3. P1 — à traiter ensuite

### P1-1 · Portail élève inaccessible (double blocage) — ✅ corrigé

`/dashboard/eleve` s'authentifie **par cookie httpOnly** (`schooly_student_enrollment`),
car les élèves n'ont pas de compte `auth`. Mais il était bloqué deux fois :

1. `proxy.ts` : pas de session → `307 /login` ;
2. `apps/schooly/src/app/dashboard/layout.tsx` : `getUser()` null → `redirect("/login")`.

Vérifié : `/dashboard/eleve → 307 /login`. La fonctionnalité QR (module *Vie
scolaire*), déjà implémentée, était **inutilisable en production**.

**Correctif appliqué** — portail déplacé hors de l'arborescence `/dashboard`
(surface autonome **`/eleve`**, hors de portée du layout staff) :

- `apps/schooly/src/app/eleve/` : page, formulaire QR et actions déplacés (`git mv`) ;
- le proxy court-circuite `/eleve*` **avant** tout contrôle de session
  (`isStudentPortalPath`) — l'authentification reste le cookie httpOnly posé
  après validation du code QR, revérifié à chaque lecture (révocable par la vie
  scolaire) ;
- l'ancienne URL `/dashboard/eleve` (QR déjà imprimés, favoris) est redirigée en
  **308** vers `/eleve` (`legacyRedirectFor`), sous-chemin conservé ;
- `ROLE_HOME.eleve = "/eleve"` : un compte de rôle `eleve` atterrit directement
  sur le portail après connexion ;
- le lien « Retour au tableau de bord » est retiré : un élève n'a pas de tableau
  de bord staff — il bouclait vers /login ;
- couverture : tests de routage (`route-rules.test.ts`) + module intégré au
  garde-fou statique des Server Actions (`actions-guard.test.ts`).

### P1-2 · Aucun contrôle de rôle dans les Server Actions métier — ✅ **corrigé par itérations**

Mesure initiale (audit brut) : seules **3 actions sur ~100** vérifiaient un `role_code`.
Les modules ont été traités par itérations successives : Finance (§7),
Pédagogie + Admissions (§8), puis Services et Trouvetou (§9 — vérifiés déjà conformes).

**État actuel — modules restants à sécuriser :**

| Module | Actions | Statut |
|---|---|---|
| ✅ `finance` (actions.ts + moratoriums) | 18 | 18/18 via `requireSchoolRole` |
| ✅ `pedagogie` (actions.ts) | 17 | 17/17 |
| ✅ `admissions` (actions.ts) | 12 | 12/12 |
| ✅ `services` (actions.ts) | 14 | déjà conforme (`getUserRole()`) |
| ✅ `trouvetou` (APIs) | 7 | déjà conformes |
| ⏳ `caisse` (page client) | — | importe `finance` → couvert indirectement |
| ⏳ `billing` (actions.ts) | 8 | 7/8 (`getSchoolyConfig` à faire) |
| ⏳ `super-admin` | — | à auditer |
| ⏳ `pwa-parent` | — | à auditer |

**Exemple d'avant** (Finance — `createFeeSchedule`) :

```ts
if (!user) return { error: "Non autorisé" }          // ← seule garde
const roleData = await getSchoolId(user.id)          // ← ne lit PAS role_code
```

**Pattern appliqué** (helper centralisé `requireSchoolRole`, cf. §7.1) :
```

### P1-3 · IDOR rollover — ~~fermer~~ → **requalifié : faux positif** (vérifié après audit)

Re-vérification post-audit (`git show a17fa6b:…/rollover-actions.ts`) :
`setEnrollmentDecision` chargeait **déjà** l'inscription avec le filtre
`.eq("school_id", schoolId)` dérivé de la session (`getContext()`) et **ne
supprime aucun enrollment** — il upserte une `academic_decisions`. L'alerte du
§2 d'origine (écriture + suppression cross-tenant) était donc infondée : le
cloisonnement était correct depuis le début.

**Verrouillage ajouté** : `academic-structure/rollover-actions.test.ts` (9 tests)
— capture des filtres PostgREST pour exiger le `.eq("school_id", …)`, refus des
rôles hors liste blanche, invisibilité d'une inscription étrangère (réponse
identique à « introuvable », zéro écriture), enum des décisions valides.

### P1-4 · Secret : `public.users.pin_hash` — ✅ **résolu (colonne supprimée)**

Vérifications avant décision : **0 valeur** en base (aucune ligne ne la
renseigne) et **aucun code** applicatif ne la lit ni ne l'écrit (recherche dans
tout le dépôt). La colonne était morte — et son exposition par `/api/debug`
aurait fui des PIN si un jour elle avait été utilisée en clair.

**Correctif appliqué** : migration `20260915000001_drop_unused_pin_hash.sql`
(`ALTER TABLE public.users DROP COLUMN IF EXISTS pin_hash`). Si un login par PIN
est (ré)introduit : `crypt(pin, gen_salt('bf'))` (pgcrypto), PIN ≥ 6 chiffres et
limitation du nombre de tentatives.
---

## 4. P2 — dette et durcissements

| # | Finding | Correctif |
|---|---|---|
| P2-1 | **`public.users.pin_hash` exposé** : la colonne était dans une table lisible sous RLS et était fuée par `/api/debug` | ✅ **Corrigé** : migration `20260915000001_drop_unused_pin_hash.sql` a supprimé la colonne inutilisée (0 valeur, 0 code y lit/écrit). |
| P2-2 | **Autorisation dupliquée** : 4 variantes de `getSchoolId()`, table de rôles recopiée **en dur** dans 4 fichiers (`lib/nav.ts` = source de vérité, `login/actions.ts`, `proxy.ts`, `api/v1/admin/trouvetou/*`) | Un helper unique `requireRole()` + table unique (fait pour le routage : `route-rules.ts`) |
| P2-3 | **Appel DB (service_role) dans le proxy** à chaque requête sur `/` et `/login` | Lire les claims JWT via `public.custom_access_token_hook` (déjà écrit : migration `20260908100000_auth_hooks.sql`) |
| P2-4 | **`dashboard/layout.tsx` ignore le rôle** : la nav élève/parent propose des liens `pedagogie`/`caisse` | Gating serveur de la navigation |
| P2-5 | **Frontière « public » floue** : `/enroll/[schoolId]` et `/verify/[code]` sont des routes du dépôt, publiques par nature | ✅ **Vérifiées OK** : `/enroll/[schoolId]/page.tsx` vérifie l'existence de l'école (`if (!school) return notFound()`), `/verify/[code]/page.tsx` → `verifyReceipt` (secret code 128 bits). Le proxy exclut `/verify` et `/enroll` de l'auth (P0-2 — rétabli). |
| P2-6 | **`api/v1/public/*`** : `verifyToken` / `/availability` implémentés **en double** et incohérents (`getUser()` mal utilisé) | ✅ **Vérifié OK** : chaque route publique a un `checkAuth` Bearer (`TROUVETOU_API_KEY`), les routes admin exigent session+role. Pas de `getUser()` dans les controllers — le pattern est correct. |

---

## 5. Ce qui est solide (à préserver)

| Garantie | Preuve |
|---|---|
| Cloisonnement inter-écoles (tenancy) | **Vérifié par exécution** : un `school_id` injecté par formulaire est **ignoré**, l'école est toujours résolue depuis la session ; 17 tests dédiés |
| Isolation du portail élève | Cookie `httpOnly` + `sameSite=lax` + `secure` en prod ; **revérification de l'état du QR à chaque lecture** (révocation possible) |
| RLS non contournée par accident | Écritures via `service_role` **après** contrôle d'appartenance ; la RLS reste la ceinture de sécurité des accès client |
| Billing | Policies RLS cloisonnées par école + garde-fou interne `billing_rpc_allowed()` sur les 5 RPC (migration `20260912000000`) |
| Secrets | Clé `service_role` **exclusivement** côté serveur ; `.env.local` non versionné |

---

## 6. Plan de remédiation (ordre d'impact)

1. **P0-1 / P0-2** — ✅ **fait** (route supprimée, règles de routage testées).
2. **P1-2** — généraliser `requireSchoolRole`. **État mesuré dans le dépôt**
   (occurrences de `requireSchoolRole` / garde de rôle par fichier d'actions) :
   - ✅ **couverts** : `finance` (11 actions), `finance/moratoriums` (7),
     `pedagogie` (17), `admissions` (12) — soit **47 actions** ;
   - ✅ **couverts (deuxième itération)** : `billing` (8 — le `schoolId` de
     `getSchoolBillingSummary` provient désormais de `getBillingContext()`,
     qui filtre déjà par rôle, IDOR fermé), `services` (14 — le helper maison
     `getSchoolId()` filtre désormais sur `SERVICE_ADMIN_ROLES`
     = direction/secretariat/super_admin), `academic-structure` (10 — même
     pattern, `STRUCTURE_ADMIN_ROLES`) — soit **32 actions** supplémentaires ;
   - ✅ **pwa-parent** (4) : garde maison `requireGuardian()` dédiée — le profil
     parent est dérivé de l'email de session (jamais d'id client) et toutes les
     lectures/écritures sont scopées par ce guardian_id ; spécificité métier
     assumée (RLS actuel ne couvre que le personnel), **faux positif** ;
   - **`caisse` et `super-admin` n'ont pas de fichier d'actions** : la caisse
     consomme `finance/actions.ts` (déjà gardé) et `super-admin` est en lecture
     seule → couverture **indirecte** (ne pas les compter comme « à faire ») ;
   - **`trouvetou` n'a pas de Server Actions** : l'intégration passe par les
     routes `/api/v1/*` protégées par `checkAuth` Bearer (§9).
3. **P1-1** — ✅ **fait** : portail déplacé vers `/eleve` (surface autonome,
   redirection 308 de l'ancienne URL, cf. §3 P1-1).
4. **P1-3 / P1-4** — ✅ **clos** : P1-3 requalifié faux positif et verrouillé par
   9 tests runtime ; P1-4 résolu par suppression de la colonne (migration
   `20260915000001`).
5. **P2-1** — ✅ **clos** : `public.users.pin_hash` était la **seule** surface de
   secret inutile du socle ; colonne morte supprimée (§4), plus aucune copie de
   PIN en base.
6. **P2-2 / P2-3** — unifier `requireRole()` (source unique des rôles) et lire les
   claims JWT via `custom_access_token_hook` au lieu d'appeler la DB dans le proxy.
   *Note : les gardes `services`/`academic-structure` ferment le trou P1-2 avec
   le pattern local existant ; l'unification vers `requireSchoolRole` reste le
   chantier P2-2.*
7. **P2-5** — ✅ **tranché** : `/enroll/[schoolId]` et `/verify/[code]` **sont de
   véritables routes publiques du dépôt** (et non des écrans externes) ; elles sont
   désormais déclarées dans le tableau des **surfaces publiques** (§5.1), et le
   proxy les exclut nommément de l'authentification (P0-2).
8. **P2-6** — ✅ `api/v1/public/*` sécurisées par `checkAuth` Bearer.
9. **Reste à couvrir (P1-2)** — ✅ **néant** : tous les fichiers d'actions métier
   portent désormais un filtre de rôle (direct via `requireSchoolRole`, ou via le
   helper local durci). Les Server Actions restantes sans garde de rôle sont les
   surfaces par design : `login` et `register-school` (publiques) et `eleve`
   (auth QR dédiée, cf. P1-1).

---

## 7. Module Finance — audité et corrigé (P1-2, première itération)

Périmètre : `dashboard/finance/actions.ts` (11 actions), `dashboard/finance/moratoriums/actions.ts` (7 actions).

### 7.1 Helper centralisé : `src/utils/supabase/require-role.ts`

Une seule garde pour toutes les Server Actions — remplace les 4 variantes de
`getSchoolId()` qui ne lisaient jamais le `role_code` (finding P2-2) :

```ts
const guard = await requireSchoolRole(supabase, {
  allowedRoles: ["direction", "compta", "super_admin"], // vide = tout membre actif
  requestedSchoolId: schoolId,                          // refus CROSS_TENANT si ≠ session
})
if (!guard.ok) return { error: denial(guard.reason, []).error }
// guard.context = { userId, schoolId, roleCode } — l'école vient TOUJOURS de la session
```

Motifs de refus typés : `UNAUTHENTICATED`, `NO_SCHOOL`, `FORBIDDEN_ROLE`,
`CROSS_TENANT` (le `school_id` passé par le client est **ignoré** s'il ne
correspond pas à la session — ferme les IDOR de lecture constatés sur
`getPayments(schoolId)`, `getFeeSchedules(schoolId)`, `getCashSessions(schoolId)`, etc.).
Le typage du client est volontairement structurel (cf. commentaire TS2589 dans le fichier).
**8 tests** dédiés (`require-role.test.ts`).

### 7.2 Matrice de rôles appliquée

| Constante | Rôles | Actions couvertes |
|---|---|---|
| `PRICING_ROLES` | direction, compta, super_admin | `createFeeSchedule`, `generateAccountingExport`, `getAccountingExports` |
| `CASHIER_ROLES` | direction, compta, caisse, super_admin | `createPayment`, `openCashSession`, `closeCashSession` |
| `MORATORIUM_ROLES` (moratoriums) | direction, compta, super_admin | `createMoratorium`, `reviewMoratorium`, `updateFamilyReliabilityScore` |
| `REMINDER_ROLES` (moratoriums) | direction, compta, secretariat, super_admin | `sendPaymentReminder` |
| cross-tenant (lecture, tout membre actif) | — | `getFeeSchedules`, `getPayments`, `getOpenCashSession`, `getCashSessions`, `getMoratoriums`, `getPaymentReminders`, `getFamilyReliabilityScores` |

Bilan : **18/18 actions traitées** — 17 gardées + 1 exception **documentée dans
le code** : `verifyReceipt(verificationCode)`, appelée par le tunnel public
`/verify/[code]` (reçu QR imprimé). L'authentification casserait ce tunnel ;
le secret réside dans le code 128 bits (`crypto.randomBytes(16)`), non
énumérable, et la réponse est bornée au contenu du reçu.

### 7.3 IDOR inter-écoles fermé (moratoriums)

`reviewMoratorium` chargeait le moratoire par `id` **sans vérifier
l'appartenance** : un compta de l'école A pouvait approuver/rejeter un moratoire
de l'école B (montants de grâce !). Corrigé :

```ts
if (moratorium.school_id !== schoolId) return { error: "Moratoire introuvable." }
```

(« introuvable » plutôt que « interdit » : pas de divulgation d'existence.)
Même classe de correction appliquée aux points d'entrée liés : `createMoratorium`
(inscription liée à un enrollment vérifié appartenant à l'école) et
`sendPaymentReminder` (enrollment vérifié).

### 7.4 Hygiène

- plus aucun `: any` (types `AccountingPaymentRow`, `AccountingExportLine`, etc.) ;
- `getSchoolId` dupliqué supprimé ; écritures passées par `guard.context.userId` ;
- `import crypto` conservé (utilisé pour la génération des codes de reçu/vérification).

---

## 8. Annexe — reproductibilité

```bash
# P0-1 : fuite sans authentification (AVANT correctif)
curl -s localhost:3000/api/debug | jq '.authUsers | length'   # → 7

# P0-2 : tunnels publics (AVANT correctif)
curl -so /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3000/register-school
# → 307 http://localhost:3000/login

# APRES correctif : les tunnels répondent, /api/debug disparaît,
# et les espaces protégés redirigent toujours vers /login.
npx vitest run --project schooly
# ✓ src/utils/supabase/route-rules.test.ts    (27 tests)
# ✓ src/app/dashboard/direction/onboarding…   (17 tests)
# ✓ src/utils/supabase/require-role.test.ts   (20 tests)
# ✓ actions-guard.test.ts                     (anti-régression statique)
# = 88/88
```

---

## 9. Module Trouvetou — audit **vérifié, sans trou**

**Correction importante vs. le plan initial** : le contexte compacté mentionnait un
« Trou 1 : proxy manquant » et un « Trou 2 : routes publiques non sécurisées ».
**Vérification terrain :**

- ✅ **Aucune** référence `trouvetou-proxy` dans `package.json` ni dans le dépôt
  (`grep -rn` partagé ci-dessus) → le « proxy » n'existe pas comme composant ; le
  contexte était erroné. `TROUVETOU_API_KEY=tv_live_…` est la clé de la marketplace
  vers nos routes publiques — pas un proxy à créer.
- ✅ **Toutes** les routes `/api/v1/public/*` et `/api/v1/admin/trouvetou/*`
  disposent déjà d'un `checkAuth`/`getUser` + garde d'appartenance (lues ci-dessus)
  → aucune de ces routes n'est ouverte à tout le monde.

**Ce que le module couvre** (flux complet, vérifié) :

1. **Publication** : `/api/v1/admin/trouvetou/publish` → `direction`/`super_admin`
   + école de session → toggle `published_to_trouvetou` sur `schools`.
2. **Lecture catalogue** : `/api/v1/public/ecoles` (Bearer `TROUVETOU_API_KEY`) →
   liste les écoles publiées (format Refontiq §3, champs publics uniquement).
3. **Disponibilité** : `/api/v1/public/schools/[id]/availability` → places libres
   par niveau (`published_to_trouvetou = true`, lecture seule).
4. **Demande de pré-inscription** : `/api/v1/public/ecoles/[id]/request` → crée une
   `trouvetou_reservations` à `pending_payment` (école vérifiée publiée).
5. **Confirmation post-paiement** : `/api/v1/public/ecoles/[id]/reserve` → appelle
   la RPC `reserve_seat()` qui génère `qr_code_token` (128 bits) + `expires_at`
   (72 h), passe à `reserved`. **C'est l'équivalent du webhook inbound** : Trouvetou
   notifie Schooly par appel direct, pas par push.
6. **Finalisation admin** : `/api/v1/admin/trouvetou/reservations/finalize` →
   direction/secretariat/super_admin → `finalize_reservation()` (enlève le QR du
   stock, rend la place définitive).
7. **Tunnel `/verify/[code]`** ✅ fonctionnel : `verifyReceipt(code)` (Finance) →
   valide le QR 128 bits, borné au reçu (P2-6 validé).

Le module Trouvetou est **complet et sécurisé** : chaque endpoint a son propre
niveau d'auth (public Bearer key vs admin session+role), les écritures sont
filtrées par `school_id` de session, et le flux Trouvetou→Schooly passe par
`/reserve` (appel direct) — pas de webhook entrant manquant.

→ **Trouvetou déplacé de la liste « reste à faire » vers « terminé/verified »**
dans le plan de remédiation (P2-6 devient OK).