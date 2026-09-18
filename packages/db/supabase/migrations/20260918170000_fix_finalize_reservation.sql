-- ============================================================================
-- 20260918170000 — Correctif de public.finalize_reservation()
--
-- Constat d'audit : la fonction créée par 20260910030000 écrivait dans
-- `public.students (birth_date)` — colonne INEXISTANTE. La colonne réelle est
-- `date_of_birth`, et elle est `not null`. Toute finalisation d'une réservation
-- Trouvetou échouait donc à l'exécution (« column "birth_date" does not exist »),
-- remontée en 500 « Echec de la finalisation » sans indice exploitable.
--
-- Trois autres fragilités corrigées au passage, toutes silencieuses :
--   1. `students.date_of_birth` est NOT NULL alors que
--      `trouvetou_reservations.student_birthdate` est nullable : l'insertion
--      échouait aussi quand le parent n'avait pas fourni la date. On refuse
--      désormais explicitement (retour false) plutôt que d'inventer une date.
--   2. `enrollments.academic_year_id` est NOT NULL : sans année active,
--      l'insertion échouait. On refuse explicitement (retour false).
--   3. Le découpage du nom (`split_part` + `substring`) produisait un nom de
--      famille vide pour un nom en un seul mot, et dupliquait le prénom. On
--      découpe proprement et on retombe sur le prénom si le nom est absent.
--
-- Ajout d'un anti-doublon : si un élève du même nom est né le même jour dans la
-- même école, sa fiche est RÉUTILISÉE au lieu d'en créer une seconde — un
-- parent qui réserve deux places (ou une réactivation après expiration) ne doit
-- pas dupliquer l'enfant.
--
-- La signature est inchangée (`uuid → boolean`) : la route
-- /api/v1/admin/trouvetou/reservations/finalize n'a pas à être modifiée.
--
-- Idempotent : `create or replace function`.
-- ============================================================================

create or replace function public.finalize_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_guardian_id uuid;
  v_student_id uuid;
  v_year_id uuid;
  v_first text;
  v_last text;
begin
  select * into v_res
    from public.trouvetou_reservations
   where id = p_reservation_id
   for update;

  if not found then return false; end if;
  if v_res.status <> 'reserved' then return false; end if;

  -- 1. Année active de l'école (obligatoire : enrollments.academic_year_id not null)
  select id into v_year_id
    from public.academic_years
   where school_id = v_res.school_id
     and status = 'active'
     and deleted_at is null
   order by created_at desc
   limit 1;

  if v_year_id is null then return false; end if;

  -- 2. Date de naissance obligatoire (students.date_of_birth not null).
  --    On refuse plutôt que d'inventer une date : la réservation reste
  --    'reserved', le secrétariat peut la compléter et relancer.
  if v_res.student_birthdate is null then return false; end if;

  -- 3. Découpage du nom complet : premier mot = prénom, reste = nom.
  v_first := split_part(btrim(v_res.student_full_name), ' ', 1);
  v_last  := btrim(substr(btrim(v_res.student_full_name), length(v_first) + 1));
  if v_last = '' then
    v_last := v_first;
  end if;

  -- 4. Tuteur : réutilisé par téléphone, sinon créé
  select id into v_guardian_id
    from public.guardians
   where public.normalize_phone(phone) = public.normalize_phone(v_res.parent_phone)
     and deleted_at is null
   limit 1;

  if v_guardian_id is null then
    insert into public.guardians (full_name, phone, email)
    values (v_res.parent_full_name, v_res.parent_phone, v_res.parent_email)
    returning id into v_guardian_id;
  end if;

  -- 5. Élève : réutilisé si la même identité existe déjà dans l'école
  select id into v_student_id
    from public.students
   where school_id = v_res.school_id
     and deleted_at is null
     and lower(btrim(first_name)) = lower(v_first)
     and lower(btrim(last_name)) = lower(v_last)
     and date_of_birth = v_res.student_birthdate
   limit 1;

  if v_student_id is null then
    insert into public.students (school_id, first_name, last_name, date_of_birth)
    values (v_res.school_id, v_first, v_last, v_res.student_birthdate)
    returning id into v_student_id;
  end if;

  -- 6. Inscription confirmée
  insert into public.enrollments (
    school_id, student_id, guardian_id, grade_level_id, academic_year_id,
    status, enrollment_date, enrollment_type, state_orientation
  )
  values (
    v_res.school_id, v_student_id, v_guardian_id, v_res.grade_level_id, v_year_id,
    'confirmed', current_date, 'nouvelle', 'non_oriente'
  );

  -- 7. Clôture de la réservation
  update public.trouvetou_reservations
     set status = 'confirmed'
   where id = p_reservation_id;

  return true;
end;
$$;

comment on function public.finalize_reservation(uuid) is
  'Finalise une réservation Trouvetou : crée (ou réutilise) tuteur et élève, puis l''inscription. false si année active absente ou date de naissance manquante.';
