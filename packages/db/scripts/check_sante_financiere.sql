-- R5 — Contrôles de santé financiers (lecture seule, sans transaction).
--
-- Le plan de reprise ne sert à rien si on ne sait pas dire, à froid, si les
-- données financières sont cohérentes. Ce script liste les anomalies qui
-- doivent revenir à zéro : il est destiné à être branché sur une supervision
-- (ou lancé à la main pendant un incident) et **n'écrit rien**.
--
-- Chaque contrôle est une requête indépendante : une table manquante ou une
-- colonne en cours de migration ne casse pas les autres.
--
-- Usage :
--   psql "$DATABASE_URL" -f packages/db/scripts/check_sante_financiere.sql
--
-- Lecture des résultats :
--   0 partout  → rien à réconcilier
--   > 0        → anomalie à traiter (voir le runbook de restauration PITR)

\pset border 2

\echo ''
\echo '══ Sessions de caisse ═══════════════════════════════════════════'

-- Sessions restées ouvertes : le tiroir reste « en cours » alors que la journée
-- est finie. Toute session ouverte depuis plus de 24 h doit être clôturée ou
-- annulée manuellement : c'est la source de divergence la plus fréquente.
select
  count(*) filter (where status = 'open')                        as ouvertes,
  count(*) filter (where status = 'open' and opened_at < now() - interval '24 h')
                                                                     as ouvertes_depuis_plus_de_24h,
  count(*) filter (where status = 'open' and opened_at < now() - interval '72 h')
                                                                     as ouvertes_depuis_plus_de_72h
from public.cash_sessions
where deleted_at is null;

-- Écart de caisse déclaré à la clôture : non nul, c'est un point à traiter
-- avec le comptable, jamais une correction silencieuse en base.
select
  count(*) filter (where difference is not null and difference <> 0) as sessions_en_ecart,
  coalesce(sum(abs(difference)), 0)                                as ecart_cumule
from public.cash_sessions
where deleted_at is null
  and status <> 'open';

\echo ''
\echo '══ Cohérence des encaissements ══════════════════════════════════'

-- Un reçu manquant : la vérification publique /verify ne pourra rien montrer.
select count(*) as paiements_sans_recu
from public.payments p
left join public.receipts r on r.payment_id = p.id and r.deleted_at is null
where p.deleted_at is null
  and r.id is null;

-- Multitenant : un encaissement rattaché à une inscription d'une autre école
-- signalerait une fuite inter-établissements. Doit être 0, sans exception.
select count(*) as encaissements_hors_tenant
from public.payments p
join public.enrollments e on e.id = p.enrollment_id
where p.deleted_at is null
  and e.school_id is distinct from p.school_id;

-- Espèces sans session : `record_payment` refuse normally le cash hors
-- session ; un volume non nul trahit un contournement ou un ancien import.
select
  count(*) filter (where payment_method = 'cash' and cash_session_id is null)
    as especes_hors_session,
  count(*) filter (where cash_session_id is not null
                     and not exists (
                       select 1 from public.cash_sessions c
                       where c.id = p.cash_session_id
                     ))                                          as sessions_introuvables
from public.payments p
where p.deleted_at is null;

\echo ''
\echo '══ Notifications ════════════════════════════════════════════════'

-- La file du worker outbox (P2-1) : un backlog croissant signale un worker ou
-- un provider en panne. Même seuil que /api/health.
select
  count(*) filter (where status = 'pending')   as en_attente,
  count(*) filter (where status = 'failed')    as en_echec,
  min(scheduled_at) filter (where status = 'pending') as plus_ancienne_attente
from public.notification_outbox
where deleted_at is null;

\echo ''
\echo '══ Volume du mois en cours (contexte de lecture) ══════════════'

select
  count(*)::bigint                                   as paiements_mois,
  coalesce(sum(amount), 0)::bigint                   as encaissements_mois,
  min(received_at)                                   as premier,
  max(received_at)                                   as dernier
from public.payments
where deleted_at is null
  and received_at >= date_trunc('month', now());
