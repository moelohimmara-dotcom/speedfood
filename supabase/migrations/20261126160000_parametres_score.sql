-- Réglages du score qualité pilotables depuis la console (chantier console, 26 novembre 2026).
--
-- Une seule ligne de réglages : les seuils des paliers (strictement décroissants) et le délai d'acceptation
-- compté pour l'indicateur « acceptation dans le délai ». Les valeurs par défaut sont celles décidées le
-- 22 novembre 2026 ; le calcul retombe sur ces mêmes valeurs tant que la table est absente.
create table public.parametres_score (
  id boolean primary key default true check (id),
  seuil_excellent integer not null default 80 check (seuil_excellent between 1 and 100),
  seuil_tres_bon integer not null default 65 check (seuil_tres_bon between 1 and 99),
  seuil_bon integer not null default 50 check (seuil_bon between 1 and 98),
  seuil_moyen integer not null default 35 check (seuil_moyen between 1 and 97),
  delai_acceptation_secondes integer not null default 690 check (delai_acceptation_secondes between 30 and 7200),
  mis_a_jour_le timestamptz not null default now(),
  check (seuil_excellent > seuil_tres_bon and seuil_tres_bon > seuil_bon and seuil_bon > seuil_moyen)
);

insert into public.parametres_score (id) values (true) on conflict (id) do nothing;

alter table public.parametres_score enable row level security;
-- Aucune policy : seul le serveur (clé de service) lit et écrit ces réglages.
