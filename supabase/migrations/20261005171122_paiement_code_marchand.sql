-- Lots « paiement par code marchand » et « reçu numérique » (5 octobre 2026).
-- Speedfood ne reçoit jamais d'argent : le client règle le restaurant avec le code marchand de ce dernier (Orange Money, MTN MoMo)
-- ou en espèces. Ces tables ne servent qu'à AFFICHER le code après acceptation de la commande et à SUIVRE la déclaration du client
-- (« j'ai payé ») et la confirmation du restaurateur (« paiement reçu »). Rien n'est vérifié automatiquement.

-- 1. Codes marchands : table à part, jamais lisible par le public (la lecture publique de `restaurants` exposerait toute colonne ajoutée).
create table public.restaurant_codes_marchand (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  orange text check (orange is null or orange ~ '^[0-9A-Za-z]{3,20}$'),
  mtn text check (mtn is null or mtn ~ '^[0-9A-Za-z]{3,20}$'),
  mis_a_jour_le timestamptz not null default now()
);
alter table public.restaurant_codes_marchand enable row level security;
revoke all on public.restaurant_codes_marchand from anon, authenticated;
grant select, insert, update, delete on public.restaurant_codes_marchand to authenticated;

create policy membres_gestion_codes_marchand on public.restaurant_codes_marchand
  for all to authenticated
  using (public.fn_est_membre_restaurant(restaurant_id))
  with check (public.fn_est_membre_restaurant(restaurant_id));
create policy admins_lecture_codes_marchand on public.restaurant_codes_marchand
  for select to authenticated
  using (public.fn_est_admin_systeme());

-- Trace d'audit à chaque changement de code (valeurs masquées : seuls les deux derniers caractères sont conservés).
create or replace function public.fn_auditer_codes_marchand()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_masque text := '';
  v_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
begin
  if auth.uid() is not null then
    v_masque := 'orange ' || case when old.orange is null then '-' else repeat('*', greatest(length(old.orange) - 2, 1)) || right(old.orange, 2) end
             || ' > ' || case when new.orange is null then '-' else repeat('*', greatest(length(new.orange) - 2, 1)) || right(new.orange, 2) end
             || ' ; mtn ' || case when old.mtn is null then '-' else repeat('*', greatest(length(old.mtn) - 2, 1)) || right(old.mtn, 2) end
             || ' > ' || case when new.mtn is null then '-' else repeat('*', greatest(length(new.mtn) - 2, 1)) || right(new.mtn, 2) end;
    insert into public.audit_events (acteur_id, action, cible_type, cible_id, motif)
    values (auth.uid(), 'restaurant.code_marchand', 'restaurant', v_id::text, v_masque);
  end if;
  return coalesce(new, old);
end;
$function$;
revoke execute on function public.fn_auditer_codes_marchand() from public, anon, authenticated;
create trigger trg_auditer_codes_marchand
  after insert or update or delete on public.restaurant_codes_marchand
  for each row execute function public.fn_auditer_codes_marchand();

-- 2. Commandes : suivi du paiement.
alter table public.orders
  add column paiement_mode text check (paiement_mode is null or paiement_mode in ('especes', 'orange_money', 'mtn_momo')),
  add column paiement_statut text not null default 'non_demande' check (paiement_statut in ('non_demande', 'especes', 'declare', 'recu', 'non_recu')),
  add column paiement_reference text check (paiement_reference is null or paiement_reference ~ '^[A-Za-z0-9._ -]{4,40}$'),
  add column paiement_declare_le timestamptz,
  add column paiement_recu_le timestamptz;

-- Un membre du restaurant ne peut que CONFIRMER (« reçu ») ou CONTESTER (« non reçu ») une déclaration, et seulement après
-- acceptation. Le mode, la référence et la date de déclaration appartiennent au client (écrits côté serveur par le jeton de suivi).
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

create trigger trg_orders_valider_paiement
  before update on public.orders
  for each row execute function public.fn_valider_paiement_commande();
