-- Six variables CSS ajoutées le 19 octobre 2026 à globals.css (revue du design, bouton désactivé lisible) n'avaient pas leur jeton :
-- le test `scripts/tests/design.test.mts` exige qu'à chaque variable du site corresponde un jeton éditable. Cette migration les ajoute,
-- avec EXACTEMENT les valeurs de globals.css (aucun changement visuel). Elle ne touche pas à la migration d'origine, déjà appliquée.
--
-- Le trigger `trg_garde_jetons_design` refuse toute écriture qui ne vient pas du rôle de service (la migration d'origine semait avant de le
-- créer). On le désactive ICI, dans la même transaction que l'insertion, puis on le réactive : si quoi que ce soit échoue, toute la
-- transaction est annulée et le garde reste en place.
alter table public.design_tokens disable trigger trg_garde_jetons_design;

insert into public.design_tokens (portee, cle, valeur, libelle, groupe) values
  ('site', 'couleur.avertissement-fond',  '#fdf0de', 'Fond d''avertissement',            'couleurs'),
  ('site', 'couleur.avertissement-texte', '#8a4b00', 'Texte d''avertissement',           'couleurs'),
  ('site', 'couleur.surface-alt',         '#fffaf3', 'Surface alternative',              'couleurs'),
  ('site', 'couleur.desactive-fond',      '#e9dcd2', 'Fond d''un bouton désactivé',      'couleurs'),
  ('site', 'couleur.desactive-texte',     '#4a4039', 'Texte d''un bouton désactivé',     'couleurs'),
  ('site', 'forme.rayon-xl',              '24px',    'Rayon très grand',                 'formes')
on conflict do nothing;

alter table public.design_tokens enable trigger trg_garde_jetons_design;
