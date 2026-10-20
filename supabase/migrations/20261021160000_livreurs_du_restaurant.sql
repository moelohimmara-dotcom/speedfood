-- Livreurs du restaurant (module livreurs V2, lot 1 : docs/LIVRAISON-LIVREURS-V2.md §4, §5, §10).
--
-- Un restaurant peut tenir son propre registre de livreurs (étape 1) : ils ne travaillent que pour lui, ne reçoivent jamais d'offre du groupe
-- Speedfood, et ne peuvent pas être affectés à la livraison d'un autre restaurant. Toutes les écritures passent par le serveur (clé de
-- service) ; un restaurateur ne fait que LIRE ses propres livreurs (policy réservée aux membres, `to authenticated`).

alter table public.livreurs
  add column restaurant_id uuid references public.restaurants (id) on delete cascade,
  add column origine text not null default 'exploitation' check (origine in ('exploitation', 'auto_inscription', 'restaurant')),
  add column verifie_speedfood boolean not null default false;

-- Cohérence : un livreur de restaurant a un restaurant, tout autre n'en a pas.
alter table public.livreurs
  add constraint livreurs_restaurant_origine check ((restaurant_id is null) = (origine <> 'restaurant'));

-- Les livreurs déjà approuvés par l'exploitation sont « vérifiés par Speedfood » ; les livreurs d'un restaurant ne le sont jamais d'office.
update public.livreurs set verifie_speedfood = true where approuve_le is not null and restaurant_id is null;

-- Unicité du téléphone : parmi les fiches non archivées du groupe Speedfood, et PAR restaurant (une personne peut livrer pour deux restaurants).
drop index if exists public.livreurs_telephone_non_archive_uq;
create unique index livreurs_telephone_groupe_uq on public.livreurs (telephone)
  where telephone is not null and cycle <> 'archive' and restaurant_id is null;
create unique index livreurs_telephone_restaurant_uq on public.livreurs (restaurant_id, telephone)
  where telephone is not null and cycle <> 'archive' and restaurant_id is not null;
create index livreurs_restaurant_idx on public.livreurs (restaurant_id) where restaurant_id is not null;

-- Le rattachement d'un livreur ne change jamais : pour changer de restaurant, on archive la fiche et on en crée une autre.
create or replace function public.fn_livreur_rattachement_immuable()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.restaurant_id is distinct from old.restaurant_id or new.origine is distinct from old.origine then
    raise exception 'Le rattachement d''un livreur ne se modifie pas' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_livreur_rattachement_immuable() from public, anon, authenticated;
create trigger trg_livreur_rattachement_immuable
  before update on public.livreurs
  for each row execute function public.fn_livreur_rattachement_immuable();

-- Un livreur d'un restaurant ne peut être affecté qu'à une livraison de CE restaurant (garantie de base, quel que soit le code appelant).
create or replace function public.fn_livraison_livreur_coherent()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_restaurant uuid;
begin
  if new.livreur_id is null then
    return new;
  end if;
  select restaurant_id into v_restaurant from public.livreurs where id = new.livreur_id;
  if v_restaurant is not null and v_restaurant is distinct from new.restaurant_id then
    raise exception 'Ce livreur ne travaille que pour son restaurant' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_livraison_livreur_coherent() from public, anon, authenticated;
create trigger trg_livraison_livreur_coherent
  before insert or update of livreur_id on public.livraisons
  for each row execute function public.fn_livraison_livreur_coherent();

-- Lecture : un membre du restaurant lit les livreurs de SON restaurant (en plus de ceux qui ont déjà livré pour lui, policy existante).
create policy "restaurant_lit_ses_livreurs" on public.livreurs
  for select to authenticated
  using (restaurant_id is not null and public.fn_est_membre_restaurant(restaurant_id));
