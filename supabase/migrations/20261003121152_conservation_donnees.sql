-- Conservation des donnees personnelles (docs/CONSERVATION-ET-CONFIDENTIALITE.md).
-- Decision de Malika du 3 octobre 2026 : 90 jours apres la cloture d'une commande, MAIS
-- reglable (raccourcir ou allonger) par le super_admin dans /system/parametres.
--
-- - parametres_application : trois durees reglables, avec bornes pour eviter une faute de frappe
--   destructrice (minimum 7 jours : l'anonymisation est IRREVERSIBLE).
-- - orders.anonymise_le : marque les commandes deja anonymisees (jamais retraitees).
-- - fn_anonymiser_donnees() : anonymise les coordonnees des commandes echues et purge l'audit
--   trop ancien ; reservee au serveur (aucun role de l'API ne peut l'appeler) ; planifiee chaque
--   nuit par pg_cron quand l'extension existe.

alter table public.parametres_application
  add column if not exists conservation_coordonnees_jours integer not null default 90
    check (conservation_coordonnees_jours between 7 and 3650),
  add column if not exists conservation_non_cloturee_jours integer not null default 30
    check (conservation_non_cloturee_jours between 7 and 3650),
  add column if not exists conservation_audit_mois integer not null default 12
    check (conservation_audit_mois between 1 and 120);

alter table public.orders add column if not exists anonymise_le timestamptz;

create or replace function public.fn_anonymiser_donnees()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p record;
  n_commandes integer;
  n_audit integer;
begin
  select conservation_coordonnees_jours as clotures,
         conservation_non_cloturee_jours as ouvertes,
         conservation_audit_mois as audit
    into p from parametres_application where id;
  if not found then
    raise exception 'Parametres de conservation introuvables';
  end if;

  update orders
     set client_nom = 'Client',
         client_telephone = '',
         client_adresse = null,
         anonymise_le = now()
   where anonymise_le is null
     and (
       (statut in ('terminee', 'refusee', 'annulee')
         and mis_a_jour_le < now() - make_interval(days => p.clotures))
       or (statut not in ('terminee', 'refusee', 'annulee')
         and cree_le < now() - make_interval(days => p.ouvertes))
     );
  get diagnostics n_commandes = row_count;

  delete from audit_events where horodatage < now() - make_interval(months => p.audit);
  get diagnostics n_audit = row_count;

  if n_commandes + n_audit > 0 then
    insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
    values (null, 'donnees.anonymisation', 'systeme', 'conservation',
            n_commandes || ' commande(s) anonymisee(s), ' || n_audit || ' evenement(s) d''audit purge(s)');
  end if;

  return jsonb_build_object('commandes_anonymisees', n_commandes, 'audit_purge', n_audit);
end;
$$;

revoke execute on function public.fn_anonymiser_donnees() from public, anon, authenticated;

-- Planification quotidienne (03 h 15 UTC) si pg_cron est disponible (Supabase) ; ignoree sinon
-- (base jetable de verification).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname = 'speedfood-anonymisation';
    perform cron.schedule('speedfood-anonymisation', '15 3 * * *', 'select public.fn_anonymiser_donnees()');
  end if;
end $$;
