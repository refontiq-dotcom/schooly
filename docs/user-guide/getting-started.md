# Guide de démarrage rapide — Schooly

**Version** : 1.3  
**Dernière mise à jour** : 18 septembre 2026  
**Public** : Direction d'établissement, comptabilité, secrétariat

---

## 1. Prérequis

| Outil | Version | Utilité |
|-------|---------|---------|
| Node.js | ≥ 20 | Runtime (pnpm/npm) |
| pnpm | ≥ 9 | Gestionnaire de paquets (monorepo) |
| Supabase CLI | ≥ 2.116 | Migrations, seed, edge functions |
| Git | ≥ 2.40 | Versioning |

---

## 2. Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/refontiq-dotcom/schooly.git
cd schooly

# 2. Installer les dépendances
pnpm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés Supabase (remote ou local)

# 4. Démarrer l'admin (port 3000)
pnpm dev:admin

# 5. Démarrer la PWA Parent (port 3001, optionnel)
pnpm dev:parent
```

### 2.1 Environnement déjà en service — mise à jour

Sur une installation qui tourne déjà (école déjà en production, base déjà remplie),
les évolutions du 18/09/2026 s'appliquent avec **un seul script**, sans
redéploiement ni perte de données :

```
packages/db/supabase/migrations/20260918180000_catchup_18_09.sql
```

1. Ouvrir Supabase → **SQL Editor**, coller le contenu du fichier, exécuter.
2. Le script est **idempotent** : le relancer ne casse rien (utile si l'on ne sait
   plus ce qui a déjà été appliqué).
3. Se **déconnecter puis reconnecter** chaque utilisateur (le temps que la session
   soit relue).
4. Vérifier `/api/health` → `"db": "connected"`.

Il ajoute les colonnes du parcours d'inscription (lien de parenté, contact
d'urgence, scolarité antérieure, type d'inscription, orientation État, origine du
dossier), la normalisation des téléphones et les droits de lecture manquants.
Le détail est dans `docs/deployment/migrations-18-09.md`.

> **Si l'onglet Structure académique affiche « Aucune école rattachée »** pour un
> compte pourtant rattaché, c'est que ce script n'a pas encore été appliqué — voir
> la FAQ (§9).

---

## 3. Configuration initiale (Onboarding Wizard)

À la première connexion, Schooly guide l'établissement à travers 4 étapes :

### Étape 1 — Informations de l'école
- Nom, ville, type (primaire / secondaire / mixte)
- Code MENA/DRENA (pour le rappel d'inscription nationale)

### Étape 2 — Structure académique
- Année académique en cours
- Niveaux proposés (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Tle)
- Classes par niveau

### Étape 3 — Configuration de l'inscription ⭐ *Nouveau en v1.2*
- **Checklist de fournitures** : pré-remplie avec valeurs par défaut (rame A4, feutres, kit tenue scolaire) — modifiable/supprimable
- **Moyens de paiement** : espèces + Mobile Money activés par défaut — ajouter virement bancaire ou chèque si besoin
- **Documents requis** : extrait d'acte de naissance, bulletin année précédente (si réinscription)

### Étape 4 — Facturation (optionnel)
- Mode `event_based` (Refontiq billing) : 1 000 FCFA par inscription confirmée
- Clé Telegram pour les alertes de validation

---

## 4. Parcours d'inscription d'un élève

**Deux chemins mènent à la même inscription — l'école et la famille choisissent librement.**

```
Chemins d'entrée                    École (admin)                    Supabase
────────────────                    ─────────────                    ────────
A. Parent en ligne (facultatif)          │                              │
   ├─ 1. Formulaire public ─────────────►│                              │
   │   /enroll/{schoolId}                ├─ 2. Vérifie les pièces ────►│
   │   (brouillon auto, âge calculé,     │    (pre_enrollments)         │
   │    classe précédente pré-remplie)   ├─ 3. Valide au guichet ─────►│
   │── code 6 caractères (72 h) ────────┤    → élève + enrollment      │
   │                                     │                              │
B. Saisie directe au guichet ───────────┤  (aucun formulaire en ligne  │
   « Inscrire au guichet »               │   n'est exigé : mêmes        │
   (familles sans smartphone, ou qui     │   informations, même dossier)│
    préfèrent le contact humain)         │                              │
                                         │                              │
C. Réinscription en 1 clic (en ligne)    │                              │
   ├─ 1. Parent donne son téléphone ────►│                              │
   │   → enfants retrouvés,              │                              │
   │     classe suivante pré-calculée    │                              │
   └─ 2. Il confirme ───────────────────►│ → pré-inscription créée      │
```

> **La pré-inscription en ligne n'est jamais obligatoire.** Une famille qui ne
> maîtrise pas le numérique — ou qui n'a pas de smartphone — est inscrite
> directement au guichet (chemin B). Aucun élève n'est refusé faute d'avoir
> rempli le formulaire.

### 4.1 Contrôle des places avant acceptation

Le nombre de places d'un niveau est la **somme des capacités de ses classes**
(saisies à l'étape 2 de l'onboarding, ou dans **Structure académique**). Toute
inscription est refusée si le niveau est complet — au guichet comme en ligne —
et le contrôle est **refait au moment de la confirmation** : l'école ne peut pas
promettre une place qu'elle n'a plus.

### 4.2 Réinscription en 1 clic

Pour une famille déjà connue, **le parent ne remplit aucun formulaire** : il
saisit le **téléphone utilisé lors de l'inscription initiale**, le système
retrouve ses enfants, affiche la **classe de l'année suivante déjà calculée**,
et le parent confirme. Identité, parent, contact d'urgence et matricule sont
repris du dossier existant (aucune ressaisie, aucun doublon : la réinscription
se fait sur la fiche de l'élève déjà existante).

Le numéro est normalisé en base (`+225` + chiffres) : `0700000000`,
`+225 07 00 00 00 00` et `002250700000000` désignent le même parent, quel que
soit le canal qui a saisi la fiche.

### 4.3 Flux de paiement par virement bancaire (v1.2)
1. Parent dépose sur le compte bancaire de l'école
2. Parent obtient le reçu bancaire (scan/photo)
3. Parent joint le reçu au formulaire d'inscription
4. Secrétariat vérifie le montant et la date dans Schooly
5. Validation manuelle → passage de `pre_enrollment` à `enrollment`
6. Génération du reçu QR officiel Schooly

> **Champ référence de paiement** : le champ « référence » n'apparaît que
> lorsqu'il a un sens — **obligatoire pour un chèque**, facultatif pour un
> virement ou un mobile money, **absent pour les espèces** (guichet et caisse).

---

## 5. Bascule d'année académique (Phase 11)

Accessible via **Dashboard → Structure académique → Bascule d'année**.

### Étapes du wizard
1. **Configuration** : choisir l'année source et l'année cible
2. **Décisions** : pour chaque élève (admision / redoublement / exclusion)
3. **Aperçu** : récapitulatif avant exécution
4. **Exécution** : création automatique des inscriptions, clonage de la structure, logs

**Idempotent** : le processus peut être relancé sans doublon (les décisions déjà prises sont conservées).

---

## 6. Sauvegarde et restauration

### Sauvegarde automatique (PITR)
Supabase gère le Point-in-Time Recovery (PITR) automatiquement :
- Rétention : 7 jours (plan Pro) ou 2 jours (plan gratuit)
- Restauration via Dashboard → Database → Backups → Point-in-Time Recovery

### Export manuel (script)
```bash
# Export complet en JSON (tables configurables uniquement)
node scripts/backup/export-school.mjs --school-id <uuid> --output backup.json

# Import dans une autre école
node scripts/backup/import-school.mjs --input backup.json --target-school-id <uuid>
```

---

## 7. Monitoring et alertes

### Alertes Telegram
Schooly envoie des notifications pour :
- Nouvelle demande d'inscription (pré-inscription)
- Paiement en attente de validation (facturation SaaS)
- Erreur système critique (via Sentry)

### Health check
```
GET /api/health → { status: "ok", timestamp, version, db: "connected" }
```

---

## 8. Support

| Canal | Usage |
|-------|-------|
| GitHub Issues | Bugs, demandes de fonctionnalités |
| Documentation technique | `docs/` (architecture, RLS, migrations) |
| Email (à configurer) | Support établissement |

---

## 9. FAQ

**Q : Un parent peut-il modifier son inscription après soumission ?**  
R : Non. Une fois soumise, la pré-inscription est verrouillée en attente de validation. Le parent doit contacter le secrétariat.

**Q : Comment changer le mot de passe d'un utilisateur ?**  
R : Via Dashboard → Utilisateurs → réinitialisation par email (Supabase Auth).

**Q : Puis-je désactiver le kit tenue scolaire dans la checklist ?**  
R : Oui, via Dashboard → Configuration → Fournitures → décocher "Kit tenue scolaire".

**Q : Comment fonctionne le rappel MENAET ?**  
R : Automatiquement après confirmation de l'inscription locale, Schooly affiche un message au parent avec le code établissement MENA/DRENA. Le parent doit ensuite compléter l'inscription nationale séparément.

**Q : Que se passe-t-il si un niveau est complet ?**  
R : L'inscription est refusée automatiquement, au guichet comme en ligne. Les places d'un niveau correspondent à la **somme des capacités de ses classes** (Dashboard → Structure académique → Classes) : pour ouvrir des places, augmentez la capacité d'une classe ou créez-en une nouvelle.

**Q : Une famille sans smartphone peut-elle inscrire son enfant ?**  
R : Oui. La pré-inscription en ligne est **facultative** : utilisez « Inscrire au guichet » depuis Admissions. Les mêmes informations sont collectées et aboutissent au même dossier.

**Q : Le parent doit-il ressaisir ses informations pour une réinscription ?**  
R : Non. Il indique le **téléphone utilisé à l'inscription initiale** : ses enfants sont retrouvés automatiquement, la classe suivante est pré-calculée, et il confirme d'un seul bouton.

**Q : Pourquoi un champ « référence » apparaît-il parfois au paiement ?**  
R : Il dépend du mode choisi : obligatoire pour un **chèque**, facultatif pour un **virement** ou un **mobile money**, absent pour les **espèces**.

**Q : À quoi sert le contact d'urgence au dossier ?**  
R : Il est saisi dès l'inscription (par défaut le parent lui-même) et reste attaché à la fiche du tuteur. La surveillance ou l'infirmerie l'a donc immédiatement, sans appeler le secrétariat.

**Q : « Aucune école rattachée » s'affiche alors que l'utilisateur est bien rattaché. Que faire ?**  
R : C'est un symptôme connu, corrigé le 18/09/2026 : les droits de lecture manquants en base empêchaient l'application de lire le rattachement (l'erreur technique était masquée par un message trompeur). Deux vérifications :

1. Vérifier que le compte est bien actif : Supabase → SQL Editor →
   `select role_code, is_active from public.user_school_roles where user_id = '<id de l'utilisateur>';`
   (`is_active` doit être `true`, et le `role_code` correspondre à la fonction — `direction` ou `super_admin` pour la structure académique).
2. Appliquer le **script de rattrapage** `20260918180000_catchup_18_09.sql` (§2.1), puis se reconnecter.

Après correction, les messages sont désormais **distincts** et orientent le diagnostic : « Non autorisé » (session à renouveler), « Action réservée à un rôle supérieur » (mauvais rôle), « Aucune école rattachée » (compte non rattaché), « Erreur serveur » (incident technique à signaler).

**Q : Deux parents au même numéro de téléphone créent-ils deux dossiers ?**  
R : Non. Le numéro est **normalisé en base** (`+225` + chiffres) : `0700000000`, `+225 07 00 00 00 00` et `002250700000000` désignent le même parent. Les tuteurs en doublon créés avant le 18/09/2026 sont automatiquement rapprochés par le script de rattrapage (§2.1).

