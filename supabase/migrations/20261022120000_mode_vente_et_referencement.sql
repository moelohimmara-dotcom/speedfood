-- Modèle « Speedfood intermédiaire » (ADR-020, DECISIONS-MODELE.md) : réglage par restaurant et demandes de référencement.
--
-- `mode_vente` : « autonome » (comme jusqu'ici : le restaurant tient sa page, ses prix, sa livraison) ou « speedfood » (l'équipe tient
-- le catalogue, Speedfood encaisse pour le compte du restaurant et livre). Réservé aux administrateurs : un restaurateur ne peut pas
-- se faire passer d'un mode à l'autre (même garde que `publie` : voir le déclencheur ci-dessous).
-- `referencement_demandes` : formulaire public « Demander à être référencé » (remplace l'inscription libre des restaurateurs). Table
-- réservée au serveur (aucun accès navigateur) ; les coordonnées sont des données personnelles, consentement horodaté.

alter table public.restaurants
  add column mode_vente text not null default 'autonome' check (mode_vente in ('autonome', 'speedfood'));

create or replace function public.fn_proteger_colonnes_restaurant()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.publie is distinct from old.publie
     or new.suspendu_le is distinct from old.suspendu_le
     or new.suspendu_motif is distinct from old.suspendu_motif
     or new.motif_correction is distinct from old.motif_correction
     or new.avis_somme is distinct from old.avis_somme
     or new.avis_total is distinct from old.avis_total
     or new.gamme_validee is distinct from old.gamme_validee
     or new.mode_vente is distinct from old.mode_vente then
    if not fn_est_admin_systeme() then
      raise exception 'Seul un administrateur systeme peut modifier la publication, la suspension, la correction demandee, les notes, la gamme validee ou le mode de vente d''un restaurant';
    end if;
  end if;

  return new;
end;
$function$;

create table public.referencement_demandes (
  id uuid primary key default gen_random_uuid(),
  type_etablissement text not null check (type_etablissement in ('restaurant', 'epicerie')),
  organisation text not null check (char_length(organisation) between 2 and 120),
  commune text not null check (char_length(commune) between 2 and 80),
  quartier text not null check (char_length(quartier) between 2 and 80),
  indications text check (indications is null or char_length(indications) <= 300),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  categories text check (categories is null or char_length(categories) <= 200),
  specialites text check (specialites is null or char_length(specialites) <= 200),
  responsable_prenom text not null check (char_length(responsable_prenom) between 1 and 60),
  responsable_nom text not null check (char_length(responsable_nom) between 1 and 60),
  contact_email text not null check (char_length(contact_email) between 6 and 120),
  contact_telephone text not null check (char_length(contact_telephone) between 6 and 20),
  consentement_le timestamptz not null default now(),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'rappelee', 'visite_prevue', 'accord', 'refusee', 'creee')),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  traitee_le timestamptz,
  cree_le timestamptz not null default now(),
  -- Les deux coordonnées vont ensemble.
  constraint referencement_gps_complet check ((latitude is null) = (longitude is null))
);

create index referencement_demandes_statut_idx on public.referencement_demandes (statut, cree_le desc);
create index referencement_demandes_restaurant_idx on public.referencement_demandes (restaurant_id) where restaurant_id is not null;

alter table public.referencement_demandes enable row level security;
revoke all on public.referencement_demandes from anon, authenticated;
create policy "aucun_acces_direct" on public.referencement_demandes for all to anon, authenticated using (false) with check (false);
