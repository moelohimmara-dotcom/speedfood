-- Suppression d'un compte par un super_admin (comptes de test, comptes a fermer).
-- Principe : operation irreversible, reservee au super_admin (avec double authentification s'il
-- l'a activee), motivee, journalisee, avec garde-fous.
--
-- 1. Les colonnes qui designent l'auteur d'une action (audit, contenus, parametres) ne doivent pas
--    empecher la suppression d'un compte : elles passent en « ON DELETE SET NULL » (l'historique
--    reste, sans le lien vers le compte supprime).
-- 2. fn_preparer_suppression_compte() verifie les garde-fous, supprime si demande les restaurants
--    sans autre membre et sans AUCUNE commande, et ecrit la trace d'audit. La suppression du compte
--    lui-meme est faite ensuite par l'API d'administration de l'authentification (serveur).

alter table public.audit_events drop constraint if exists audit_events_acteur_id_fkey;
alter table public.audit_events
  add constraint audit_events_acteur_id_fkey foreign key (acteur_id) references auth.users(id) on delete set null;

alter table public.content_banners drop constraint if exists content_banners_auteur_id_fkey;
alter table public.content_banners
  add constraint content_banners_auteur_id_fkey foreign key (auteur_id) references auth.users(id) on delete set null;

alter table public.content_pages drop constraint if exists content_pages_auteur_id_fkey;
alter table public.content_pages
  add constraint content_pages_auteur_id_fkey foreign key (auteur_id) references auth.users(id) on delete set null;

alter table public.parametres_application drop constraint if exists parametres_application_mis_a_jour_par_fkey;
alter table public.parametres_application
  add constraint parametres_application_mis_a_jour_par_fkey foreign key (mis_a_jour_par) references auth.users(id) on delete set null;

create or replace function public.fn_preparer_suppression_compte(
  p_utilisateur uuid,
  p_supprimer_restaurants boolean,
  p_motif text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m text := btrim(coalesce(p_motif, ''));
  r record;
  supprimes integer := 0;
  conserves integer := 0;
  orphelins integer := 0;
begin
  if not public.fn_est_admin_systeme(array['super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if m = '' or length(m) > 500 then
    raise exception 'Motif invalide' using errcode = '22023';
  end if;
  if p_utilisateur = auth.uid() then
    raise exception 'REFUS:propre_compte' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_utilisateur) then
    raise exception 'REFUS:introuvable' using errcode = 'P0001';
  end if;
  if exists (select 1 from system_admin_memberships where utilisateur_id = p_utilisateur and role = 'super_admin') then
    raise exception 'REFUS:super_admin' using errcode = 'P0001';
  end if;

  for r in
    select m1.restaurant_id as id
    from restaurant_memberships m1
    where m1.utilisateur_id = p_utilisateur
      and not exists (
        select 1 from restaurant_memberships m2
        where m2.restaurant_id = m1.restaurant_id and m2.utilisateur_id <> p_utilisateur
      )
  loop
    if p_supprimer_restaurants and not exists (select 1 from orders o where o.restaurant_id = r.id) then
      delete from restaurants where id = r.id;
      supprimes := supprimes + 1;
    elsif p_supprimer_restaurants then
      conserves := conserves + 1;
      orphelins := orphelins + 1;
    else
      orphelins := orphelins + 1;
    end if;
  end loop;

  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), 'compte.suppression', 'utilisateur', p_utilisateur::text,
          m || ' [restaurants supprimes: ' || supprimes || ', restaurants sans membre conserves: ' || orphelins || ']');

  return jsonb_build_object('restaurants_supprimes', supprimes, 'restaurants_conserves', orphelins, 'avec_commandes', conserves);
end;
$$;

revoke execute on function public.fn_preparer_suppression_compte(uuid, boolean, text) from public, anon;
grant execute on function public.fn_preparer_suppression_compte(uuid, boolean, text) to authenticated;
