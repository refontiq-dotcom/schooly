# Restauration PITR et réconciliation financière (R5)

Runbook d'exploitation : **que faire quand la base est corrompue, et comment
prouver qu'on a rendu une base saine.** À lire avant l'incident, pas pendant.

> Ce document décrit une procédure, il ne l'automatise pas. Une restauration
> PITR est destructrice : elle remplace la base par un état antérieur. C'est
> précisément pour cela qu'elle doit être décidée par une personne, pas par un
> cron.

---

## 1. Quand déclencher

| Symptôme | Décision |
|---|---|
| Migration destructive en production, données corrompues | **Restauration immédiate** |
| Suppression accidentelle en masse (élèves, encaissements) | **Restauration immédiate** |
| Requête lente qui bloque des écritures | Rollback applicatif d'abord ; restauration seulement si des données sont fausses |
| Simple erreur de saisie sur un reçu | Annulation métier (`cancelPayment`), **pas** de restauration |
| Migration ratée, tables vides | Restore de la migration (cf. `docs/deployment/migrations-18-09.md`) avant toute restauration |

Règle simple : **on restaure quand les données sont fausses, pas quand
l'application est en panne.**

## 2. Cibles de reprise

| Indicateur | Cible | Commentaire |
|---|---|---|
| RPO (perte de données acceptable) | ≤ 1 h | borné par la fenêtre PITR du plan souscrit |
| RTO (temps de reprise) | ≤ 2 h | restauration + vérifications + remise en service |
| Fréquence de vérification | mensuelle | voir §6, exercice de restauration |

## 3. Préparer la restauration

**Avant de lancer quoi que ce soit :**

1. **Geler les écritures.** Mettre l'application en lecture seule (mode
   maintenance au déploiement), sinon les encaissements saisis pendant
   l'opération disparaissent au moment de la restauration.
2. **Capturer l'état courant** de la base corrompue. C'est la seule trace de ce
   qui a disparu : sans elle, les données saisies après le point de restauration
   sont irrécupérables.
3. **Choisir l'instant cible** : le dernier instant connu sain, le plus récent
   possible. En cas de migration ratée : juste **avant** la migration.
4. **Prévenir** la direction financière et le support, avec l'heure de début et
   le RTO attendu.

```bash
# Sauvegarde de l'état corrompu, avant toute action
pg_dump "$DATABASE_URL" --format=custom \
  --file="/tmp/avant-restauration-$(date +%Y%m%dT%H%M).dump"
```

## 4. Restaurer

Voie supportée et la plus sûre : **le tableau de bord Supabase**, sur le projet
affecté.

1. **Database → Backups** : vérifier que la fenêtre PITR contient bien l'instant
   cible.
2. **Restore to a new project** (recommandé) plutôt que sur place : la base
   corrompue reste consultable, et la bascule se fait ensuite explicitement.
3. Renseigner l'instant cible, puis lancer la restauration. Compter 20 à 60
   minutes selon la taille de la base.
4. **Noter l'identifiant du nouveau projet** : les variables d'environnement de
   l'application y pointent.
5. Rejouer les migrations postérieures à l'instant cible, dans l'ordre :
   ```bash
   supabase db push --db-url "$NEW_DATABASE_URL"
   ```
6. Basculer l'application (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`),
   puis remettre en service.

> L'API de management Supabase expose une restauration programmatique
> (`POST /v1/projects/{ref}/database/restore`). Elle est utile pour scripter un
> exercice, mais **vérifier le contrat applicable au plan souscrit** avant de s'y
> fier : ce runbook privilégie volontairement le chemin documenté.


## 5. Vérifier la base restaurée

Avant de déclarer l'incident clos :

```bash
# 1. Cohérence financière : sessions, reçus, multitenant, outbox
psql "$DATABASE_URL" -f packages/db/scripts/check_sante_financiere.sql

# 2. Les deux RPC du dashboard répondent (S1)
psql "$DATABASE_URL" -c "select public.get_direction_financial_kpis('<school>','<year>', now(), 14);"
psql "$DATABASE_URL" -c "select public.get_direction_balance_kpis('<school>','<year>', null);"

# 3. Endurance : le dashboard tient toujours à 10 000 encaissements
npm run db:bench
```

Interprétation :

- **Tous les compteurs du contrôle financier à 0** → base cohérente.
- **Session ouverte depuis plus de 24 h** → la session n'a pas été clôturée
  avant l'incident : c'est le point de rapprochement, voir §7.
- **Un reçu manquant** → les reçus de la période perdue sont à régénérer ; tant
  qu'ils manquent, `/verify/<code>` ne peut rien montrer au parent.
- **`encaissements_hors_tenant > 0`** → anomalie de sécurité, pas de
  réconciliation : escalade immédiate (cf. `docs/security/audit-rls-phase13.md`).

Côté application, vérifier dans l'ordre : connexion → encaissement de contrôle →
historique de caisse → page 2 du paginateur → `/verify/<code>` d'un reçu
antérieur à l'incident.

## 6. Exercice de restauration (au moins une fois par trimestre)

Une restauration jamais testée est une restauration qui échoue. Exercice proposé,
sur un projet de test uniquement :

1. Créer une école de test avec des encaissements connus, total noté à la main.
2. Insérer une donnée « canari » (`canari_restauration = oui`).
3. Restaurer à un instant **antérieur** au canari.
4. Vérifier que le canari a disparu **et** que le total noté est identique.
5. Mesurer le temps écoulé : c'est le RTO réel, pas celui qu'on imagine.
6. Consigner la date, la durée et les écarts dans la section « Journal ».

## 7. Réconciliation des sessions de caisse orphelines

Second volet de R5, indépendant de la restauration.

Une session est **orpheline** quand elle est restée `open` alors que la journée
est terminée (> 24 h). Elle bloque le rapprochement : la clôture de caisse et le
solde attendu en dépendent.

```sql
-- Sessions à traiter, avec l'attendu si on referme au volume encaissé
select
  c.id,
  c.school_id,
  c.opened_at,
  now() - c.opened_at                                 as duree,
  c.opening_amount,
  coalesce(sum(p.amount), 0)                          as encaisse,
  c.opening_amount + coalesce(sum(p.amount), 0)        as attendu_si_on_cloture
from public.cash_sessions c
left join public.payments p
  on p.cash_session_id = c.id and p.deleted_at is null
where c.deleted_at is null
  and c.status = 'open'
group by c.id
order by c.opened_at;
```

Procédure par session, dans l'ordre :

1. **Constater** : compter les espèces, les chèques et les paiements mobiles du
   jour.
2. **Comparer** au total encaissé en base pour cette session.
3. **Conclure** :
   - concordance → clôturer dans l'application (le champ `difference` porte
     l'écart, même à 0) ;
   - écart → le saisir dans `difference` **et** le documenter (ticket, photo du
     reçu de clôture), jamais le corriger en SQL ;
   - session ouverte par erreur, sans aucun encaissement → la clôturer avec un
     écart de 0 et le signaler.
4. **Ne jamais supprimer une session** : elle porte l'audit. Une session fausse se
   clôture, elle ne disparaît pas.

## 8. Après la restauration : la suite de la reprise

| Ordre | Action | Pourquoi |
|---|---|---|
| 1 | Clôturer les sessions orphelines (§7) | l'écart de caisse doit être connu avant de laisser encaisser |
| 2 | Ressaisir les écritures perdues | le montant saisi pendant l'incident est à ressaisir, en double contrôle |
| 3 | Régénérer les reçus manquants | `/verify` doit de nouveau répondre |
| 4 | Purger les caches applicatifs | sinon l'interface affiche l'état d'avant l'incident |
| 5 | Relancer le worker outbox | le drain reprend ; surveiller `outbox_backlog` sur `/api/health` |

## 9. Journal des exercices

| Date | Projet | Durée | Canari | Écart constaté |
|---|---|---|---|---|
| _(à compléter au premier exercice)_ | | | | |

---

### Références

- `packages/db/scripts/check_sante_financiere.sql` — contrôles de cohérence
- `packages/db/scripts/bench_dashboard.sql` — endurance du dashboard
- `docs/deployment/production-readiness.md` — checklist de mise en production
- `docs/security/audit-rls-phase13.md` — audit RLS, escalade si fuite détectée
