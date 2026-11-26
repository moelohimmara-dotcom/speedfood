-- Préférences alimentaires du client (goûts, régimes, ALLERGIES, notes) : elles servent au classement personnalisé des restaurants qui proposent l'article recherché.
--
-- Table distincte de `client_profils` (identité, téléphone, quartier) : les allergies sont des données de santé, elles n'ont pas à partager les lectures d'un profil plus large.
-- Régime : un client lit, écrit et supprime UNIQUEMENT sa propre ligne (RLS). Aucune policy pour l'équipe, aucun accès pour anon : l'administration ne lit pas ces données.
-- Les allergies exigent un consentement explicite horodaté (`consentement_sante_le`), sans lequel la ligne est refusée. Supprimer la ligne supprime tout (droit à l'effacement) ;
-- supprimer le compte la supprime aussi (cascade). Les habitudes (restaurants, plats, cuisines déjà commandés) ne sont PAS stockées ici : elles se déduisent des commandes du compte.

create table public.preferences_clients (
  utilisateur_id uuid primary key references auth.users(id) on delete cascade,
  allergies text[] not null default '{}'
    check (allergies <@ array['arachide','fruits_a_coque','lait','oeuf','gluten','poisson','crustaces','mollusques','soja','sesame','moutarde','celeri','lupin','sulfites']::text[]),
  regimes text[] not null default '{}'
    check (regimes <@ array['vegetarien','vegan','sans_porc','sans_alcool']::text[]),
  cuisines_preferees text[] not null default '{}' check (cardinality(cuisines_preferees) <= 12),
  piment text check (piment in ('aucun','doux','fort')),
  budget_max_gnf integer check (budget_max_gnf is null or (budget_max_gnf between 1000 and 5000000)),
  notes text not null default '' check (char_length(notes) <= 500),
  evitements text[] not null default '{}' check (cardinality(evitements) <= 20),
  consentement_sante_le timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  constraint allergies_avec_consentement check (cardinality(allergies) = 0 or consentement_sante_le is not null)
);

create trigger trg_preferences_clients_touch before update on public.preferences_clients
  for each row execute function fn_touch_mis_a_jour();

alter table public.preferences_clients enable row level security;
create policy "client_lit_ses_preferences" on public.preferences_clients for select to authenticated using (utilisateur_id = (select auth.uid()));
create policy "client_cree_ses_preferences" on public.preferences_clients for insert to authenticated with check (utilisateur_id = (select auth.uid()));
create policy "client_modifie_ses_preferences" on public.preferences_clients for update to authenticated using (utilisateur_id = (select auth.uid())) with check (utilisateur_id = (select auth.uid()));
create policy "client_supprime_ses_preferences" on public.preferences_clients for delete to authenticated using (utilisateur_id = (select auth.uid()));
revoke all on public.preferences_clients from anon;
