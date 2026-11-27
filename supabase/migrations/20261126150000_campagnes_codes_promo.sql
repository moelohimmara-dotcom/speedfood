-- Campagnes et codes promo réels (chantier console, 26 novembre 2026).
--
-- Une campagne porte un code unique, une règle de remise (pourcentage ou montant fixe), un minimum d'achat,
-- un plafond de remise par commande et un plafond d'utilisations. L'état « brouillon » ne s'applique jamais ;
-- l'activation et la suspension sont des gestes explicites de l'équipe. Les utilisations sont comptées à la
-- création de la commande, côté serveur, jamais d'après le navigateur.
create table public.campagnes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,32}$'),
  nom text not null check (char_length(nom) between 1 and 120),
  type_remise text not null check (type_remise in ('pourcentage', 'montant')),
  valeur integer not null check (valeur > 0),
  minimum_achat_gnf integer not null default 0 check (minimum_achat_gnf >= 0),
  plafond_montant_gnf integer not null check (plafond_montant_gnf > 0),
  plafond_utilisations integer not null check (plafond_utilisations > 0),
  utilisations integer not null default 0 check (utilisations >= 0),
  debut timestamptz not null,
  fin timestamptz not null check (fin > debut),
  etat text not null default 'brouillon' check (etat in ('brouillon', 'active', 'suspendue')),
  ciblage text not null default 'Tous les clients',
  cree_le timestamptz not null default now()
);

alter table public.campagnes enable row level security;
-- Aucune policy : seul le serveur (clé de service) lit et écrit les campagnes.

-- Trace de la remise sur la commande : le code appliqué et le montant déduit du sous-total.
alter table public.orders
  add column if not exists code_promo text,
  add column if not exists remise_promo_gnf integer not null default 0 check (remise_promo_gnf >= 0);

-- Les lectures de la console passent par des droits de colonne explicites (migration 20261019100100) :
-- les deux nouvelles colonnes doivent être accordées comme les autres, sinon les lectures du restaurant cassent.
grant select (code_promo, remise_promo_gnf) on public.orders to authenticated;
