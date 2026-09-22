-- 20260922000001 — P0-2 : RPC atomique d'encaissement idempotent
--
-- Remplace les séquences applicatives non transactionnelles
-- (createPayment finance + collectPayment admissions : insert payment PUIS
-- insert receipt, sans transaction ni clé d'idempotence).
--
-- Garanties : atomicité payment+receipt, idempotence par
-- (school_id, idempotency_key), verrous FOR UPDATE, garde session cash,
-- garde solde sauf avance volontaire.
--
-- Erreurs (raise, SQLSTATE P0001, message préfixé) :
--  ENROLLMENT_NOT_FOUND | CASH_SESSION_REQUIRED | OVERPAY_NOT_ALLOWED:<bal>
--  INVALID_AMOUNT | INVALID_PAYMENT_METHOD | IDEMPOTENCY_KEY_REQUIRED
--
-- Sécurité : SECURITY DEFINER, exécution réservée à service_role
-- (même pattern que finalize_reservation, migration 20260919125531).

create or replace function public.record_payment(
  p_school_id uuid,
  p_enrollment_id uuid,
  p_amount bigint,
  p_payment_method text,
  p_reference text,
  p_cash_session_id uuid,
  p_received_by uuid,
  p_idempotency_key text,
  p_allow_overpay boolean default false,
  -- Guichet admissions : false (comportement historique : cash sans session
  -- ouverte toléré, paiement non rattaché). Caisse/finance : true (discipline
  -- de clôture). Une session explicite invalide = erreur dans tous les cas.
  p_require_cash_session boolean default true,
  -- Base d'URL pour qr_code_data (reçu imprimable /verify/<code>).
  -- Null → code seul.
  p_app_url text default null
)
returns table (
  payment_id uuid,
  receipt_number text,
  verification_code text,
  balance_after bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_receipt_number text;
  v_verification_code text;
  v_expected bigint := 0;
  v_paid bigint := 0;
  v_balance bigint;
  v_has_fee_items boolean := false;
  v_session_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_payment_method not in ('cash', 'mobile_money', 'check', 'transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;


  -- Inscription verrouillée : existence + appartenance école, anti-course.
  perform 1
    from public.enrollments e
    where e.id = p_enrollment_id
      and e.school_id = p_school_id
      and e.deleted_at is null
    for update;

  if not found then
    raise exception 'ENROLLMENT_NOT_FOUND';
  end if;

  -- Paiement cash : session ouverte de l'école, verrouillée.
  v_session_id := p_cash_session_id;
  if p_payment_method = 'cash' then
    if v_session_id is null then
      select s.id into v_session_id
        from public.cash_sessions s
        where s.school_id = p_school_id
          and s.status = 'open'
          and s.deleted_at is null
        for update
        limit 1;
    else
      perform 1
        from public.cash_sessions s
        where s.id = v_session_id
          and s.school_id = p_school_id
          and s.status = 'open'
          and s.deleted_at is null
        for update;
      if not found then
        raise exception 'CASH_SESSION_REQUIRED';
      end if;
    end if;
    if v_session_id is null and p_require_cash_session then
      raise exception 'CASH_SESSION_REQUIRED';
    end if;
  end if;

  -- Rejeu idempotent : même clé → retour de l'existant, zéro doublon.
  select p.id, r.receipt_number, r.verification_code
    into v_payment_id, v_receipt_number, v_verification_code
    from public.payments p
    join public.receipts r on r.payment_id = p.id
    where p.school_id = p_school_id
      and p.idempotency_key = p_idempotency_key
      and p.deleted_at is null
    limit 1;

  if found then
    select coalesce(sum(f.amount), 0)
      into v_expected
      from public.student_fee_items f
      where f.enrollment_id = p_enrollment_id
        and f.deleted_at is null;

    select coalesce(sum(p2.amount), 0)
      into v_paid
      from public.payments p2
      where p2.enrollment_id = p_enrollment_id
        and p2.deleted_at is null;

    v_balance := v_expected - v_paid;

    payment_id := v_payment_id;
    receipt_number := v_receipt_number;
    verification_code := v_verification_code;
    balance_after := case when v_expected > 0 then v_balance else null end;
    return next;
    return;
  end if;

  -- Solde : dû (échéancier) − déjà encaissé.
  select coalesce(sum(f.amount), 0), count(*) > 0
    into v_expected, v_has_fee_items
    from public.student_fee_items f
    where f.enrollment_id = p_enrollment_id
      and f.deleted_at is null;

  select coalesce(sum(p2.amount), 0)
    into v_paid
    from public.payments p2
    where p2.enrollment_id = p_enrollment_id
      and p2.deleted_at is null;

  v_balance := v_expected - v_paid;

  if v_has_fee_items and p_amount > v_balance and not p_allow_overpay then
    raise exception 'OVERPAY_NOT_ALLOWED:%', v_balance;
  end if;

  -- Écritures atomiques. La course résiduelle (deux appels concurrents avec
  -- la même clé passant tous deux le SELECT de rejeu) est absorbée : la
  -- violation d'unicité retourne l'existant au lieu d'échouer.
  begin
    insert into public.payments (
      school_id, enrollment_id, amount, payment_method,
      reference, cash_session_id, received_by, idempotency_key
    ) values (
      p_school_id, p_enrollment_id, p_amount, p_payment_method,
      nullif(p_reference, ''), v_session_id, p_received_by, p_idempotency_key
    )
    returning id into v_payment_id;
  exception when unique_violation then
    select p.id, r.receipt_number, r.verification_code
      into v_payment_id, v_receipt_number, v_verification_code
      from public.payments p
      join public.receipts r on r.payment_id = p.id
      where p.school_id = p_school_id
        and p.idempotency_key = p_idempotency_key
        and p.deleted_at is null
      limit 1;

    if not found then
      raise;
    end if;

    select coalesce(sum(f.amount), 0)
      into v_expected
      from public.student_fee_items f
      where f.enrollment_id = p_enrollment_id
        and f.deleted_at is null;

    select coalesce(sum(p2.amount), 0)
      into v_paid
      from public.payments p2
      where p2.enrollment_id = p_enrollment_id
        and p2.deleted_at is null;

    v_balance := v_expected - v_paid;

    payment_id := v_payment_id;
    receipt_number := v_receipt_number;
    verification_code := v_verification_code;
    balance_after := case when v_expected > 0 then v_balance else null end;
    return next;
    return;
  end;

  v_verification_code := upper(encode(gen_random_bytes(16), 'hex'));
  v_receipt_number :=
    'R-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint))
    || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));

  insert into public.receipts (
    school_id, payment_id, receipt_number,
    verification_code, qr_code_data, issued_by
  ) values (
    p_school_id, v_payment_id, v_receipt_number,
    v_verification_code,
    case
      when nullif(p_app_url, '') is null then v_verification_code
      else rtrim(p_app_url, '/') || '/verify/' || v_verification_code
    end,
    p_received_by
  );

  payment_id := v_payment_id;
  receipt_number := v_receipt_number;
  verification_code := v_verification_code;
  balance_after := case when v_has_fee_items then v_balance - p_amount else null end;
  return next;
end;
$$;

revoke execute on function public.record_payment(uuid, uuid, bigint, text, text, uuid, uuid, text, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_payment(uuid, uuid, bigint, text, text, uuid, uuid, text, boolean, boolean, text)
  to service_role;
