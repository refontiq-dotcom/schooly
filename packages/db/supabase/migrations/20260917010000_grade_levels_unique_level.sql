-- ============================================================================
-- 20260917010000 — Niveaux : un seul niveau par rang dans une école
--
-- Constat d'audit : rien n'empêchait deux `grade_levels` de partager le même
-- `level` dans une même école. Or `level` est l'échelle d'ordre de la bascule
-- d'année : executeRollover construit une table rang → niveau (`levelToId`) et
-- promeut à `rang + 1`. Avec deux niveaux au même rang, la table garde le
-- dernier rencontré : l'élève est promu dans un niveau arbitraire selon l'ordre
-- de retour de la base, sans aucune erreur visible.
--
-- Correctif en deux temps :
--   1. réparation des bases déjà incohérentes (aucune suppression de ligne) ;
--   2. invariant structurel : index unique partiel sur (school_id, level).
--
-- Idempotent : réexécution sans risque (le pas 1 ne fait rien si sain, le pas 2
-- est en `if not exists`).
-- ============================================================================

-- ─── 1. Réparation des doublons ─────────────────────────────────────────────
-- Les niveaux en double sont décalés AU-DESSUS du rang maximal de leur école
-- (rangs libres, déterministes). Aucune ligne n'est supprimée : les classes
-- référencent grade_levels en `on delete restrict`, un delete les casserait.
with ranked as (
  select id,
         school_id,
         level,
         row_number() over (
           partition by school_id, level
           order by created_at asc, id asc
         ) as rn
  from public.grade_levels
  where deleted_at is null
),
duplicates as (
  select id,
         school_id,
         row_number() over (
           partition by school_id
           order by level asc, id asc
         ) as offset
  from ranked
  where rn > 1
),
ceiling as (
  select school_id, max(level) as max_level
  from public.grade_levels
  where deleted_at is null
  group by school_id
)
update public.grade_levels g
set level = c.max_level + d.offset
from duplicates d
join ceiling c on c.school_id = d.school_id
where g.id = d.id;

-- ─── 2. Invariant ──────────────────────────────────────────────────────────
-- Partiel sur `deleted_at is null` : un niveau supprimé logiquement ne réserve
-- pas son rang. La validation applicative (createGradeLevel) renvoie un message
-- explicite ; l'index reste le filet de sécurité.
create unique index if not exists grade_levels_school_level_unique
  on public.grade_levels (school_id, level)
  where deleted_at is null;
