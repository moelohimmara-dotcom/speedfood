-- Interrupteur d'urgence de l'accueil en blocs (Studio, palier 3) : coupé, le site affiche toujours la page d'accueil d'origine.
insert into fonctionnalites (cle, libelle, description, groupe, ordre) values
  ('accueil_en_blocs', 'Accueil en blocs', 'La page d''accueil du site composée dans l''éditeur visuel (Studio), dès qu''elle est publiée. Coupé, le site affiche toujours la page d''accueil d''origine, aussitôt, sans rien perdre : la page en blocs reste enregistrée.', 'public', 60);
