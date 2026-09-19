alter table public.users
  add column if not exists is_activated boolean not null default true,
  add column if not exists activated_at timestamptz;

comment on column public.users.is_activated is 'Whether the user has completed the Schooly staff account activation flow.';
comment on column public.users.activated_at is 'Timestamp when the user completed first-time account activation.';

create index if not exists users_activation_lookup_idx
  on public.users (email, phone, is_activated)
  where deleted_at is null;
