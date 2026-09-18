-- ============================================================================
-- 20260918190000 — Accès du compte parent : autorisation par année scolaire
--
-- Modèle (cf. docs/product/architecture-compte-parent.md) :
--   • le TÉLÉPHONE est une clé d'ÉLIGIBILITÉ, pas un droit d'accès ;
--   • le COMPTE parent est PERMANENT (guardians + auth.users) ;
--   • l'AUTORISATION est portée par enrollments et EXPIRE avec l'année :
--       academic_years.status = 'en_cours'  → lecture
--       academic_years.status = 'cloturee'  → lecture seule (archives)
--       academic_years.status = 'planifiee' → aucun accès
--
-- Pourquoi c'est nécessaire : aujourd'hui la PWA parent lit via service_role,
-- la sécurité repose donc sur la discipline du code appelant. Un oubli de
-- `.eq("guardian_id", …)` exposerait les enfants d'un autre parent. Ces policies
-- rendent l'oubli impossible : la base refuse.
--
-- DÉCISION DE SÉCURITÉ — le parent n'obtient AUCUNE écriture :
--   ❌ pas d'insert sur payments  → sinon un parent pourrait fabriquer une
--      ligne de paiement (donc un reçu) sans avoir payé ;
--   ❌ pas d'insert sur moratoriums → sinon il pourrait s'auto-accorder un
--      moratoire au lieu de passer par la validation de la direction ;
--    pas d'écriture sur les données académiques.
--   ✅ une seule écriture : sa propre fiche guardians, limitée par un GRANT
--      de COLONNE à (full_name, email). `phone` en est exclu : le changement
--      de numéro passe par la procédure validée par l'école (§6 du document).
--
-- Idempotent : drop policy if exists / create or replace function / grants.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Qui est le parent connecté ?
--    `guardians_user_id_unique` (20260918160000) garantit 0 ou 1 ligne.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.current_guardian_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
    from public.guardians g
   where g.user_id = auth.uid()
     and g.deleted_at is null
   limit 1;
$$;

comment on function public.current_guardian_id() is
  'Fiche guardians du parent connecté (via guardians.user_id). NULL si le compte n''est rattaché à aucune fiche.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Ce parent a-t-il un droit sur cette inscription ?
--    Le `guardian_id` est TOUJOURS revérifié en base, jamais reçu du client.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.parent_owns_enrollment(p_enrollment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
     where e.id = p_enrollment
       and e.guardian_id = public.current_guardian_id()
       and e.deleted_at is null
  );
$$;

comment on function public.parent_owns_enrollment(uuid) is
  'Vrai si l''inscription appartient au parent connecté. Toute autorisation parent part de cette fonction.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Lecture vs écriture : c'est l'ANNÉE qui tranche
--    en_cours  → lecture + écriture (paiement en ligne)
--    cloturee  → lecture seule (archives, vacances)
--    planifiee → aucun accès (l'inscription n'est pas encore active)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.parent_can_read_enrollment(p_enrollment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
      join public.academic_years y on y.id = e.academic_year_id
     where e.id = p_enrollment
       and e.guardian_id = public.current_guardian_id()
       and e.deleted_at is null
       and y.deleted_at is null
       and y.status in ('en_cours', 'cloturee')
  );
$$;

comment on function public.parent_can_read_enrollment(uuid) is
  'Lecture autorisée : inscription du parent + année en_cours ou cloturee. Une année planifiee reste invisible.';

create or replace function public.parent_can_write_enrollment(p_enrollment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
      join public.academic_years y on y.id = e.academic_year_id
     where e.id = p_enrollment
       and e.guardian_id = public.current_guardian_id()
       and e.deleted_at is null
       and y.deleted_at is null
       and y.status = 'en_cours'
  );
$$;

comment on function public.parent_can_write_enrollment(uuid) is
  'Écriture autorisée (ex. paiement en ligne) : inscription du parent + année STRICTEMENT en_cours. Une année cloturee est en lecture seule.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Rattachement indirect : élève, paiement, école
-- ════════════════════════════════════════════════════════════════════════════

-- Un élève est visible s'il est référencé par une inscription visible du parent
-- (jamais parce qu'un student_id a été fourni par le client).
create or replace function public.parent_owns_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
     where e.student_id = p_student
       and e.guardian_id = public.current_guardian_id()
       and e.deleted_at is null
  );
$$;

comment on function public.parent_owns_student(uuid) is
  'Vrai si un élève est rattaché au parent par au moins une inscription (toutes années confondues).';

-- Les reçus n'ont pas d'enrollment_id : le rattachement passe par le paiement.
create or replace function public.parent_owns_payment(p_payment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.payments p
     where p.id = p_payment
       and public.parent_can_read_enrollment(p.enrollment_id)
  );
$$;

comment on function public.parent_owns_payment(uuid) is
  'Vrai si le paiement appartient à une inscription lisible par le parent (support des reçus).';


-- ════════════════════════════════════════════════════════════════════════════
-- 5. GRANTS — sans eux, aucune policy n'est évaluée (cf. 20260918120000)
--    Lecture seule partout, SAUF la fiche guardians (cf. §6).
-- ════════════════════════════════════════════════════════════════════════════

grant select on public.enrollments to authenticated;
grant select on public.students to authenticated;

-- Écriture strictement limitée aux coordonnées non identifiantes :
--   ✅ full_name, email
--   ❌ phone   → le numéro est une clé d'authentification : il ne se change
--                QUE par le parcours validé par l'école (§6 du document).
--    user_id → sinon un parent pourrait rattacher sa fiche à un autre compte.
revoke update on public.guardians from authenticated;
grant update (full_name, email) on public.guardians to authenticated;

-- Données pédagogiques et financières consultables (lecture seule)
grant select on public.grade_entries to authenticated;
grant select on public.report_cards to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.payments to authenticated;
grant select on public.receipts to authenticated;
grant select on public.moratoriums to authenticated;
grant select on public.enrollment_decisions to authenticated;
grant select on public.academic_decisions to authenticated;
grant select on public.student_qr_codes to authenticated;
grant select on public.door_entries to authenticated;
grant select on public.detentions to authenticated;
grant select on public.payment_reminders to authenticated;
grant select on public.dropout_alerts to authenticated;
grant select on public.canteen_subscriptions to authenticated;
grant select on public.transport_subscriptions to authenticated;
grant select on public.boarding_subscriptions to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. POLICIES — le parent lit ses données, l'école seule écrit
--
-- Les policies existantes (membres de l'école, direction) ne sont PAS touchées :
-- Postgres combine les policies permissives en OR, ces nouvelles règles
-- AJOUTENT le parent, elles ne retirent aucun droit à l'école.
-- ════════════════════════════════════════════════════════════════════════════

-- 6.1 Rattachement de l'année (pour le sélecteur d'années du dashboard)
create or replace function public.parent_owns_academic_year(p_year uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
     where e.academic_year_id = p_year
       and e.guardian_id = public.current_guardian_id()
       and e.deleted_at is null
  );
$$;

comment on function public.parent_owns_academic_year(uuid) is
  'Vrai si le parent a au moins une inscription dans cette année (sert de base au sélecteur d''années).';

-- 6.2 Sa propre fiche tuteur
drop policy if exists guardians_parent_read on public.guardians;
create policy guardians_parent_read on public.guardians for select
  using (user_id = auth.uid() and deleted_at is null);

drop policy if exists guardians_parent_update_self on public.guardians;
create policy guardians_parent_update_self on public.guardians for update
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid() and deleted_at is null);

-- 6.3 Ses inscriptions (jamais d'écriture : l'école seule inscrit)
drop policy if exists enrollments_parent_read on public.enrollments;
create policy enrollments_parent_read on public.enrollments for select
  using (public.parent_can_read_enrollment(id));

-- 6.4 Ses enfants
drop policy if exists students_parent_read on public.students;
create policy students_parent_read on public.students for select
  using (public.parent_owns_student(id));

-- 6.5 Les années concernées par ses inscriptions
drop policy if exists academic_years_parent_read on public.academic_years;
create policy academic_years_parent_read on public.academic_years for select
  using (
    status in ('en_cours', 'cloturee')
    and public.parent_owns_academic_year(id)
  );

-- 6.6 Données rattachées à une inscription
--     (même règle pour tout le périmètre pédagogique et financier)
drop policy if exists payments_parent_read on public.payments;
create policy payments_parent_read on public.payments for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists grade_entries_parent_read on public.grade_entries;
create policy grade_entries_parent_read on public.grade_entries for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists report_cards_parent_read on public.report_cards;
create policy report_cards_parent_read on public.report_cards for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists attendance_records_parent_read on public.attendance_records;
create policy attendance_records_parent_read on public.attendance_records for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists moratoriums_parent_read on public.moratoriums;
create policy moratoriums_parent_read on public.moratoriums for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists enrollment_decisions_parent_read on public.enrollment_decisions;
create policy enrollment_decisions_parent_read on public.enrollment_decisions for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists academic_decisions_parent_read on public.academic_decisions;
create policy academic_decisions_parent_read on public.academic_decisions for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists student_qr_codes_parent_read on public.student_qr_codes;
create policy student_qr_codes_parent_read on public.student_qr_codes for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists door_entries_parent_read on public.door_entries;
create policy door_entries_parent_read on public.door_entries for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists detentions_parent_read on public.detentions;
create policy detentions_parent_read on public.detentions for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists payment_reminders_parent_read on public.payment_reminders;
create policy payment_reminders_parent_read on public.payment_reminders for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists dropout_alerts_parent_read on public.dropout_alerts;
create policy dropout_alerts_parent_read on public.dropout_alerts for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists canteen_subscriptions_parent_read on public.canteen_subscriptions;
create policy canteen_subscriptions_parent_read on public.canteen_subscriptions for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists transport_subscriptions_parent_read on public.transport_subscriptions;
create policy transport_subscriptions_parent_read on public.transport_subscriptions for select
  using (public.parent_can_read_enrollment(enrollment_id));

drop policy if exists boarding_subscriptions_parent_read on public.boarding_subscriptions;
create policy boarding_subscriptions_parent_read on public.boarding_subscriptions for select
  using (public.parent_can_read_enrollment(enrollment_id));

-- 6.7 Reçus — rattachés par le paiement (pas d'enrollment_id sur cette table)
drop policy if exists receipts_parent_read on public.receipts;
create policy receipts_parent_read on public.receipts for select
  using (public.parent_owns_payment(payment_id));


-- ════════════════════════════════════════════════════════════════════════════
-- 7. CONTRÔLE APRÈS EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════════
-- 7.1 Les 6 helpers doivent exister :
--   select proname from pg_proc
--    where proname in ('current_guardian_id','parent_owns_enrollment',
--          'parent_can_read_enrollment','parent_can_write_enrollment',
--          'parent_owns_student','parent_owns_payment','parent_owns_academic_year');
--
-- 7.2 Les policies parent doivent être présentes :
--   select tablename, policyname from pg_policies
--    where policyname like '%_parent_%' order by tablename;
--
-- 7.3 Test réel (connecté en tant que parent, jamais en service_role) :
--   select count(*) from public.enrollments;   -- ses inscriptions seulement
--   select count(*) from public.grade_entries; -- ses notes seulement
-- ============================================================================