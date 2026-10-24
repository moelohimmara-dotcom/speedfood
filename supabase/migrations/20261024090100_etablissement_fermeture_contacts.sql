-- Lots L5, L6 et L7 de la console d'administration : la vie d'un établissement tenu par l'équipe.
--
-- Trois tables « serveur uniquement », comme `restaurant_contacts_internes` : aucun accès navigateur,
-- la RLS est activee et une seule policy refuse tout acces direct. Seuls les services serveur
-- (`creerClientAdmin()`) les lisent et les ecrivent, apres controle de la permission systeme.
--
-- L5 — `etablissement_menu_confirmations` : trace des confirmations de menu et des rappels envoyes
--      a l'etablissement avant le service (le menu lui-meme vit dans `menu_items`).
-- L6 — `etablissement_fermetures` : fermetures et suspensions, avec motif ecrit, duree, message
--      affiche aux clients et reprise planifiee. `consigne_precedente` garde les consignes du
--      restaurant avant que le message public ne les remplace, pour les restaurer a la levee.
-- L7 — `etablissement_contacts` : journal des contacts (appel, visite, relance, WhatsApp) avec
--      compte rendu, prochaine action et echeance suivie comme rappel.

-- ---------------------------------------------------------------------------
-- L5 — confirmations de menu et rappels
-- ---------------------------------------------------------------------------
create table public.etablissement_menu_confirmations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type_evenement text not null check (type_evenement in ('confirmation', 'rappel')),
  -- Nombre de plats concernes par l'evenement (confirmation) ou par le rappel (rappel).
  plats_concernes integer not null default 0 check (plats_concernes >= 0),
  -- Canal du rappel : 'interne' (notification interne) ou 'appel'. Sans objet pour une confirmation.
  canal text check (canal is null or canal in ('interne', 'appel')),
  note text check (note is null or char_length(note) <= 500),
  cree_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  -- Un rappel declare toujours son canal ; une confirmation n'en a pas.
  constraint menu_confirmation_canal_selon_evenement check (
    (type_evenement = 'rappel' and canal is not null) or (type_evenement = 'confirmation' and canal is null)
  )
);

alter table public.etablissement_menu_confirmations enable row level security;
revoke all on public.etablissement_menu_confirmations from anon, authenticated;
create policy "aucun_acces_direct" on public.etablissement_menu_confirmations
  for all to anon, authenticated using (false) with check (false);

create index idx_etablissement_menu_confirmations_restaurant
  on public.etablissement_menu_confirmations (restaurant_id, cree_le desc);

-- ---------------------------------------------------------------------------
-- L6 — fermetures et suspensions
-- ---------------------------------------------------------------------------
create table public.etablissement_fermetures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type_fermeture text not null check (type_fermeture in ('suspension', 'fermeture')),
  -- Motif ecrit obligatoire : il reste dans le journal d'audit.
  motif text not null check (char_length(motif) between 5 and 1000),
  -- Message affiche aux clients sur la fiche publique.
  message_public text not null check (char_length(message_public) between 5 and 500),
  duree_heures integer not null check (duree_heures between 1 and 8760),
  -- Reprise planifiee (null = l'equipe la fixera a la main).
  reprise_le timestamptz,
  -- Consignes du restaurant avant le message public : restaurees a la levee si elles n'ont pas change.
  consigne_precedente text,
  -- Etat du restaurant avant la decision : la levee restaure exactement cet etat.
  ouvert_avant boolean not null default true,
  accepte_commandes_avant boolean not null default true,
  -- Renseignee quand l'equipe reactive l'etablissement.
  leve_le timestamptz,
  leve_par uuid references auth.users (id) on delete set null,
  cree_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  -- Une reprise planifiee est toujours dans le futur par rapport a la creation.
  constraint fermeture_reprise_dans_le_futur check (reprise_le is null or reprise_le > cree_le)
);

alter table public.etablissement_fermetures enable row level security;
revoke all on public.etablissement_fermetures from anon, authenticated;
create policy "aucun_acces_direct" on public.etablissement_fermetures
  for all to anon, authenticated using (false) with check (false);

create index idx_etablissement_fermetures_restaurant
  on public.etablissement_fermetures (restaurant_id, cree_le desc);
-- Index partiel : seules les fermetures en cours sont cherchees a chaque affichage.
create index idx_etablissement_fermetures_en_cours
  on public.etablissement_fermetures (restaurant_id) where leve_le is null;

-- ---------------------------------------------------------------------------
-- L7 — journal des contacts
-- ---------------------------------------------------------------------------
create table public.etablissement_contacts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type_contact text not null check (type_contact in ('appel', 'visite', 'relance', 'whatsapp')),
  compte_rendu text not null check (char_length(compte_rendu) between 1 and 2000),
  prochaine_action text check (prochaine_action is null or char_length(prochaine_action) <= 300),
  -- Echeance de la prochaine action, suivie comme rappel par la console.
  echeance_le timestamptz,
  cree_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  -- Une echeance n'a de sens qu_WITH une prochaine action ecrite.
  constraint contact_echeance_avec_action check (
    echeance_le is null or (prochaine_action is not null and char_length(btrim(prochaine_action)) > 0)
  )
);

alter table public.etablissement_contacts enable row level security;
revoke all on public.etablissement_contacts from anon, authenticated;
create policy "aucun_acces_direct" on public.etablissement_contacts
  for all to anon, authenticated using (false) with check (false);

create index idx_etablissement_contacts_restaurant
  on public.etablissement_contacts (restaurant_id, cree_le desc);
-- Les echeances en retard sont cherchees a chaque affichage du journal.
create index idx_etablissement_contacts_echeance
  on public.etablissement_contacts (echeance_le) where echeance_le is not null;
