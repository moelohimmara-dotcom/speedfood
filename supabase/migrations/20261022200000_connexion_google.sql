-- Interrupteur de la connexion Google des clients (site web), comme celui de Facebook : desactive par defaut, regle depuis /system/parametres.
alter table public.parametres_application
  add column connexion_google_active boolean not null default false;
