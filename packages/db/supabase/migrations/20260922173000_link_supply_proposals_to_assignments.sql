-- Raccord explicite entre une proposition de fournitures et l'affectation
-- pédagogique réelle classe × matière × professeur.
alter table public.school_supply_proposals
  add column if not exists assignment_id uuid references public.class_subject_assignments(id) on delete cascade;

create index if not exists idx_supply_proposals_assignment
  on public.school_supply_proposals(assignment_id)
  where deleted_at is null;

-- Les anciennes lignes éventuelles restent compatibles; toutes les nouvelles
-- propositions créées par Schooly portent désormais assignment_id.
