-- Correctifs de l'audit de sécurité indépendant du 4 octobre 2026 (périmètre base de données).

-- 1. Média : l'hôte est figé sur le projet Supabase de Speedfood. Avant, n'importe quel `*.supabase.co` passait, ce qui
--    permettait de pointer vers le fichier d'un autre restaurant puis de le faire supprimer, ou d'afficher une image
--    hébergée ailleurs (pixel espion).
create or replace function public.fn_valider_url_media()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_forme constant text := '^https://ggldjdizqrtpetdiohxy\.supabase\.co/storage/v1/object/public/medias/(restaurants|plats|logos)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$';
  v_nouvelle_photo text := to_jsonb(new)->>'photo_url';
  v_nouveau_logo text := to_jsonb(new)->>'logo_url';
  v_photo_modifiee boolean;
  v_logo_modifie boolean;
begin
  if auth.uid() is null or fn_est_admin_systeme() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_photo_modifiee := v_nouvelle_photo is distinct from (to_jsonb(old)->>'photo_url');
    v_logo_modifie := v_nouveau_logo is distinct from (to_jsonb(old)->>'logo_url');
  else
    v_photo_modifiee := v_nouvelle_photo is not null;
    v_logo_modifie := v_nouveau_logo is not null;
  end if;

  if v_photo_modifiee and v_nouvelle_photo is not null and v_nouvelle_photo !~ v_forme then
    raise exception 'URL de photo non autorisee' using errcode = '23514';
  end if;
  if v_logo_modifie and v_nouveau_logo is not null and v_nouveau_logo !~ v_forme then
    raise exception 'URL de logo non autorisee' using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- 2. Couleur d'accent : seule une couleur #RRGGBB est acceptée. La valeur est écrite dans un attribut `style` au rendu ;
--    sans contrainte, un membre pouvait y glisser d'autres déclarations CSS (calque plein écran, image externe).
alter table restaurants
  add constraint restaurants_couleur_accent_forme check (couleur_accent is null or couleur_accent ~ '^#[0-9A-Fa-f]{6}$');

-- 3. Commandes : un membre du restaurant ne peut ni marquer une commande « déjà anonymisée » (elle échapperait à
--    l'anonymisation de 90 jours) ni toucher à sa date de mise à jour. Les tâches internes (auth.uid() nul) restent libres.
create or replace function public.fn_limiter_maj_commande()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and (
    new.id is distinct from old.id
    or new.reference is distinct from old.reference
    or new.jeton_suivi is distinct from old.jeton_suivi
    or new.restaurant_id is distinct from old.restaurant_id
    or new.client_nom is distinct from old.client_nom
    or new.client_telephone is distinct from old.client_telephone
    or new.client_adresse is distinct from old.client_adresse
    or new.mode is distinct from old.mode
    or new.sous_total is distinct from old.sous_total
    or new.frais_livraison_estime is distinct from old.frais_livraison_estime
    or new.cree_le is distinct from old.cree_le
    or new.anonymise_le is distinct from old.anonymise_le
    or new.mis_a_jour_le is distinct from old.mis_a_jour_le
  ) then
    raise exception 'Seul le statut d''une commande peut etre modifie' using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- 4. Équipes : toute modification d'une équipe de restaurant faite avec une session utilisateur (API directe ou
--    interface) laisse une trace d'audit. Le rôle `operations` pouvait s'ajouter à un restaurant et lire ses
--    coordonnées clients sans qu'aucune trace ne soit écrite en base.
create or replace function public.fn_auditer_equipe_restaurant()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ligne public.restaurant_memberships := case when tg_op = 'DELETE' then old else new end;
begin
  if auth.uid() is not null then
    insert into public.audit_events (acteur_id, action, cible_type, cible_id, motif)
    values (
      auth.uid(),
      'equipe.' || lower(tg_op),
      'restaurant',
      v_ligne.restaurant_id::text,
      'membre ' || v_ligne.utilisateur_id::text || ' role ' || coalesce(v_ligne.role, '?')
    );
  end if;
  return coalesce(new, old);
end;
$function$;
revoke execute on function public.fn_auditer_equipe_restaurant() from public, anon, authenticated;

create trigger trg_auditer_equipe_restaurant
  after insert or update or delete on public.restaurant_memberships
  for each row execute function public.fn_auditer_equipe_restaurant();

-- 5. Prix : borne en base, identique à celle du formulaire (un prix proche de 2^31 faisait déborder les totaux).
alter table menu_items
  add constraint menu_items_prix_borne check (prix between 0 and 5000000);
