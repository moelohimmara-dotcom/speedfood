-- Disponibilite horodatee et statuts operationnels distincts (SPEC-PILOTE section 4,
-- ADR-015). Trois informations separees : le restaurant est-il ouvert, accepte-t-il
-- des commandes en ce moment, et chaque plat est-il disponible (avec l'heure de
-- sa derniere confirmation). Une information ancienne s'affiche "a confirmer".

-- 1) Statuts du restaurant : `ouvert` existe deja ; on ajoute la pause des commandes
-- (ferme les commandes sans fermer le restaurant) et l'heure du dernier changement.
alter table restaurants add column if not exists accepte_commandes boolean not null default true;
alter table restaurants add column if not exists statut_mis_a_jour_le timestamptz not null default now();

-- 2) Heure de derniere confirmation de la disponibilite d'un plat. Null = jamais
-- confirmee (affichee "a confirmer").
alter table menu_items add column if not exists disponibilite_confirmee_le timestamptz;

-- 3) Seuil de fraicheur, reglable par un super_admin (/system/parametres).
alter table parametres_application add column if not exists disponibilite_fraicheur_heures integer not null default 6
  check (disponibilite_fraicheur_heures between 1 and 72);

-- Les horodatages sont poses par la base, jamais fournis par le client : sans cela,
-- un restaurateur pourrait ecrire une fausse confirmation recente par l'API directe.
create or replace function fn_horodater_statut_restaurant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ouvert is distinct from old.ouvert or new.accepte_commandes is distinct from old.accepte_commandes then
    new.statut_mis_a_jour_le := now();
  else
    new.statut_mis_a_jour_le := old.statut_mis_a_jour_le;
  end if;
  return new;
end;
$$;

create or replace function fn_horodater_disponibilite_plat()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Pas de JWT utilisateur (service-role, donnees de demonstration) : valeur fournie conservee.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.disponibilite_confirmee_le := now();
  elsif new.disponible is distinct from old.disponible
     or new.disponibilite_confirmee_le is distinct from old.disponibilite_confirmee_le then
    new.disponibilite_confirmee_le := now();
  end if;
  return new;
end;
$$;

revoke execute on function fn_horodater_statut_restaurant() from public, anon, authenticated;
revoke execute on function fn_horodater_disponibilite_plat() from public, anon, authenticated;

create trigger trg_horodater_statut_restaurant
  before update on restaurants
  for each row execute function fn_horodater_statut_restaurant();

create trigger trg_horodater_disponibilite_plat
  before insert or update on menu_items
  for each row execute function fn_horodater_disponibilite_plat();
