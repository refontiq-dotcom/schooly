#!/usr/bin/env bash
# Validation isolée : jamais de reset/push sur la base de travail.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${SCHOOLY_TEST_DB_CONTAINER:-supabase_db_schooly}"
DB="schooly_movements_test_$$"
OUT="$(mktemp)"
docker exec "$CONTAINER" createdb -U postgres "$DB"
trap 'docker exec "$CONTAINER" dropdb -U postgres "$DB" >/dev/null; rm -f "$OUT"' EXIT
sql() { docker exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DB"; }
sql <<'SQL'
create schema auth;
create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
 select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
grant usage on schema auth, public to authenticated;
grant execute on function auth.uid() to authenticated;
SQL
for migration in 20260908090000_tenancy_auth.sql 20260908110000_academic_structure.sql 20260908120000_students_enrollments.sql 20260917100000_student_movement_requests.sql 20260917110000_student_movement_activation.sql 20260917120000_student_movement_import.sql; do
  sql < "$ROOT/packages/db/supabase/migrations/$migration"
done
sql <<'SQL'
create extension if not exists pgtap;
SQL
if ! sql < "$ROOT/packages/db/tests/student_movement_requests_test.sql" > "$OUT" 2>&1; then
  cat "$OUT"; exit 1
fi
cat "$OUT"
if grep -Eq 'not ok|Failed test|failed tests|died:|Looks like' "$OUT"; then exit 1; fi
