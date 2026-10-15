-- Interrupteurs des nouveautés de zones : « Utiliser ma position », liste d'attente par zone et affichage de la livraison par zone.
-- Même principe que les autres fonctionnalités : le super administrateur peut les couper ou les rétablir sans redéployer
-- (`/system/mises-a-jour`). Actives par défaut ; couper une fonctionnalité masque l'écran concerné et ferme sa route, sans rien supprimer.

insert into fonctionnalites (cle, libelle, description, groupe, ordre) values
  ('zone_position', 'Bouton « Utiliser ma position »', 'Retrouve la commune ou le quartier du visiteur à partir de sa position (après son clic et l''accord de son appareil). Coupé, le bouton disparaît et la route de localisation est fermée ; le choix de zone à la main reste disponible.', 'public', 60),
  ('zone_liste_attente', 'Liste d''attente par zone', 'Formulaire « Prévenez-moi quand un restaurant ouvre ici » dans les zones sans restaurant. Coupé, le formulaire disparaît et plus aucun contact n''est enregistré ; les contacts déjà recueillis restent en base.', 'public', 70),
  ('zones_livraison', 'Livraison par zone sur les cartes et fiches', 'Affiche « Livre à … » sur les cartes de restaurants (zone choisie) et la section « Livraison et retrait » des fiches, d''après les zones déclarées par les restaurateurs. Coupé, rien n''est affiché ; les déclarations restent enregistrées.', 'restaurant', 80)
on conflict (cle) do nothing;
