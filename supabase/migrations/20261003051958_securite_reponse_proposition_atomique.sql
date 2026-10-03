-- Revue de securite independante, point 7 : concurrence dans la reponse a une
-- proposition revisee. Avant, la reponse etait une suite d'appels separes : deux
-- reponses simultanees (accepter et refuser) pouvaient appliquer leurs effets toutes
-- les deux, et les montants etaient ecrits sans verifier que la commande etait
-- encore en attente (le restaurant pouvait l'avoir acceptee entre-temps).
--
-- Correctif : tout se passe dans UNE fonction, en une transaction, avec verrou de la
-- ligne de commande (la meme ligne que verrouille le restaurant quand il change le
-- statut). Reservee au service-role (le client n'a pas de compte, ADR-011).
-- Un trigger interdit en outre d'accepter une commande tant qu'une proposition
-- active attend la reponse du client (point 6, premiere partie).

create or replace function public.fn_repondre_proposition(
  p_jeton text,
  p_proposition_id uuid,
  p_reponse text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  cmd record;
  prop record;
begin
  if p_reponse not in ('acceptee', 'refusee') then
    raise exception 'VALIDATION:reponse' using errcode = 'P0001';
  end if;

  select id, reference, statut into cmd from orders where jeton_suivi = p_jeton for update;
  if not found then
    raise exception 'INTROUVABLE:commande' using errcode = 'P0001';
  end if;

  select id, statut, expire_le, nouveau_sous_total, nouveaux_frais_livraison
    into prop
    from order_proposals
    where id = p_proposition_id and order_id = cmd.id
    for update;
  if not found then
    raise exception 'INTROUVABLE:proposition' using errcode = 'P0001';
  end if;

  -- Rejeu idempotent : la meme reponse, deja traitee, est un succes.
  if prop.statut = p_reponse then
    return 'rejeu';
  end if;
  if prop.statut = 'expiree' then
    raise exception 'CONFLIT:expiree' using errcode = 'P0001';
  end if;
  if prop.statut <> 'en_attente' then
    raise exception 'CONFLIT:deja_repondue' using errcode = 'P0001';
  end if;
  if prop.expire_le is not null and prop.expire_le <= now() then
    raise exception 'CONFLIT:expiree' using errcode = 'P0001';
  end if;
  if cmd.statut <> 'en_attente' then
    raise exception 'CONFLIT:commande_non_en_attente' using errcode = 'P0001';
  end if;

  update order_proposals set statut = p_reponse, repondu_le = now() where id = prop.id;

  if p_reponse = 'acceptee' then
    -- Les nouveaux montants deviennent ceux de la commande (statut inchange : le
    -- restaurant confirme ensuite).
    update orders
      set sous_total = prop.nouveau_sous_total,
          frais_livraison_estime = prop.nouveaux_frais_livraison
      where id = cmd.id;
  else
    -- Refus : commande annulee, sans preparation ni frais.
    update orders set statut = 'annulee' where id = cmd.id;
    insert into order_status_events (order_id, statut_precedent, statut_suivant, acteur)
      values (cmd.id, 'en_attente', 'annulee', 'client:' || cmd.reference);
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.fn_repondre_proposition(text, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_repondre_proposition(text, uuid, text) to service_role;

create or replace function public.fn_bloquer_acceptation_avec_proposition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.statut = 'en_attente' and new.statut = 'acceptee' and exists (
    select 1 from order_proposals p
    where p.order_id = new.id
      and p.statut = 'en_attente'
      and (p.expire_le is null or p.expire_le > now())
  ) then
    raise exception 'Une proposition attend la reponse du client : la commande ne peut pas etre acceptee'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_bloquer_acceptation_avec_proposition() from public, anon, authenticated;

drop trigger if exists trg_bloquer_acceptation_avec_proposition on public.orders;
create trigger trg_bloquer_acceptation_avec_proposition
  before update on public.orders
  for each row execute function public.fn_bloquer_acceptation_avec_proposition();
