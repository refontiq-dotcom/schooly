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
| **P1 — majeur** | 4 | Portail élève inaccessible ; aucun contrôle de rôle ; IDOR possible ; PIN en clair |
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

### P1-1 · Portail élève inaccessible (double blocage)

`/dashboard/eleve` s'authentifie **par cookie httpOnly** (`schooly_student_enrollment`),
car les élèves n'ont pas de compte `auth`. Mais il est bloqué deux fois :

1. `proxy.ts` : pas de session → `307 /login` ;
2. `apps/schooly/src/app/dashboard/layout.tsx` : `getUser()` null → `redirect("/login")`.

Vérifié : `/dashboard/eleve → 307 /login`. La fonctionnalité QR (module *Vie
scolaire*), déjà implémentée, est **inutilisable en production**.

**Correctif** (nécessite un choix produit) : sortir le portail élève de
l'arborescence `/dashboard` (route group dédié) **ou** rendre le `layout`
conscient de la session élève. Le portail ne doit pas afficher la navigation staff
(voir P2-4).

### P1-2 · Aucun contrôle de rôle dans les Server Actions métier

Mesure : seules **3 actions sur ~100** vérifient un `role_code`.

| Module | Actions « authentifié seulement », sans rôle |
|---|---|
| `pedagogie/actions.ts` | 17 |
| `services/actions.ts` | 14 |
| `admissions/actions.ts` | 12 |
| `finance/actions.ts` | 11 |
| `academic-structure/actions.ts` | 10 |
| `finance/moratoriums/actions.ts` | 7 |
| `billing/actions.ts` | 7 sur 8 |
| `eleve/actions.ts` | 3 |

Conséquence concrète : **un professeur peut saisir des notes et valider des
pré-inscriptions ; un parent, un élève, une caisse ou un surveillant peuvent
créer un barème de frais, générer un export comptable ou une décision
académique** — dès lors qu'ils sont authentifiés dans cette école. Le cloisonnement
*inter-écoles* tient (le `school_id` vient du rôle, pas du formulaire) ; c'est le
cloisonnement *inter-rôles* qui est absent.

**Exemple mesuré** (`createFeeSchedule`) :

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: "Non autorisé" }          // ← seule garde
const roleData = await getSchoolId(user.id)          // ← ne lit PAS role_code
if (!roleData?.school_id) return { error: "Aucune école rattachée" }
// puis insert via service_role (contourne la RLS)
```

**Le bon pattern existe déjà** et doit devenir la règle
(`academic-structure/rollover-actions.ts`) :

```ts
const { data: role } = await supabase.from("user_school_roles")
  .select("school_id, role_code").eq("user_id", user.id).eq("is_active", true)
  .in("role_code", ["direction", "super_admin"]).limit(1).maybeSingle()
if (!role) throw new Error("UNAUTHORIZED")
```

### P1-3 · IDOR : consentement d'inscription modifiable hors de son école

`academic-structure/rollover-actions.ts → setEnrollmentDecision(enrollmentId, decision)`
écrit un `enrollment_decision` **sans vérifier que l'inscription appartient à
l'école du demandeur**, puis **supprime** l'enrollment ciblé (destruction de
données inter-tenant).

**Correctif** : charger l'enrollment et comparer `school_id` au rôle avant
d'écrire (même vérification que `validatePreEnrollment`, qui, lui, est correct).

### P1-4 · Secret : `public.users.pin_hash`

`pin_hash` est exposé par `/api/debug` et présent dans une table lisible sous RLS.
Cette colonne sert de code de connexion (élève/parent). À vérifier en base puis :
- remplacer par `crypt(pin, gen_salt('bf'))` (pgcrypto, déjà disponible) ;
- imposer un PIN ≥ 6 chiffres et une limitation du nombre d'essais.
---

## 4. P2 — dette et durcissements

| # | Finding | Correctif |
|---|---|---|
| P2-1 | **Hachage dupliqué** : hachage du PIN dans `dashboard/pedagogie/actions.ts` (périmètre incorrect) | Extraire dans `src/lib/pin.ts` (dépendance circulaire pédagogie ⇄ vie scolaire) |
| P2-2 | **Autorisation dupliquée** : 4 variantes de `getSchoolId()`, table de rôles recopiée **en dur** dans 4 fichiers (`lib/nav.ts` = source de vérité, `login/actions.ts`, `proxy.ts`, `api/v1/admin/trouvetou/*`) | Un helper unique `requireRole()` + table unique (fait pour le routage : `route-rules.ts`) |
| P2-3 | **Appel DB (service_role) dans le proxy** à chaque requête sur `/` et `/login` | Lire les claims JWT via `public.custom_access_token_hook` (déjà écrit : migration `20260908100000_auth_hooks.sql`) |
| P2-4 | **`dashboard/layout.tsx` ignore le rôle** : la nav élève/parent propose des liens `pedagogie`/`caisse` | Gating serveur de la navigation |
| P2-5 | **Frontière « public » assumée** : `/enroll/[schoolId]` et `/verify/[code]` sont des routes du dépôt, publiques par nature. Leur garde repose sur le proxy (rétabli) et, pour les reçus, sur le **secret du code** (128 bits, non énumérable) | OK après correctif P0-2 ; garder l'aléa du code de reçu à 128 bits |
| P2-6 | **`api/v1/public/*`** : `verifyToken` / `/availability` implémentés **en double** et incohérents (`getUser()` mal utilisé) | Mutualiser un helper d'authentification Bearer unique |

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
2. **P1-2** — généraliser `requireRole()` : ✅ **Finance fait** (18/18 actions,
   cf. §7) ; puis **Pédagogie + Admissions** (29 actions, impact notes/diplômes).
3. **P1-1 / P1-3** — débloquer le portail élève ; fermer l'IDOR du rollover.
4. **P1-4** — hachage des PIN (pgcrypto) + limitation des tentatives.
5. **P2-1/2/3** — unifier `requireRole()`, source unique des rôles, claims JWT.
6. Puis **module par module** : `admissions`, `pedagogie`, `finance`, `billing`,
   `vie scolaire (QR)`, `services`, `trouvetou`, `super-admin`, `pwa-parent`.

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
## 7. Annexe — reproductibilité

```bash
# P0-1 : fuite sans authentification (AVANT correctif)
curl -s localhost:3000/api/debug | jq '.authUsers | length'   # → 7

# P0-2 : tunnels publics (AVANT correctif)
curl -so /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3000/register-school
# → 307 http://localhost:3000/login

# APRES correctif : les tunnels répondent, /api/debug disparaît,
# et les espaces protégés redirigent toujours vers /login.
npx vitest run --project schooly
# ✓ apps/schooly/src/utils/supabase/route-rules.test.ts                  (27 tests)
# ✓ apps/schooly/src/app/dashboard/direction/onboarding-actions.test.ts  (17 tests)
```