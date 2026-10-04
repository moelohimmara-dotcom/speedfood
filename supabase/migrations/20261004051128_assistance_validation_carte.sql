-- Reglages pilotes depuis la console admin : numero WhatsApp d'assistance, delai de validation annonce, activation de la
-- position sur carte. Tout est desactive tant que l'administrateur n'a rien renseigne.
alter table public.parametres_application
  add column whatsapp_assistance text
    check (whatsapp_assistance is null or whatsapp_assistance ~ '^[0-9]{8,15}$'),
  add column delai_validation_heures integer
    check (delai_validation_heures is null or delai_validation_heures between 1 and 720),
  add column position_carte_active boolean not null default false;

-- Position facultative d'un restaurant (point de retrait / adresse), donnee publique de l'etablissement.
-- Les deux coordonnees vont ensemble et restent dans la zone Guinee.
alter table public.restaurants
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add constraint restaurants_position_coherente check (
    (latitude is null and longitude is null)
    or (latitude between 7 and 13 and longitude between -15 and -7)
  );
