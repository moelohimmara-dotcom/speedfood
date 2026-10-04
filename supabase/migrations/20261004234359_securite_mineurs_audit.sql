-- Audit du 4 octobre 2026, points mineurs.

-- 1. Propositions révisées : la base impose les mêmes bornes que le serveur (statut d'attente, échéance proche, montants
--    de 0 à 10 000 000 GNF, conditions de 500 caractères au plus, commande encore en attente). Avant, un membre pouvait
--    insérer une proposition sans échéance ou avec un texte illimité par l'API directe.
drop policy if exists membres_creation_propositions on public.order_proposals;
create policy membres_creation_propositions on public.order_proposals
  for insert to authenticated
  with check (
    statut = 'en_attente'
    and expire_le is not null
    and expire_le > now() - interval '1 minute'
    and expire_le <= now() + interval '7 days'
    and nouveau_sous_total between 0 and 10000000
    and nouveaux_frais_livraison between 0 and 10000000
    and (conditions_modifiees is null or char_length(conditions_modifiees) <= 500)
    and exists (
      select 1 from public.orders o
      where o.id = order_proposals.order_id
        and o.statut = 'en_attente'
        and public.fn_est_membre_restaurant(o.restaurant_id)
    )
  );

-- 2. Notifications push : retirer quelqu'un d'une équipe supprime ses abonnements pour ce restaurant (il ne reçoit
--    plus l'alerte « Nouvelle commande »).
create or replace function public.fn_nettoyer_push_membre()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.push_subscriptions
   where restaurant_id = old.restaurant_id and utilisateur_id = old.utilisateur_id;
  return old;
end;
$function$;
revoke execute on function public.fn_nettoyer_push_membre() from public, anon, authenticated;

create trigger trg_nettoyer_push_membre
  after delete on public.restaurant_memberships
  for each row execute function public.fn_nettoyer_push_membre();
