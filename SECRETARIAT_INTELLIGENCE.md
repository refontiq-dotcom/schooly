# Module Secrétariat — Intelligence

## Vue d'ensemble

Tableau de bord opérationnel pour le secrétariat : agrégat temps réel des actions à mener, complétude des dossiers, file d'attente QR, historique.

## Migration

Fichier : `supabase/migrations/20260903160000_secretariat_intelligence.sql`

Idempotente. À exécuter dans le Supabase SQL Editor.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `student_documents_completeness` | % de docs requis validés par élève + statut (`complete` / `pending_validation` / `incomplete`). |
| `students_missing_documents` | Élèves avec dossier incomplet, triés par nb docs manquants DESC. |
| `pending_qr_finalizations` | QR codes à scanner / finaliser avec état (`awaiting_payment` / `awaiting_scan` / `expired`). |
| `secretariat_daily_actions` | Agrégat du jour par établissement : réservations, paiements en attente, dossiers incomplets, total actions. |
| `secretariat_recent_actions` | Historique des finalisations (réservations + paiements) avec acteur et metadata JSON. |

## Nouvelles fonctions

| Fonction | Description |
|---|---|
| `finalize_reservation(p_reservation_id, p_section_id, p_actor_id)` | Finalisation atomique : crée l'élève, incrémente `seats_taken`, marque la réservation `confirmed`. Suggère automatiquement la section la moins pleine si non fournie. |
| `compute_establishment_docs_completeness(p_establishment_id)` | Moyenne de complétude des dossiers (%) d'un établissement. |

## Logique TS miroir

Fichier : `src/lib/secretariat-intelligence/scoring.ts`

Fetchers : `fetchSecretariatDailyActions`, `fetchStudentsMissingDocuments`, `fetchPendingQRFinalizations`, `fetchSecretariatRecentActions`, `finalizeReservation`, `computeEstablishmentDocsCompleteness`.

Helpers purs : `completenessLabel`, `completenessColor`, `isWorkloadCritical`.

## Règles métier

### Statut dossier
| Condition | Statut |
|---|---|
| 0 manquant + 0 soumis | `complete` |
| 0 manquant + ≥ 1 soumis | `pending_validation` |
| ≥ 1 manquant | `incomplete` |

### Charge critique
- `total_pending_actions >= 20` → bandeau rouge 🚨

### Finalisation
- Refuse les réservations déjà `confirmed` / `expired` / `cancelled`
- Si pas de section, auto-suggestion via `class_suggest_section_for_level` (équivalent métier)
- Si section pleine → exception
- `for update` sur la réservation pour atomicité

## UI

`src/app/dashboard/secretariat/page.tsx` enrichie :
- 4 KPIs : réservations/jour, à scanner, paiements en attente, dossiers incomplets
- Bandeau charge critique
- Liste QR codes en attente avec état
- Bandeau dossiers incomplets (top 8)
- Historique activité récente (8 dernières actions)

## Tests

`src/lib/secretariat-intelligence/__tests__/scoring.test.ts` — 4 tests (completeness + workload). **160/160 au total**.

## Pré-requis

Tables : `reservations`, `students`, `student_documents`, `payments`, `sections`, `levels`, `establishments`, `profiles`. Types enum : `document_status` (`'missing', 'submitted', 'validated', 'rejected'`), `payment_status` (`'pending', 'paid', ...`).
