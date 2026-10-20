-- Durcissement (lot P4 → P6) : un paiement en ligne (mode « speedfood ») ne se confirme ni ne se conteste à la main.
--
-- Jusqu'ici seul le code de l'action serveur refusait qu'un membre du restaurant marque « reçu » ou « non reçu » une commande payée en ligne ;
-- la base, elle, l'acceptait. Cette règle est donc posée AUSSI en base : même un accès direct à la table avec un compte restaurateur ne peut
-- pas fabriquer un faux « payé » (ni annuler un vrai). Seul le serveur (clé de service, sans identité) fait évoluer ce statut, à la
-- notification signée du prestataire. Le reste de la fonction est inchangé (migration 20261005171122_paiement_code_marchand.sql).
create or replace function public.fn_valider_paiement_commande()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.paiement_statut = 'recu' and new.paiement_statut is distinct from old.paiement_statut then
    new.paiement_recu_le := now();
  end if;

  if auth.uid() is not null and not public.fn_est_admin_systeme() then
    if new.paiement_mode is distinct from old.paiement_mode
       or new.paiement_reference is distinct from old.paiement_reference
       or new.paiement_declare_le is distinct from old.paiement_declare_le then
      raise exception 'Seul le client peut declarer son mode de paiement' using errcode = '42501';
    end if;
    if old.paiement_mode = 'speedfood' and new.paiement_statut is distinct from old.paiement_statut then
      raise exception 'Un paiement en ligne se confirme par le prestataire de paiement, pas a la main' using errcode = '42501';
    end if;
    if new.paiement_recu_le is distinct from old.paiement_recu_le
       and not (new.paiement_statut = 'recu' and old.paiement_statut is distinct from 'recu') then
      raise exception 'La date de reception du paiement ne se modifie pas' using errcode = '42501';
    end if;
    if new.paiement_statut is distinct from old.paiement_statut then
      if old.paiement_statut = 'recu' then
        raise exception 'Un paiement confirme ne peut plus etre modifie' using errcode = '42501';
      end if;
      if new.paiement_statut not in ('recu', 'non_recu') then
        raise exception 'Statut de paiement non autorise' using errcode = '42501';
      end if;
      if new.statut not in ('acceptee', 'prete', 'terminee') then
        raise exception 'Le paiement ne se confirme qu''apres acceptation de la commande' using errcode = '42501';
      end if;
      if new.paiement_statut = 'non_recu' and old.paiement_statut <> 'declare' then
        raise exception 'Seule une declaration de paiement peut etre contestee' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$function$;
