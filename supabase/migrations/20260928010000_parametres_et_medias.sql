-- Console d'administration — paramètres globaux + colonnes images.
--
-- 1. Paramètres application : table singleton (une seule ligne, jamais deux —
--    `id boolean primary key default true check (id)` empêche toute deuxième
--    ligne). Remplace deux constantes jusqu'ici dupliquées en dur dans le code
--    (COMMANDE_PROPOSITION_DELAI_MINUTES en variable d'env, PRIX_MAX_GNF
--    codé en dur dans src/lib/menu/actions.ts — pas la même constante que
--    src/lib/commande/validation.ts, qui reste un plafond défensif sur les
--    données déjà en base, volontairement inchangé).
-- 2. Colonnes images : restaurants/menu_items/content_banners. Aucune de ces
--    colonnes n'entre dans fn_proteger_colonnes_restaurant (bloc 7/8b) : ce
--    ne sont pas des colonnes de modération, le propriétaire du restaurant
--    doit pouvoir les changer librement, comme horaires/consignes déjà.

create table parametres_application (
  id boolean primary key default true check (id),
  commande_proposition_delai_minutes integer not null default 30
    check (commande_proposition_delai_minutes between 1 and 1440),
  prix_plat_max_gnf integer not null default 5000000
    check (prix_plat_max_gnf between 0 and 10000000),
  mis_a_jour_le timestamptz not null default now(),
  mis_a_jour_par uuid references auth.users(id)
);

insert into parametres_application (id) values (true);

alter table parametres_application enable row level security;

create policy "admins_lecture_parametres" on parametres_application
  for select using (fn_est_admin_systeme());

create policy "super_admin_maj_parametres" on parametres_application
  for update using (fn_est_admin_systeme(array['super_admin']))
  with check (fn_est_admin_systeme(array['super_admin']));

alter table restaurants add column if not exists photo_url text;
alter table menu_items add column if not exists photo_url text;
alter table content_banners add column if not exists image_url text;
