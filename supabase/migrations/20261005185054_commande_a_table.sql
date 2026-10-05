-- Lot 4 (5 octobre 2026) : commande « à table » (QR de table). Un restaurant doit l'activer ; la commande porte un numéro de table.
-- Le numéro de table vient du QR scanné mais n'est jamais une autorisation : le serveur vérifie que le restaurant accepte le service à table.
alter table public.restaurants add column accepte_sur_place boolean not null default false;

alter table public.orders drop constraint orders_mode_check;
alter table public.orders add constraint orders_mode_check check (mode in ('retrait', 'livraison', 'sur_place'));
alter table public.orders add column table_numero text check (table_numero is null or table_numero ~ '^[A-Za-z0-9 -]{1,10}$');
alter table public.orders add constraint orders_table_si_sur_place check ((mode = 'sur_place') = (table_numero is not null));
