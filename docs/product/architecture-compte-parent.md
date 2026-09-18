# Architecture — Compte parent & autorisation scolaire

*Document de conception — Schooly / Refontiq*
*Créé le 18/09/2026 — statut : **à valider avant implémentation***

> **Objet.** Fixer une fois pour toutes la frontière entre **l'identité d'un parent** (permanente) et **son droit d'accès aux données scolaires** (temporaire, lié à une année). Ce document est la référence à lire avant de modifier quoi que ce soit dans les policies RLS, la table `guardians` ou la PWA parent.

---

## 1. La règle fondatrice

> **Le téléphone n'est pas un droit d'accès. C'est une clé d'éligibilité et un identifiant de connexion.**

Trois fonctions distinctes, trop souvent confondues :

| Fonction | Quand | Ce qu'il prouve | Ne prouve **pas** |
|---|---|---|---|
| **1. Clé d'éligibilité** | Premier accès | « Ce numéro correspond à un parent connu d'au moins une école Schooly » | Que la personne devant l'écran est bien ce parent |
| **2. Identifiant de connexion** | Chaque connexion | Rien par lui-même — il doit être **combiné à un mot de passe** | L'identité à lui seul |
| **3. Clé de rapprochement** | Récupération | Point de départ d'une procédure **validée par l'école** | Que le numéro appartient encore au parent |

**Conséquence directe** : `guardians.phone` (et son miroir `phone_norm`) ne doit **jamais** apparaître seul dans une condition d'autorisation. Il sert à *trouver* le compte, pas à *l'autoriser*.

---

## 2. Conséquence n°2 : deux durées de vie différentes

C'est le cœur de la décision. **Ce qui expire, ce n'est pas le parent, c'est son rattachement à une année scolaire.**

```
COMPTE PARENT  ─────────────────────────────────────────────►  PERMANENT
  │  (téléphone + mot de passe + identité)
  │
  └── RATTACHEMENTS SCOLAIRES ────────────────────────────►  PAR ANNÉE
        │
        ├── 2025-2026  · École A · Enfant 1 · TERMINÉE  → lecture seule
        ├── 2026-2027  · École A · Enfant 1 · ACTIVE   → accès complet
        └── 2027-2028  · En attente d'inscription      → aucun accès
```

- **Pendant les vacances** : le parent **se connecte normalement**. Il peut relire notes, bulletins et reçus de l'année écoulée. Il **ne peut pas** voir les données de l'année suivante — elles n'existent pas encore pour son enfant.
- **À la rentrée** : dès que l'école valide la nouvelle inscription, **le même compte** retrouve automatiquement l'accès complet. Le parent **ne recrée rien**, **ne rechange pas son numéro**, **ne redemande aucune autorisation**.
- **Changement d'établissement** : même compte, même connexion. Les liens sont :
  ```
  Parent
    ├── Enfant A
    │     ├── École A — 2025-2026 — terminé
    │     └── École B — 2026-2027 — actif
    └── Enfant B
          └── École A — 2026-2027 — actif
  ```

---

## 3. Cartographie de l'existant (état réel au 18/09/2026)

**Bonne nouvelle : l'architecture cible est déjà à ~80 % en place.** Le modèle actuel n'a pas besoin d'être refondu — il a besoin d'être **complété et correctement lu**.

| Brique de la cible | Existant | Écart |
|---|---|---|
| Compte parent permanent | ✅ `public.guardians` (`phone` unique, `email`, `full_name`) | — |
| Lien compte ↔ Auth | ✅ `guardians.user_id → auth.users` (migration `20260918160000`), unicité garantie | À **utiliser** : la PWA parent lie encore par `email` |
| Clé de rapprochement fiable | ✅ `guardians.phone_norm` + trigger + index (migration `20260918160000`) | — |
| Relation parent ↔ élève ↔ école ↔ année | ✅ **`public.enrollments`** porte déjà les 4 : `guardian_id`, `student_id`, `school_id`, `academic_year_id` + `status` | À **exploiter** : la PWA charge toutes les inscriptions sans filtrer l'année |
| États d'année | ✅ `academic_years.status` = `planifiee` / `en_cours` / `cloturee` | À **exposer** au parent (actif / terminé / à venir) |
| Policies RLS parent | ❌ Aucune : `guardians_member_read` et `enrollments_member_read` ne couvrent que le **personnel** (`is_school_member`) | **À créer** |
| Éligibilité au premier accès | ❌ Aucun flux : la PWA lie par email et refuse si aucun guardian ne porte cet email | **À créer** |
| Parcours « numéro perdu / changé » | ❌ Inexistant | **À créer** |

### 3.1 Point important : `enrollments` **est** la table de liaison

Il n'est **pas nécessaire** d'introduire une table `student_parent` séparée. `enrollments` joue déjà ce rôle, et le joue **mieux** : elle est *scopée par année*, ce qu'une table `student_parent` sans `academic_year_id` ne ferait pas.

```
guardians ──┐
            │ guardian_id
students ───┼──► enrollments ──┬── school_id        (quel établissement)
            │ student_id       ├── academic_year_id (quelle année)
academic_years ─────────────────┴── status          (active / terminée)
```

> **Piège à éviter** : ajouter `students.guardian_id` « pour simplifier ». Ce serait un lien **sans dimension d'année** — il rendrait un parent éternellement lié à un enfant, y compris après un changement d'établissement ou une fin de scolarité. La relation doit rester portée par `enrollments`.

---

## 4. Règle d'autorisation (à appliquer partout)

L'autorisation d'un parent se dérive **toujours** dans cet ordre, jamais autrement :

```
1. Parent authentifié          → auth.uid() → guardians.user_id = auth.uid()
2. Ses enfants                 → enrollments.guardian_id = ce guardian.id
3. Inscriptions retenues       → status ∈ ('active', 'confirmed')
4. Année sélectionnée          → academic_years.id = année demandée
5. Droits sur cette année      → en_cours      → lecture + écriture (paiements)
                                 cloturee      → LECTURE SEULE
                                 planifiee     → aucun accès (rien à montrer)
```

**Interdits absolus** (ce sont les failles à ne pas rouvrir) :

- ❌ Autoriser à partir du seul téléphone.
- ❌ Autoriser à partir de `guardians.email` (modifiable, non unique en pratique, et non vérifié).
- ❌ Faire confiance à un `enrollment_id` ou `student_id` envoyé par le client sans revérifier `guardian_id`.
- ❌ Servir les données d'une année `cloturee` en écriture.

**Le service_role reste un outil, pas une politique.** La PWA parent lit aujourd'hui via un client admin scopé applicativement (`requireGuardian()` + `.eq("guardian_id", …)`). C'est acceptable en attendant, mais la cible est un **RLS parent réel** : la sécurité ne doit pas dépendre de la discipline du code appelant.

---

## 5. Parcours d'accès du parent

### 5.1 Premier accès — le numéro **ouvre le droit**, le mot de passe **ouvre la session**

```
Parent saisit son numéro
        ↓
Schooly normalise (normalize_phone) et cherche dans guardians.phone_norm
        ↓
Numéro rattaché à au moins une inscription ?   ← ÉLIGIBILITÉ (pas authentification)
     ↙                      ↘
   NON                      OUI
    ↓                        ↓
Refus neutre          « Votre numéro est reconnu »
                              ↓
                      Le parent choisit son MOT DE PASSE
                              ↓
                      Compte parent créé (guardians.user_id → auth.users)
```

Deux verrous, deux rôles :

| Étape | Ce qu'elle empêche |
|---|---|
| **Éligibilité par téléphone** | Qu'un inconnu crée un compte parent avec un numéro au hasard : il faut être **déjà connu d'une école** |
| **Mot de passe** | Qu'un tiers ayant le numéro (SIM revendue, numéro recyclé, entourage) ouvre le compte sans le secret du parent |

> **Pourquoi le mot de passe et non un OTP permanent ?** L'OTP par SMS/WhatsApp coûte à chaque connexion et dépend d'un opérateur. Le mot de passe est gratuit, hors ligne, et surtout **il survit à la perte du numéro** (§6). L'OTP reste utile comme facteur **ponctuel** (récupération, opération sensible), pas comme moyen de connexion quotidien.

### 5.2 Connexions suivantes

`numéro + mot de passe` → session longue (90 jours), pas de re-vérification d'éligibilité. L'éligibilité n'est vérifiée **qu'une fois**, à la création du compte : elle a servi à prouver « ce numéro appartient à un parent connu ». Ensuite, c'est le couple identifiant/secret qui fait foi.

### 5.3 Ce que le parent voit selon l'année

| Année (`academic_years.status`) | Accès | Contenu |
|---|---|---|
| `en_cours` | **Lecture + écriture** | Notes, bulletins, absences, devoirs, échéancier, **paiement en ligne**, moratoires |
| `cloturee` | **Lecture seule** | Historique : notes, bulletins archivés, reçus, attestations |
| `planifiee` | **Aucun accès** | Rien à montrer : l'inscription n'est pas encore active |

Le parent dispose d'un **sélecteur d'année scolaire** en tête du dashboard. Par défaut : l'année `en_cours` s'il en a une, sinon la dernière `cloturee` (consultation d'archives en vacances).

---

## 6. Parcours « numéro perdu » ou « numéro changé »

**Règle d'or : on ne supprime jamais un compte parent, on remplace un numéro.** L'identité (parent + enfants + historique) est indépendante du numéro.

### 6.1 Cas A — le parent est encore connecté

```
Réglages → Compte → Numéro de téléphone → Modifier
        ↓
Mot de passe actuel exigé   ← ré-authentification obligatoire
        +
Nouveau numéro
        ↓
Numéro remplacé (phone + phone_norm)
        ↓
Notification à l'école : « Le numéro du parent de [élève] a été modifié. »
```

**Le mot de passe ne change pas.** Les liens parent → enfants → inscriptions → historique ne sont **pas touchés** : on modifie une colonne, pas une identité.

### 6.2 Cas B — le parent est déconnecté **et** a perdu son numéro

C'est le cas dangereux : il ne peut plus recevoir d'OTP sur l'ancien numéro. La procédure doit donc être **validée par un humain de l'école**, pas par une question secrète.

```
« Je n'ai plus accès à mon numéro »
        ↓
Le parent identifie son compte : ancien numéro + nom + nom de l'enfant
        ↓
Demande envoyée à l'établissement (statut : en attente)
        ↓
Le secrétariat / la direction vérifie en présentiel (pièce d'identité, présence de l'enfant)
        ↓
Validation dans Schooly → nouveau numéro
        ↓
Ancien numéro remplacé · compte conservé · enfants conservés · historique conservé
```

⚠️ **Interdit** : « nouveau numéro + ancien mot de passe = accès immédiat ». Sinon, quiconque connaît le mot de passe (partagé en famille, noté quelque part) et récupère un numéro recyclé par l'opérateur pourrait prendre le compte. La règle est : **un changement d'identifiant de connexion exige soit le secret actuel, soit une validation humaine de l'école.**

### 6.3 Le numéro recyclé par l'opérateur

Cas fréquent en Côte d'Ivoire : un numéro inactif est réattribué à un autre abonné. La procédure 6.2 couvre ce cas : l'école constate que le parent légitime a changé de numéro et remplace la valeur. Aucune donnée scolaire n'est exposée au nouveau détenteur du numéro, car **le numéro seul ne donne jamais accès** (§5.1 : il faut aussi le mot de passe, ou une validation humaine).

---

## 7. Dashboard parent multi-années (UX cible)

```
SCHOOLY — Compte de M. Kouassi (+225 07 …)
Année scolaire :  [ 2026-2027  ]        ← sélecteur
────────────────────────────────────────────────
  Enfant A — École X — 6ème B — ACTIF
    Notes · Bulletins · Absences · Échéancier · Payer
  Enfant B — École X — CE2 — ACTIF
────────────────────────────────────────────────
  Bascule sur 2025-2026  →  LECTURE SEULE
    Notes archivées · Bulletins publiés · Reçus
```

- **Un seul compte, une seule connexion**, tous enfants et toutes écoles confondus (§4.3 du cahier des charges).
- Le sélecteur d'année remplace la notion de « réinscription du compte » : en septembre, **rien à faire côté parent** — dès que l'école valide l'inscription, l'année apparaît comme active.
- Un enfant changeant d'établissement n'ajoute qu'une ligne : `École B — 2026-2027 — actif` à côté de `École A — 2025-2026 — terminé`.

---

## 8. Cible RLS : l'autorisation portée par la base

Aujourd'hui la PWA lit via `service_role` + filtre applicatif. La cible est un RLS qui rend l'erreur **impossible** si le code appelant oublie un filtre. Trois helpers suffisent :

```sql
-- 1. Le guardian du parent connecté (0 ou 1 ligne grâce à guardians_user_id_unique)
create or replace function public.current_guardian_id() returns uuid …

-- 2. Ce parent a-t-il une inscription sur cette ligne ?
--    (revérifie TOUJOURS guardian_id côté base, jamais côté client)
create or replace function public.parent_owns_enrollment(p_enrollment uuid) returns boolean …

-- 3. L'année de cette inscription autorise-t-elle l'écriture ?
--    en_cours → true · cloturee / planifiee → false
create or replace function public.parent_can_write_enrollment(p_enrollment uuid) returns boolean …
```

Policies correspondantes (esquisse) :

| Table | SELECT parent | INSERT/UPDATE parent |
|---|---|---|
| `guardians` | sa propre fiche (`user_id = auth.uid()`) | sa fiche, hors `phone` (le numéro se change par le parcours §6) |
| `enrollments` | `parent_owns_enrollment(id)` | jamais (l'école seule inscrit) |
| `students` | si un `enrollment` de ce parent le référence | jamais |
| `academic_years` | si un `enrollment` de ce parent la référence | jamais |
| `payments` / `receipts` | si `parent_owns_enrollment(enrollment_id)` | paiement en ligne uniquement, si `parent_can_write_enrollment(...)` |
| notes / bulletins / absences | via `enrollment` + année `en_cours` **ou** `cloturee` | jamais |

**Principe de moindre privilège** : le parent ne dispose d'**aucune** écriture sur les données académiques. Il ne peut écrire que sur sa propre fiche (coordonnées) et, dans une année `en_cours`, déclencher un paiement.

---

## 9. Plan d'implémentation

| # | Chantier | État |
|---|---|---|
| 1 | `guardians.phone_norm` + trigger + index | ✅ livré (`20260918160000`) |
| 2 | `guardians.user_id → auth.users` + unicité | ✅ livré (`20260918160000`) |
| 3 | Helpers `current_guardian_id` / `parent_owns_enrollment` / `parent_can_write_enrollment` | ✅ écrite (`20260918190000`) — à appliquer |
| 4 | Policies RLS parent (select/insert) + grants | ✅ écrite (`20260918190000`) — à appliquer |
| 5 | Table `parent_account_change_requests` (parcours §6.2) | ⏳ à cadrer |
| 6 | PWA : lien par `user_id` au lieu de `email` | ⏳ à faire |
| 7 | PWA : sélecteur d'année + mode lecture seule | ⏳ à faire |
| 8 | Écran secrétariat : valider une demande de changement de numéro | ⏳ à faire |
| 9 | Flux de création de compte (éligibilité → mot de passe) | ⏳ à faire |

**Ordre recommandé** : 3 → 4 (sécuriser la base) → 6 (la PWA cesse de dépendre de `email`) → 7 (multi-années) → 5 + 8 (numéro perdu) → 9 (création de compte complète).

> **Note importante** : les points 6 et 7 sont **indépendants** du SQL et corrigent deux fragilités déjà présentes — la PWA parent lie aujourd'hui le compte par `email` (`requireGuardian()` → `.eq("email", user.email)`), alors que `user_id` existe désormais ; et elle charge **toutes** les inscriptions sans filtrer l'année, donc elle affichera bientôt des données d'années clôturées comme si elles étaient actives.

---

## 10. Résumé pour la présentation aux établissements

> « Votre numéro de téléphone vous identifie auprès de l'école, mais ne donne pas accès aux notes à lui seul. Vous créez votre compte **une seule fois** : à partir de là, vous vous connectez avec votre numéro et votre mot de passe, pour **tous vos enfants et toutes leurs écoles**. Chaque rentrée, vous n'avez rien à recréer : dès que l'école a validé l'inscription, vous voyez la nouvelle année. L'ancienne reste consultable en lecture seule (notes, bulletins, reçus). Et si vous changez ou perdez de numéro, votre compte, vos enfants et tout leur historique sont conservés — l'école valide simplement le nouveau numéro. »
