-- Marquage des données fictives/démo (catalogue "bien fourni" pré-lancement) :
-- une colonne dédiée plutôt qu'une convention de nommage dans `nom`, pour que
-- `delete from restaurants where donnees_demo = true` supprime proprement tout
-- ce lot plus tard (cascade vers menu_items via la FK déjà en place), sans
-- ambiguïté et sans polluer le nom affiché publiquement.
alter table restaurants add column if not exists donnees_demo boolean not null default false;
