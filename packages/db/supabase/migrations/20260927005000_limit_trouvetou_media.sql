-- Schooly → Trouvetou : limitation des médias publics.
-- 4 photos classiques maximum par établissement, photo principale comprise.
-- 1 seule source 360° maximum ; le 360 ne doit pas être utilisé pour les salles.

UPDATE public.schools
SET gallery_photos = (
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(gallery_photos) = 'array' THEN gallery_photos
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS t(value, ord)
  WHERE ord <= CASE
    WHEN cover_photo_url IS NOT NULL AND btrim(cover_photo_url) <> '' THEN 3
    ELSE 4
  END
)
WHERE gallery_photos IS NOT NULL;

UPDATE public.schools
SET photos_360 = (
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(photos_360) = 'array' THEN photos_360
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS t(value, ord)
  WHERE ord <= 1
)
WHERE photos_360 IS NOT NULL;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_trouvetou_gallery_max_4;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_trouvetou_gallery_max_4
  CHECK (
    jsonb_typeof(gallery_photos) = 'array'
    AND jsonb_array_length(gallery_photos) <=
      CASE
        WHEN cover_photo_url IS NOT NULL AND btrim(cover_photo_url) <> '' THEN 3
        ELSE 4
      END
  );

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_trouvetou_photos_360_max_1;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_trouvetou_photos_360_max_1
  CHECK (
    jsonb_typeof(photos_360) = 'array'
    AND jsonb_array_length(photos_360) <= 1
  );

COMMENT ON COLUMN public.schools.gallery_photos IS
  'Galerie Trouvetou : maximum 4 photos classiques au total, photo principale comprise.';

COMMENT ON COLUMN public.schools.photos_360 IS
  'Trouvetou : une seule visite 360° par établissement, limitée à l entrée et aux espaces extérieurs accessibles.';
