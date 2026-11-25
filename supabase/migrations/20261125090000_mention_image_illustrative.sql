-- Interrupteur de la mention « Image illustrative » : les images générées par ordinateur (et non la photo du plat réellement servi) portent une
-- mention discrète, visible au survol, sur les fiches de plats et dans « Plats à découvrir ». Même principe que les autres fonctionnalités :
-- le super administrateur peut la couper ou la rétablir sans redéployer (`/system/mises-a-jour`). Active par défaut ; coupée, rien n'est
-- affiché et aucune image n'est modifiée. Une image est « illustrative » quand son adresse est sous `demo/photos/ia/` (plan de rattachement
-- des photos de démonstration).

insert into fonctionnalites (cle, libelle, description, groupe, ordre) values
  ('mention_image_illustrative', 'Mention « Image illustrative » sur les images générées', 'Affiche, au survol de l''image, la mention « Image illustrative : elle ne montre pas le plat réellement servi » sur les images générées par ordinateur (fiches de plats et plats à découvrir). Coupée, la mention disparaît ; les images, elles, restent affichées.', 'public', 90)
on conflict (cle) do nothing;
