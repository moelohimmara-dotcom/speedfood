-- Effacement de la position des livreurs (décision de Malika du 18 novembre 2026).
--
-- La table `livreurs` ne garde que la DERNIÈRE position de chaque livreur, écrasée à chaque envoi.
-- Jusqu'ici rien ne l'effaçait jamais : une position restait donc visible indéfiniment, même après
-- la fin de service du livreur. Désormais la position est effacée dans deux cas :
--   1) dès que le livreur passe hors ligne, quel que soit le chemin qui l'y met (déclencheur, donc
--      aussi un envoi de position arrivé en retard sur une fiche déjà hors ligne) ;
--   2) par un nettoyage horaire de sécurité pour toute position de plus de 24 heures, au cas où
--      un passage hors ligne aurait été manqué. Les livreurs simulés (démonstration) sont exclus
--      de ce second nettoyage : leur position sert à la démonstration.

-- 1) Déclencheur : passer hors ligne efface la position. Il est en BEFORE UPDATE pour vider les
-- colonnes de la ligne en cours d'écriture, y compris quand l'écriture EST un envoi de position
-- tardif sur une fiche hors ligne. Il ne s'applique pas à l'insertion.
create or replace function public.fn_livreurs_effacer_position_hors_ligne()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut = 'hors_ligne' then
    new.latitude := null;
    new.longitude := null;
    new.position_le := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_livreurs_effacer_position_hors_ligne on public.livreurs;
create trigger trg_livreurs_effacer_position_hors_ligne
  before update on public.livreurs
  for each row execute function public.fn_livreurs_effacer_position_hors_ligne();

-- 2) Nettoyage unique des fiches déjà hors ligne qui gardent encore une position.
update public.livreurs
   set latitude = null,
       longitude = null,
       position_le = null
 where statut = 'hors_ligne'
   and (latitude is not null or longitude is not null or position_le is not null);

-- 3) Nettoyage des positions anciennes (24 heures par défaut), réservé au serveur : la fonction
-- est en SECURITY DEFINER et son exécution est retirée aux rôles de l'API, comme
-- `fn_anonymiser_donnees`. Elle renvoie le nombre de fiches nettoyées.
create or replace function public.fn_effacer_positions_anciennes(p_heures integer default 24)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_heures is null or p_heures < 1 then
    raise exception 'p_heures doit valoir au moins 1 (reçu : %)', p_heures;
  end if;

  update public.livreurs
     set latitude = null,
         longitude = null,
         position_le = null
   where position_le is not null
     and position_le < now() - make_interval(hours => p_heures)
     and simule = false;
  get diagnostics n = row_count;

  return n;
end;
$$;

revoke execute on function public.fn_effacer_positions_anciennes(integer) from public, anon, authenticated;

-- 4) Planification horaire (à la minute 7) si pg_cron est disponible (Supabase) ; ignorée sinon
-- (base jetable de vérification), sur le même modèle que l'anonymisation des données.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname = 'speedfood-effacement-positions';
    perform cron.schedule('speedfood-effacement-positions', '7 * * * *', 'select public.fn_effacer_positions_anciennes()');
  end if;
end $$;
