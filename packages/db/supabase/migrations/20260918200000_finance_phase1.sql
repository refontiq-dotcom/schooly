-- ============================================================================
-- 20260918200000 — Finance Phase 1 : le « dû » par élève + soldes + annulation
--
-- Constat d'audit (18/09) : le module savait ENCAISSER (payments + reçus QR)
-- mais rien ne disait COMBIEN chaque élève devait. Sans « dû », pas de solde,
-- pas d'impayés, pas de recouvrement : la caisse n'était qu'un enregistreur
-- de montants.
--
-- 1. student_fee_items  : les tranches attendues par inscription, générées
--    depuis la grille tarifaire à la création de l'inscription (1 ligne
--    annuelle ou N tranches avec dates d'échéance).
-- 2. v_student_fee_items_state : chaque tranche + le reste à payer dessus,
--    calculé par fenêtre cumulative sur les paiements — allocation FIFO
--    SANS table de jonction : les paiements se répartissent tout seuls
--    dans l'ordre des échéances, et toute annulation se propage
--    instantanément.
-- 3. v_student_balances : une ligne par inscription — attendu, payé, solde,
--    prochaine échéance — la source unique des KPI, de la liste d'impayés
--    et du guichet.
-- 4. payments.cancel_reason : annulation de paiement avec motif obligatoire
--    (erreur de saisie de caisse) — la ligne reste en base (soft delete).
--
-- Idempotent. Montants BIGINT en FCFA (convention 20260908130000).
-- ============================================================================

-- ─── 1. Tranches attendues par inscription ──────────────────────────────────
create table if not exists public.student_fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  label text not null default 'Scolarité',
  amount bigint not null check (amount >= 0),
  due_date date,
  position integer not null default 1 check (position >= 1),
  source text not null default 'auto' check (source in ('auto', 'manuel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_student_fee_items_updated_at on public.student_fee_items;
create trigger trg_student_fee_items_updated_at before update on public.student_fee_items
  for each row execute function public.touch_updated_at();

create index if not exists idx_student_fee_items_school
  on public.student_fee_items (school_id) where deleted_at is null;
create index if not exists idx_student_fee_items_enrollment
  on public.student_fee_items (enrollment_id) where deleted_at is null;
create index if not exists idx_student_fee_items_year_due
  on public.student_fee_items (academic_year_id, due_date) where deleted_at is null;

alter table public.student_fee_items enable row level security;

drop policy if exists student_fee_items_member_read on public.student_fee_items;
create policy student_fee_items_member_read on public.student_fee_items for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists student_fee_items_finance_write on public.student_fee_items;
create policy student_fee_items_finance_write on public.student_fee_items for all
  using (is_super_admin() or has_school_role(school_id, array['direction', 'compta', 'super_admin']));

grant select on public.student_fee_items to authenticated;

-- ─── 2. Annulation de paiement ──────────────────────────────────────────────
alter table public.payments
  add column if not exists cancel_reason text;

comment on column public.payments.cancel_reason is
  'Motif obligatoire de l''annulation (erreur de caisse). La ligne reste en base (deleted_at).';


-- ─── 3. État des tranches (allocation FIFO des paiements, sans table) ──────
create or replace view public.v_student_fee_items_state as
with fees as (
  select
    sfi.*,
    sum(sfi.amount) over (
      partition by sfi.enrollment_id
      order by sfi.due_date nulls last, sfi.position, sfi.id
      rows between unbounded preceding and current row
    ) as cum_expected
  from public.student_fee_items sfi
  where sfi.deleted_at is null
),
paid as (
  select enrollment_id, sum(amount) as paid_total
  from public.payments
  where deleted_at is null
  group by enrollment_id
)
select
  f.id,
  f.school_id,
  f.enrollment_id,
  f.academic_year_id,
  f.label,
  f.amount,
  f.due_date,
  f.position,
  f.source,
  f.created_at,
  f.cum_expected,
  coalesce(p.paid_total, 0) as paid_total,
  -- montant affecté à cette tranche : le reliquat du total payé après les tranches précédentes
  greatest(0, least(f.amount, coalesce(p.paid_total, 0) - (f.cum_expected - f.amount))) as paid_on_item,
  f.amount
    - greatest(0, least(f.amount, coalesce(p.paid_total, 0) - (f.cum_expected - f.amount))) as remaining_on_item
from fees f
left join paid p on p.enrollment_id = f.enrollment_id;

comment on view public.v_student_fee_items_state is
  'Tranches attendues par inscription avec le reste à payer de chacune. Paiements affectés FIFO par ordre d''échéance — aucune table de jonction, l''annulation d''un paiement se propage automatiquement.';

-- ─── 4. Solde par inscription (source unique des KPI / impayés / guichet) ───
create or replace view public.v_student_balances as
with items as (
  select * from public.v_student_fee_items_state
),
next_item as (
  select enrollment_id, due_date, remaining_on_item
  from (
    select
      i.*,
      row_number() over (
        partition by i.enrollment_id
        order by i.due_date nulls last, i.position, i.id
      ) as rn
    from items i
    where i.remaining_on_item > 0
  ) ranked
  where rn = 1
),
agg as (
  select
    enrollment_id,
    sum(amount) as expected_total,
    max(paid_total) as paid_total
  from items
  group by enrollment_id
)
select
  e.id as enrollment_id,
  e.school_id,
  e.academic_year_id,
  e.student_id,
  e.matricule,
  e.status as enrollment_status,
  st.first_name,
  st.last_name,
  g.full_name as guardian_name,
  g.phone as guardian_phone,
  gl.name as grade_level_name,
  cl.name as class_name,
  ay.label as academic_year_label,
  a.enrollment_id is not null as has_fee_items,
  coalesce(a.expected_total, 0) as expected_total,
  coalesce(a.paid_total, 0) as paid_total,
  coalesce(a.expected_total, 0) - coalesce(a.paid_total, 0) as balance,
  n.due_date as next_due_date,
  n.remaining_on_item as next_due_amount,
  pmt.last_payment_at
from public.enrollments e
join public.students st on st.id = e.student_id
left join public.guardians g on g.id = e.guardian_id
left join public.grade_levels gl on gl.id = e.grade_level_id
left join public.classes cl on cl.id = e.class_id
left join public.academic_years ay on ay.id = e.academic_year_id
left join agg a on a.enrollment_id = e.id
left join next_item n on n.enrollment_id = e.id
left join (
  select enrollment_id, max(received_at) as last_payment_at
  from public.payments
  where deleted_at is null
  group by enrollment_id
) pmt on pmt.enrollment_id = e.id
where e.deleted_at is null;

comment on view public.v_student_balances is
  'Solde par inscription : attendu / payé / reste, prochaine échéance. balance > 0 = impayé, balance = 0 = soldé, balance < 0 = avance. has_fee_items = false : aucun échéancier généré (à créer depuis la grille).';

grant select on public.v_student_fee_items_state to authenticated;
grant select on public.v_student_balances to authenticated;
