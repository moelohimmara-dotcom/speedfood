-- Colonnes internes de `restaurants`, partie A (additive, sans risque) : de quoi lire SANS le droit de table sur `motif_correction` et `suspendu_motif`.
--  - `correction_demandee` (colonne generee, booleen) sert aux filtres et compteurs sans exposer le texte de la correction ;
--  - `fn_motifs_restaurants(ids)` rend les deux motifs aux SEULS membres du restaurant et aux administrateurs systeme.
-- Ordre : 1) cette migration, 2) deploiement du site (qui lit les motifs par cette fonction), 3) migration 20261118120100 (retrait de la lecture directe).
-- Rien n'est retire ici : l'ancien code continue de fonctionner.
alter table public.restaurants
  add column if not exists correction_demandee boolean generated always as (motif_correction is not null) stored;

create or replace function public.fn_motifs_restaurants(p_ids uuid[])
returns table (restaurant_id uuid, motif_correction text, suspendu_motif text)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.motif_correction, r.suspendu_motif
  from restaurants r
  where r.id = any(p_ids)
    and cardinality(p_ids) <= 5000
    and (fn_est_admin_systeme() or fn_est_membre_restaurant(r.id));
$$;
revoke all on function public.fn_motifs_restaurants(uuid[]) from public, anon;
grant execute on function public.fn_motifs_restaurants(uuid[]) to authenticated;
