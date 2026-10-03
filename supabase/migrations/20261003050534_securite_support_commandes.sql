-- Revue de securite independante, point 3 : le support lisait et modifiait
-- directement TOUTES les colonnes de `orders` par l'API (coordonnees clients en
-- clair sans motif ni trace, prix et statuts modifiables a la main).
--
-- Correctif : le support n'a plus aucun acces direct a `orders`. Il passe par quatre
-- fonctions SECURITY DEFINER qui (1) verifient le role en base, (2) ne rendent que
-- des coordonnees masquees, (3) journalisent toute revelation ou changement de statut
-- dans la meme transaction. Un trigger interdit en outre a tout utilisateur connecte
-- de modifier autre chose que le statut d'une commande.

create or replace function public.fn_masquer_telephone(p_tel text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := btrim(coalesce(p_tel, ''));
  n int := length(v);
  i int;
  ind int := 0;
  pos int[] := '{}';
  vis int[] := '{}';
  res text := '';
  ch text;
  nb int;
  nloc int;
begin
  if v = '' then
    return '';
  end if;
  for i in 1..n loop
    if substr(v, i, 1) ~ '^[0-9]$' then
      pos := pos || i;
    end if;
  end loop;
  nb := coalesce(array_length(pos, 1), 0);
  if nb = 0 then
    return '***';
  end if;
  if left(v, 1) = '+' then
    i := 2;
    while i <= n and ind < 3 and substr(v, i, 1) ~ '^[0-9]$' loop
      ind := ind + 1;
      i := i + 1;
    end loop;
  end if;
  if ind > 0 then
    vis := pos[1:ind];
  end if;
  nloc := nb - ind;
  if nloc >= 5 then
    vis := vis || pos[ind + 1] || pos[nb] || pos[nb - 1];
  elsif nloc > 0 then
    vis := vis || pos[nb];
  end if;
  for i in 1..n loop
    ch := substr(v, i, 1);
    if ch !~ '^[0-9]$' then
      res := res || ch;
    elsif i = any(vis) then
      res := res || ch;
    else
      res := res || '*';
    end if;
  end loop;
  return res;
end;
$$;

create or replace function public.fn_masquer_adresse(p_adresse text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := btrim(coalesce(p_adresse, ''));
  segs text[];
  q text;
begin
  if v = '' then
    return 'Adresse non renseignée';
  end if;
  segs := array(
    select btrim(s.val) from unnest(string_to_array(v, ',')) with ordinality as s(val, ord)
    where btrim(s.val) <> '' order by s.ord
  );
  if coalesce(array_length(segs, 1), 0) < 2 then
    return 'Adresse masquée';
  end if;
  q := btrim(regexp_replace(regexp_replace(segs[array_length(segs, 1)], '[0-9]', '', 'g'), '\s+', ' ', 'g'));
  if q = '' then
    return 'Adresse masquée';
  end if;
  return 'Quartier : ' || left(q, 60);
end;
$$;

create or replace function public.fn_support_lister_commandes(
  p_reference text default null,
  p_statut text default null,
  p_jour boolean default false,
  p_id uuid default null
)
returns table (
  id uuid,
  reference text,
  statut text,
  mode text,
  client_nom text,
  telephone_masque text,
  adresse_masquee text,
  sous_total integer,
  frais_livraison_estime integer,
  cree_le timestamptz,
  restaurant_nom text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  return query
    select o.id, o.reference, o.statut, o.mode, o.client_nom,
           public.fn_masquer_telephone(o.client_telephone),
           public.fn_masquer_adresse(o.client_adresse),
           o.sous_total, o.frais_livraison_estime, o.cree_le, r.nom
    from orders o
    left join restaurants r on r.id = o.restaurant_id
    where (p_id is null or o.id = p_id)
      and (p_reference is null or p_reference = '' or position(lower(p_reference) in lower(o.reference)) > 0)
      and (p_statut is null or p_statut = '' or o.statut = p_statut)
      and (not coalesce(p_jour, false) or o.cree_le >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    order by o.cree_le desc
    limit 100;
end;
$$;

create or replace function public.fn_support_compter_commandes(
  p_statuts text[] default null,
  p_depuis timestamptz default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  select count(*)::int into n
  from orders o
  where (p_statuts is null or o.statut = any(p_statuts))
    and (p_depuis is null or o.cree_le >= p_depuis);
  return n;
end;
$$;

create or replace function public.fn_support_reveler_coordonnees(p_order_id uuid, p_motif text)
returns table (client_telephone text, client_adresse text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m text := btrim(coalesce(p_motif, ''));
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if m = '' then
    raise exception 'Un motif est obligatoire' using errcode = '22023';
  end if;
  if length(m) > 500 then
    raise exception 'Motif trop long' using errcode = '22023';
  end if;
  if not exists (select 1 from orders where id = p_order_id) then
    raise exception 'Commande introuvable' using errcode = 'P0002';
  end if;
  -- Trace ecrite AVANT de rendre la donnee, dans la meme transaction.
  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), 'coordonnees.revelation', 'commande', p_order_id::text, m);
  return query select o.client_telephone, o.client_adresse from orders o where o.id = p_order_id;
end;
$$;

create or replace function public.fn_support_changer_statut(p_order_id uuid, p_vers text, p_motif text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m text := btrim(coalesce(p_motif, ''));
  ancien text;
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if m = '' or length(m) > 500 then
    raise exception 'Motif invalide' using errcode = '22023';
  end if;
  select statut into ancien from orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable' using errcode = 'P0002';
  end if;
  -- La validite de la transition est imposee par le trigger fn_valider_transition_commande.
  update orders set statut = p_vers where id = p_order_id;
  insert into order_status_events (order_id, statut_precedent, statut_suivant, acteur)
  values (p_order_id, ancien, p_vers, 'support:' || auth.uid()::text);
  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), 'commande.support_transition', 'commande', p_order_id::text, ancien || ' -> ' || p_vers || ' : ' || m);
end;
$$;

revoke execute on function public.fn_support_lister_commandes(text, text, boolean, uuid) from public, anon;
revoke execute on function public.fn_support_compter_commandes(text[], timestamptz) from public, anon;
revoke execute on function public.fn_support_reveler_coordonnees(uuid, text) from public, anon;
revoke execute on function public.fn_support_changer_statut(uuid, text, text) from public, anon;
grant execute on function public.fn_support_lister_commandes(text, text, boolean, uuid) to authenticated;
grant execute on function public.fn_support_compter_commandes(text[], timestamptz) to authenticated;
grant execute on function public.fn_support_reveler_coordonnees(uuid, text) to authenticated;
grant execute on function public.fn_support_changer_statut(uuid, text, text) to authenticated;

-- Plus aucun acces direct du support aux commandes ni a l'ecriture d'historique.
drop policy if exists support_lecture_commandes on public.orders;
drop policy if exists support_maj_commandes on public.orders;
drop policy if exists support_ecriture_historique_commandes on public.order_status_events;

-- Les autres policies support restent (aucune donnee personnelle) mais ne sont
-- plus evaluees pour `anon`.
alter policy support_lecture_lignes_commandes on public.order_items to authenticated;
alter policy support_lecture_options_commandes on public.order_item_options to authenticated;
alter policy support_lecture_propositions on public.order_proposals to authenticated;
alter policy support_lecture_historique_commandes on public.order_status_events to authenticated;

-- Un utilisateur connecte (restaurateur compris) ne peut modifier que le statut.
-- Le service-role (auth.uid() nul) n'est pas concerne : c'est lui qui recalcule
-- les montants lors d'une proposition acceptee.
create or replace function public.fn_limiter_maj_commande()
returns trigger
language plpgsql
set search_path = public
as $$
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
  ) then
    raise exception 'Seul le statut d''une commande peut etre modifie' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_limiter_maj_commande() from public, anon, authenticated;

drop trigger if exists trg_limiter_maj_commande on public.orders;
create trigger trg_limiter_maj_commande
  before update on public.orders
  for each row execute function public.fn_limiter_maj_commande();
