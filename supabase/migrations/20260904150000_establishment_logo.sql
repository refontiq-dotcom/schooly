-- ============================================================================
-- LOGO ÉTABLISSEMENT — logo_url + bucket storage
-- ============================================================================

-- Colonne logo_url
alter table establishments add column if not exists logo_url text;

-- Bucket storage pour les logos (Supabase Storage)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'establishment-logos',
  'establishment-logos',
  true,
  2097152, -- 2MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Politique de lecture publique pour les logos
drop policy if exists "Public read establishment logos" on storage.objects;
create policy "Public read establishment logos"
  on storage.objects for select
  using (bucket_id = 'establishment-logos');

-- Politique d'upload pour les admin de l'établissement
drop policy if exists "Admin upload establishment logo" on storage.objects;
create policy "Admin upload establishment logo"
  on storage.objects for insert
  with check (
    bucket_id = 'establishment-logos'
    and (
      exists (
        select 1 from profiles
        where id = auth.uid()
          and role = 'admin'
      )
    )
  );

-- Politique de suppression pour les admin
drop policy if exists "Admin delete establishment logo" on storage.objects;
create policy "Admin delete establishment logo"
  on storage.objects for delete
  using (
    bucket_id = 'establishment-logos'
    and (
      exists (
        select 1 from profiles
        where id = auth.uid()
          and role = 'admin'
      )
    )
  );
