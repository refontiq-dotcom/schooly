-- 20260922150000 — Communes d’implantation de l’établissement
-- Une école peut être présente dans une ou plusieurs communes.

alter table public.schools
  add column if not exists communes text[] not null default '{}';

comment on column public.schools.communes is
  'Communes dans lesquelles l’établissement est implanté, une ou plusieurs.';
