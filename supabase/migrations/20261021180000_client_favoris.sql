-- Espace client : restaurants favoris (docs/cadrage/PARCOURS-CIBLE-CLIENT-MVP.md §3, « liste des restaurants suivis »).
--
-- Un client connecté enregistre des restaurants. Lecture : le client ne lit QUE ses favoris (policy `to authenticated`, jamais anon).
-- Écritures : par le serveur seulement (clé de service, après vérification de la session et du restaurant) ; plafond de 100 favoris par
-- compte en base. Supprimé avec le compte (RGPD) et avec le restaurant.
create table public.client_favoris (
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (utilisateur_id, restaurant_id)
);
create index client_favoris_restaurant_idx on public.client_favoris (restaurant_id);

alter table public.client_favoris enable row level security;
revoke all on table public.client_favoris from anon;
revoke insert, update, delete, truncate on table public.client_favoris from authenticated;

create policy "client_lit_ses_favoris" on public.client_favoris
  for select to authenticated using (utilisateur_id = (select auth.uid()));

create or replace function public.fn_client_favoris_limite()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.client_favoris where utilisateur_id = new.utilisateur_id) >= 100 then
    raise exception 'Cent restaurants favoris au plus' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_client_favoris_limite() from public, anon, authenticated;
create trigger trg_client_favoris_limite
  before insert on public.client_favoris
  for each row execute function public.fn_client_favoris_limite();
