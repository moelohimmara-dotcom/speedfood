-- « Aide-moi à choisir » (voir docs/AIDE-AU-CHOIX.md) : gamme de prix des restaurants, contestation de la gamme, réglages de l'exploitation,
-- quartier retenu sur le compte du client.
--
-- Toutes les ÉCRITURES passent par le serveur (clé de service) : l'identité et l'appartenance au restaurant sont vérifiées côté serveur.
-- La gamme est CALCULÉE à partir des prix réels (seuils ci-dessous) ; `gamme_validee` ne sert qu'aux cas où l'exploitation accepte la
-- demande d'un restaurateur, et n'est modifiable que par un administrateur système.

-- ---------------------------------------------------------------- gamme validée d'un restaurant
alter table public.restaurants
  add column gamme_validee text check (gamme_validee is null or gamme_validee in ('economique', 'intermediaire', 'haut_de_gamme', 'premium'));

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
     or new.gamme_validee is distinct from old.gamme_validee then
    if not fn_est_admin_systeme() then
      raise exception 'Seul un administrateur systeme peut modifier la publication, la suspension, la correction demandee, les notes ou la gamme validee d''un restaurant';
    end if;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------- demandes de changement de gamme
create table public.gamme_demandes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  gamme_demandee text not null check (gamme_demandee in ('economique', 'intermediaire', 'haut_de_gamme', 'premium')),
  motif text not null check (char_length(motif) between 10 and 300),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  demande_par uuid references auth.users (id) on delete set null,
  motif_decision text check (motif_decision is null or char_length(motif_decision) <= 300),
  decide_par uuid references auth.users (id) on delete set null,
  decide_le timestamptz,
  cree_le timestamptz not null default now()
);
-- Une seule demande en attente par restaurant.
create unique index gamme_demandes_une_en_attente on public.gamme_demandes (restaurant_id) where statut = 'en_attente';
create index gamme_demandes_attente_idx on public.gamme_demandes (cree_le) where statut = 'en_attente';

alter table public.gamme_demandes enable row level security;
create policy "restaurant_lit_ses_demandes_de_gamme" on public.gamme_demandes
  for select to authenticated using (public.fn_est_membre_restaurant(restaurant_id));
create policy "exploitation_lecture_demandes_de_gamme" on public.gamme_demandes
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
revoke all on table public.gamme_demandes from anon;
revoke insert, update, delete, truncate on table public.gamme_demandes from authenticated;

-- ---------------------------------------------------------------- réglages (super administrateur)
create table public.parametres_aide_choix (
  id boolean primary key default true check (id),
  -- Bornes hautes incluses du prix typique (médiane des plats disponibles), en GNF.
  seuil_economique_gnf integer not null default 25000 check (seuil_economique_gnf between 1000 and 10000000),
  seuil_intermediaire_gnf integer not null default 50000 check (seuil_intermediaire_gnf between 1000 and 10000000),
  seuil_haut_de_gamme_gnf integer not null default 100000 check (seuil_haut_de_gamme_gnf between 1000 and 10000000),
  rayon_defaut_km numeric(4, 1) not null default 5 check (rayon_defaut_km between 0.5 and 50),
  marge_au_dessus_pct integer not null default 25 check (marge_au_dessus_pct between 0 and 100),
  nb_propositions integer not null default 5 check (nb_propositions between 1 and 10),
  mis_a_jour_le timestamptz not null default now(),
  mis_a_jour_par uuid references auth.users (id) on delete set null,
  constraint parametres_aide_choix_seuils_croissants check (seuil_economique_gnf < seuil_intermediaire_gnf and seuil_intermediaire_gnf < seuil_haut_de_gamme_gnf)
);
insert into public.parametres_aide_choix (id) values (true);

alter table public.parametres_aide_choix enable row level security;
create policy "super_admin_lecture_parametres_aide_choix" on public.parametres_aide_choix
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_maj_parametres_aide_choix" on public.parametres_aide_choix
  for update to authenticated
  using (public.fn_est_admin_systeme(array['super_admin']))
  with check (public.fn_est_admin_systeme(array['super_admin']));
revoke all on table public.parametres_aide_choix from anon;
revoke insert, delete, truncate on table public.parametres_aide_choix from authenticated;

-- ---------------------------------------------------------------- quartier retenu sur le compte (facultatif, supprimable)
alter table public.client_profils
  add column quartier_prefere_id uuid references public.neighborhoods (id) on delete set null;
