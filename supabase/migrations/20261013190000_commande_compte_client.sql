-- Identification obligatoire pour commander (TDR v0.2 §5.1, décision du 13 octobre 2026) :
-- chaque nouvelle commande est rattachée au compte qui l'envoie. Colonne facultative : les commandes
-- invitées déjà enregistrées restent valides et gardent `client_user_id` vide.
-- La RLS des commandes ne change pas : les écritures passent par le serveur (service-role, ADR-011).

alter table public.orders
  add column if not exists client_user_id uuid references auth.users (id) on delete set null;

create index if not exists orders_client_user_id_idx on public.orders (client_user_id);
