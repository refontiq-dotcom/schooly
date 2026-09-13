# Guide de démarrage rapide — Schooly

**Version** : 1.2  
**Dernière mise à jour** : 13 septembre 2026  
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

```
Parent (en ligne)                    École (admin)                Supabase
     │                                    │                          │
     ├─ 1. Remplit le formulaire ────────►│                          │
     │   (nom, classe, documents,         │                          │
     │    preuve paiement)                │                          │
     │                                    ├─ 2. Vérifie les docs ──►│
     │                                    │    (pre_enrollments)     │
     │                                    ├─ 3. Valide manuellement─►│
     │                                    │    → enrollment créé     │
     │◄── 4. Reçu QR + rappel MENAET ────┤                          │
     │                                    │                          │
```

### Flux de paiement par virement bancaire ⭐ *Nouveau en v1.2*
1. Parent dépose sur le compte bancaire de l'école
2. Parent obtient le reçu bancaire (scan/photo)
3. Parent joint le reçu au formulaire d'inscription
4. Secrétariat vérifie le montant et la date dans Schooly
5. Validation manuelle → passage de `pre_enrollment` à `enrollment`
6. Génération du reçu QR officiel Schooly

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
