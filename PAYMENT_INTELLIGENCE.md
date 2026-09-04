# Schooly — Paiements intelligents

Ce document complète `RESERVATION_INTELLIGENCE.md` en décrivant l'intelligence
ajoutée au module **Paiements** : scoring de risque, détection d'anomalies,
réconciliation Mobile Money, vues agrégées temps réel, et dashboard de
trésorerie.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  record_fee_payment(student_fee_id, amount, method, ...)              │
│       │                                                                 │
│       ▼                                                                 │
│  INSERT payment (status=pending|confirmed)                              │
│       │                                                                 │
│       └─ si confirmé → refresh_fee_status()                            │
│                                                                         │
│  confirm_fee_payment(payment_id)                                        │
│       │                                                                 │
│       ├─ detect_payment_anomaly(payment_id) → flags                  │
│       ├─ compute_payment_risk_score(etab, parent_phone) → 0..100       │
│       ├─ UPDATE payments SET status='confirmed', risk_score, flags     │
│       └─ UPDATE student_fees SET amount_paid, late_days              │
│                                                                         │
│  generate_yearly_schedule(etab, year) → assigne toutes les échéances   │
│  mark_overdue_fees() → passe en 'overdue' (cron quotidien)            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Scoring de risque d'impayé

`compute_payment_risk_score(establishment_id, parent_phone)` retourne
un score 0..100 : **0 = très fiable, 100 = impayé quasi certain**.

| Composante | Plage |
|---|---|
| Base | 30 (neutre pour les nouveaux payeurs) |
| Taux d'échec (failed + overdue) / total | × 50 |
| Retard moyen (jours) | +1/jour (plafonné +20) |
| Aucun paiement confirmé | +15 (très risqué) |

Miroir TypeScript dans
[`src/lib/payment-intelligence/scoring.ts`](src/lib/payment-intelligence/scoring.ts).

## Détection d'anomalies

`detect_payment_anomaly(payment_id)` retourne un tableau de flags
attachés à la colonne `anomaly_flags` du paiement (n'invalide pas le
paiement, mais alerte l'admin) :

| Flag | Condition |
|---|---|
| `AMOUNT_INVALID` | Montant ≤ 0 |
| `AMOUNT_OUTLIER` | Montant > 5× la moyenne 90j de l'établissement |
| `RAPID_DUPLICATE` | Même référence + montant + student < 5 min |
| `REF_INVALID` | Référence trop courte (<4) ou trop longue (>64) |
| `STUDENT_BELONGS_TO_OTHER_ETAB` | Le `student_fee_id` ne correspond pas à l'établissement |

## Réconciliation Mobile Money

Table `payment_reconciliations` stocke les statements bruts des opérateurs
(`orange_money`, `mtn_momo`, `wave`, `moov`) avec :

- `external_reference` : ID du transfert côté opérateur
- `external_amount`, `external_phone`
- `status` : `unmatched` / `matched` / `ignored` / `ambiguous`

L'action `reconcilePayment(paymentId, reconciliationId)` marque à la fois
le paiement (`reconciled_at`, `reconciled_by`) et la ligne de statement
comme rapprochée.

## Vues temps réel

| Vue | Usage |
|---|---|
| `payment_overview` | KPI agrégé : encaissé, en attente, restant dû, taux de recouvrement, répartition par méthode |
| `monthly_revenue` | CA mensuel sur 12 mois (utilisé par le graphique en barres) |
| `overdue_fees` | Top des échéances en retard triées par jours de retard |
| `payment_anomalies` | Paiements avec au moins un flag d'anomalie |
| `high_risk_payments` | Paiements dont le score de risque ≥ 60 |
| `student_payment_summary` | Reste à payer consolidé par élève (pour le dashboard parent) |

## Dashboard admin

`/dashboard/admin/paiements` affiche :

- 4 KPI principaux (encaissé, en attente, restant dû, taux de recouvrement)
- Répartition par méthode de paiement (barres horizontales)
- Tableau des échéances en retard trié par `days_late` desc
- Tableau des paiements à haut risque (score ≥ 60)
- Bandeau d'alerte anomalies si détectées
- Catalogue de frais
- Derniers paiements
- Histogramme CA mensuel (12 mois)
- Lien vers l'échéancier annuel

`/dashboard/admin/paiements/schedule` permet de générer les échéances
annuelles en un clic (idempotent).

## Dashboard parent

`/dashboard/parent/paiements` affiche désormais par enfant :

- Total versé + reste à payer + **prochaine échéance avec countdown** (« dans 5 j » / « 3 j de retard »)
- Bandeau rouge si retards
- Échéances individuelles avec barre de progression colorée selon statut
- Historique des paiements

## Cron recommandé

```sql
-- pg_cron : marquer les frais en retard chaque matin à 7h
select cron.schedule('mark-overdue-fees', '0 7 * * *',
  $$ select public.mark_overdue_fees(); $$);
```

## Migration à appliquer

```bash
supabase/migrations/20260903100000_payment_intelligence.sql
```

Ajouter cette ligne dans le `README.md` après la migration Réservation
intelligence.

## Tests

```
src/lib/payment-intelligence/scoring.test.ts          — 27 tests
```

Total projet : **86 tests passent** (`npx vitest run`).

## Évolutions à venir (Phase 2)

- Génération de reçus PDF (à la confirmation d'un paiement)
- Intégration d'un agrégateur Mobile Money réel (CinetPay, FedaPay)
- Auto-relance WhatsApp via n8n basée sur `overdue_count > 0`
- Détection de fraude plus poussée (vélocité, IP, device fingerprinting)