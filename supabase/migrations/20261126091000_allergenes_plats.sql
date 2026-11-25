-- Allergènes des plats, DÉCLARÉS par le restaurant. Trois états, jamais confondus :
--   null      = non renseigné (le restaurant n'a rien déclaré : l'appli dit « à vérifier », jamais « sans allergène »)
--   '{}'      = le restaurant déclare qu'il n'y a AUCUN des 14 allergènes réglementaires
--   liste     = allergènes présents
-- `allergenes_declares_le` date la déclaration. Le restaurateur écrit ces colonnes comme les autres colonnes de son menu (mêmes policies de `menu_items`) ; la lecture publique du menu
-- les expose, comme le nom et le prix. Les 14 allergènes sont ceux de la liste réglementaire européenne.

alter table public.menu_items
  add column allergenes text[]
    check (allergenes is null or allergenes <@ array['arachide','fruits_a_coque','lait','oeuf','gluten','poisson','crustaces','mollusques','soja','sesame','moutarde','celeri','lupin','sulfites']::text[]),
  add column allergenes_declares_le timestamptz;

-- Une déclaration porte toujours sa date, et une absence de déclaration n'en porte pas.
alter table public.menu_items
  add constraint allergenes_et_date check ((allergenes is null) = (allergenes_declares_le is null));
