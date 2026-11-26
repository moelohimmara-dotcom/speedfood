-- Issue d'une commande dont la livraison a échoué, et verrou sur l'argent.
--
-- 1. Après « Livraison non aboutie » (livraisons.statut = 'echec'), la commande reste « prete » et le restaurateur ne la clôt pas lui-même. L'assistance Speedfood décide de l'issue :
--      « cloturer »  : prete -> terminee (le restaurant est payé : client injoignable ou qui refuse, plat déjà préparé) ;
--      « annuler »   : prete -> annulee (la commande ne compte pas ; pour un paiement en ligne, le serveur ouvre ensuite un litige).
--    La transition prete -> annulee n'existe PAS dans la règle générale : elle n'est possible que par la fonction ci-dessous, appelée par le support, sur une livraison en échec.
--
-- 2. Verrou sur l'argent : un paiement en ligne ne passe de « confirme » à « libere » que si sa commande est terminée ET qu'aucune livraison ouverte ne lui reste. Le serveur le vérifiait déjà
--    (clôture protégée par le code de remise) ; la base le refuse désormais quoi que le code fasse. La décision d'un litige (en_litige -> libere) n'est pas concernée : c'est une décision humaine tracée.

-- ---------------------------------------------------------------------------------------------------------- 1. transition prete -> annulee réservée à l'issue d'un échec
create or replace function public.fn_valider_transition_commande()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut = old.statut then
    return new;
  end if;

  if (old.statut, new.statut) = ('prete', 'annulee') then
    -- Trois conditions réunies : l'indicateur posé par fn_support_resoudre_echec_livraison (transaction en cours seulement), un compte de support ou super administrateur,
    -- et une livraison de cette commande à l'état « echec ». Un indicateur posé à la main par un autre compte ne suffit donc pas.
    if coalesce(current_setting('speedfood.issue_echec_livraison', true), '') <> 'on'
       or not public.fn_est_admin_systeme(array['support', 'super_admin'])
       or not exists (select 1 from public.livraisons l where l.order_id = old.id and l.statut = 'echec') then
      raise exception 'Transition de statut invalide : % -> %', old.statut, new.statut;
    end if;
  elsif (old.statut, new.statut) not in (
    ('en_attente', 'acceptee'),
    ('en_attente', 'refusee'),
    ('en_attente', 'annulee'),
    ('acceptee', 'prete'),
    ('acceptee', 'annulee'),
    ('prete', 'terminee')
  ) then
    raise exception 'Transition de statut invalide : % -> %', old.statut, new.statut;
  end if;

  new.mis_a_jour_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------- 2. la fonction d'issue (support et super administrateur seulement)
create or replace function public.fn_support_resoudre_echec_livraison(p_order_id uuid, p_issue text, p_motif text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m text := btrim(coalesce(p_motif, ''));
  ancien text;
  liv text;
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_issue is null or p_issue not in ('cloturer', 'annuler') then
    raise exception 'Issue invalide' using errcode = '22023';
  end if;
  if char_length(m) < 5 or char_length(m) > 500 then
    raise exception 'Motif invalide' using errcode = '22023';
  end if;

  select statut into ancien from orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable' using errcode = 'P0002';
  end if;
  if ancien <> 'prete' then
    raise exception 'La commande doit etre prete' using errcode = '55000';
  end if;
  select statut into liv from livraisons where order_id = p_order_id;
  if liv is distinct from 'echec' then
    raise exception 'La livraison de cette commande n''est pas en echec' using errcode = '55000';
  end if;

  if p_issue = 'cloturer' then
    update orders set statut = 'terminee' where id = p_order_id;
  else
    perform set_config('speedfood.issue_echec_livraison', 'on', true);
    update orders set statut = 'annulee' where id = p_order_id;
    perform set_config('speedfood.issue_echec_livraison', 'off', true);
  end if;

  insert into order_status_events (order_id, statut_precedent, statut_suivant, acteur)
  values (p_order_id, ancien, case when p_issue = 'cloturer' then 'terminee' else 'annulee' end, 'support:' || auth.uid()::text);
  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), 'commande.issue_echec_livraison', 'commande', p_order_id::text, p_issue || ' : ' || m);
end;
$$;

revoke execute on function public.fn_support_resoudre_echec_livraison(uuid, text, text) from public, anon;
grant execute on function public.fn_support_resoudre_echec_livraison(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------- 3. verrou sur l'argent
create or replace function public.fn_paiement_garde()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.etat <> 'cree' then
      raise exception 'Un paiement est créé à l''état cree' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.order_id is distinct from old.order_id
     or new.restaurant_id is distinct from old.restaurant_id
     or new.fournisseur is distinct from old.fournisseur
     or new.operateur is distinct from old.operateur
     or new.repas_gnf is distinct from old.repas_gnf
     or new.frais_livraison_gnf is distinct from old.frais_livraison_gnf
     or new.livraison_par is distinct from old.livraison_par
     or new.frais_speedfood_gnf is distinct from old.frais_speedfood_gnf
     or new.frais_mobile_gnf is distinct from old.frais_mobile_gnf
     or new.restaurant_gnf is distinct from old.restaurant_gnf
     or new.livreur_gnf is distinct from old.livreur_gnf
     or new.speedfood_brut_gnf is distinct from old.speedfood_brut_gnf
     or new.reference_interne is distinct from old.reference_interne
     or new.cree_le is distinct from old.cree_le then
    raise exception 'Les montants et références d''un paiement ne se modifient pas' using errcode = '23514';
  end if;

  if old.reference_externe is not null and new.reference_externe is distinct from old.reference_externe then
    raise exception 'La référence du prestataire ne se modifie pas' using errcode = '23514';
  end if;

  if new.rembourse_gnf < old.rembourse_gnf then
    raise exception 'Un remboursement enregistré ne diminue pas' using errcode = '23514';
  end if;

  -- Miroir de src/lib/paiement/en-ligne/machine.ts (comparé par scripts/tests/paiement-en-ligne.test.mts).
  if new.etat is distinct from old.etat and not ((old.etat, new.etat) in (
       ('cree', 'en_attente'), ('cree', 'annule'),
       ('en_attente', 'confirme'), ('en_attente', 'echoue'), ('en_attente', 'annule'), ('en_attente', 'expire'),
       ('confirme', 'libere'), ('confirme', 'rembourse'), ('confirme', 'en_litige'),
       ('libere', 'en_litige'),
       ('en_litige', 'libere'), ('en_litige', 'rembourse'),
       ('expire', 'confirme'), ('annule', 'confirme')
     )) then
    raise exception 'Transition de paiement interdite : % vers %', old.etat, new.etat using errcode = '23514';
  end if;

  -- VERROU : libérer l'argent d'un paiement confirmé exige une commande terminée et aucune livraison ouverte. (Le chemin « en_litige -> libere » est une décision humaine, hors verrou.)
  if old.etat = 'confirme' and new.etat = 'libere' then
    if not exists (select 1 from orders o where o.id = new.order_id and o.statut = 'terminee')
       or exists (select 1 from livraisons l where l.order_id = new.order_id and l.statut not in ('livree', 'echec', 'annulee')) then
      raise exception 'Liberation refusee : la commande doit etre terminee et sa livraison finie' using errcode = '23514';
    end if;
  end if;

  new.mis_a_jour_le := now();
  return new;
end;
$function$;
revoke execute on function public.fn_paiement_garde() from public, anon, authenticated;
