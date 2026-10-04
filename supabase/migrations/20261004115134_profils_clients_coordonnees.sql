-- Coordonnees de commande memorisees par le client connecte (preremplissage). Facultatives, enregistrees seulement quand
-- il coche « Memoriser mes informations » a la commande, effacables a tout moment, supprimees avec le compte.
-- Visibles du seul client (RLS de client_profils inchangee). Le telephone est normalise (+224 puis 9 chiffres).
alter table public.client_profils
  add column nom_commande text check (nom_commande is null or char_length(nom_commande) between 2 and 120),
  add column telephone text check (telephone is null or telephone ~ '^\+224[67][0-9]{8}$'),
  add column adresse text check (adresse is null or char_length(adresse) between 5 and 300),
  add column coordonnees_enregistrees_le timestamptz;
