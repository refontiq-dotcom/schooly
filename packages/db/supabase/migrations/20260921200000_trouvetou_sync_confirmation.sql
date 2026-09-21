-- Trace la CONFIRMATION reelle de synchronisation Trouvetou, distincte du
-- simple flag `published_to_trouvetou` (qui reflete juste l'intention/dernier
-- appel, et peut rester "true" alors qu'aucune fiche n'existe cote Trouvetou --
-- cas constate pour ITES : le flag a ete mis a true par un appel effectue
-- AVANT que Trouvetou ne cree la ligne `listings` correspondante).
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS trouvetou_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS trouvetou_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN public.schools.trouvetou_listing_id IS
  'ID de la ligne `listings` correspondante cote Trouvetou, renvoye par POST /api/v1/sync/schooly. NULL = jamais confirme par Trouvetou, meme si published_to_trouvetou = true.';
COMMENT ON COLUMN public.schools.trouvetou_synced_at IS
  'Horodatage de la derniere synchronisation CONFIRMEE (listing_id recu) avec Trouvetou.';
