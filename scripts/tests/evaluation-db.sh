#!/usr/bin/env bash
# Base jetable dans le conteneur LOCAL ; aucun reset de la base de travail.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${SCHOOLY_TEST_DB_CONTAINER:-supabase_db_schooly}"
DB="schooly_evaluation_test_$$"
docker exec "$CONTAINER" createdb -U postgres "$DB"
trap 'docker exec "$CONTAINER" dropdb -U postgres "$DB" >/dev/null' EXIT
sql() { docker exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DB"; }
# Contrat auth minimal du banc de test (les migrations métier restent inchangées).
sql <<'SQL'
create schema auth;
create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
grant usage on schema auth, public to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
SQL
for migration in 20260908090000_tenancy_auth.sql 20260908110000_academic_structure.sql 20260908120000_students_enrollments.sql 20260908150000_pedagogie_notes.sql 20260917040000_evaluation_rules_periods.sql 20260917050000_evaluation_assessments.sql 20260917060000_grade_corrections.sql; do
  sql < "$ROOT/packages/db/supabase/migrations/$migration"
done
sql <<'SQL'
grant select on all tables in schema public to authenticated;
create extension if not exists pgtap;
SQL
sql < "$ROOT/packages/db/tests/evaluation_test.sql" > /tmp/evaluation-pgtap.out 2>&1
status=$?
grep -E 'Failed test|failed tests|died:' /tmp/evaluation-pgtap.out && status=1
cat /tmp/evaluation-pgtap.out
exit "$status"
