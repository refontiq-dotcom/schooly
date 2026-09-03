# Module Messagerie — Intelligence

## Vue d'ensemble

Vues d'engagement, threads, alertes messages urgents non répondus, et marquage en lot.

## Migration

`supabase/migrations/20260903180000_messages_intelligence.sql` — idempotente.

## Nouvelles vues SQL

| Vue | Description |
|---|---|
| `messages_unread_summary` | Non-lus groupés par destinataire. |
| `messages_activity_dashboard` | KPIs d'activité : total, 24h/7j/30j, taux de lecture, retard, sans réponse >48h. |
| `messages_threads` | Dernier message par conversation (sender↔recipient) avec flag `has_unread_for_me`. |
| `messages_engagement` | % de lecture par destinataire + niveau (`engaged` / `normal` / `low_engagement`). |
| `messages_unanswered_urgent` | Messages > 48h non lus contenant un mot-clé d'urgence (urgent, important, immédiat, rapidement, asap). |

## Nouvelle fonction

| Fonction | Description |
|---|---|
| `mark_messages_read(p_message_ids uuid[], p_reader_id uuid)` | Marque en lot, retourne le nb effectivement marqués. |

## Logique TS miroir

`src/lib/messages-intelligence/scoring.ts` — 5 fetchers + `markMessagesRead` + 4 helpers purs.

## Règles métier

### Engagement
| Taux lecture | Niveau |
|---|---|
| ≥ 80 % | `engaged` |
| 50-79 % | `normal` |
| < 50 % | `low_engagement` |
| 0 message reçu | `no_data` (exclu par défaut) |

### Urgence critique
- `hours_since_sent >= 72` → critique
- Détection par regex case-insensitive sur `body` ou `subject` (mots : urgent, important, immédiat, rapidement, asap)

## Tests

6 tests Vitest — **171/171 au total**.

## Pré-requis

Table `public.messages` (id, establishment_id, sender_id, recipient_id, student_id, subject, body, read_at, created_at).
