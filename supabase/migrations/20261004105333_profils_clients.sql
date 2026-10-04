-- Comptes clients (facultatifs, connexion Facebook d'abord) : un profil minimal par utilisateur, visible de lui seul.
-- Aucune donnee de commande n'est liee au compte a ce stade. Le pseudo et l'avatar viennent d'une liste fermee / d'un
-- format borne ; l'interrupteur de la connexion Facebook se regle depuis la console admin.
create table public.client_profils (
  utilisateur_id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 3 and 24 and pseudo ~ '^[A-Za-zÀ-ÿ0-9 _.-]+$'),
  avatar text not null check (avatar in ('burger', 'pizza', 'riz', 'poulet', 'poisson', 'cafe', 'pain', 'salade', 'brochette', 'glace')),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

alter table public.client_profils enable row level security;
revoke all on public.client_profils from anon;

create policy "client_lit_son_profil" on public.client_profils
  for select to authenticated using (utilisateur_id = (select auth.uid()));
create policy "client_cree_son_profil" on public.client_profils
  for insert to authenticated with check (utilisateur_id = (select auth.uid()));
create policy "client_modifie_son_profil" on public.client_profils
  for update to authenticated using (utilisateur_id = (select auth.uid())) with check (utilisateur_id = (select auth.uid()));

create trigger trg_client_profils_touch before update on public.client_profils
  for each row execute function public.fn_touch_mis_a_jour();

alter table public.parametres_application
  add column connexion_facebook_active boolean not null default false;
