-- Lot 3 (5 octobre 2026) : lien court + comptage des scans, et documents numérotés (reçus et factures, fiscaux ou non).
-- Speedfood ne reçoit toujours aucun argent. Un document est établi PAR le restaurant (sous sa responsabilité) ; par défaut il est
-- « non fiscal ». Le mode « fiscal déclaré » n'affiche que les mentions saisies par le restaurant : Speedfood ne certifie rien.

-- 1. Lien court : code public propre à chaque restaurant (6 caractères, sans lettres ambiguës).
create or replace function public.fn_generer_code_court()
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.restaurants where code_court = v_code);
  end loop;
  return v_code;
end;
$function$;
revoke execute on function public.fn_generer_code_court() from public, anon, authenticated;

alter table public.restaurants add column code_court text;
update public.restaurants set code_court = public.fn_generer_code_court() where code_court is null;
alter table public.restaurants
  alter column code_court set not null,
  add constraint restaurants_code_court_forme check (code_court ~ '^[a-z0-9]{4,12}$'),
  add constraint restaurants_code_court_unique unique (code_court);

create or replace function public.fn_restaurants_code_court()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.code_court is null or new.code_court = '' then
      new.code_court := public.fn_generer_code_court();
    end if;
  elsif new.code_court is distinct from old.code_court and auth.uid() is not null and not public.fn_est_admin_systeme() then
    raise exception 'Le lien court ne se modifie pas' using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_restaurants_code_court() from public, anon, authenticated;
create trigger trg_restaurants_code_court
  before insert or update on public.restaurants
  for each row execute function public.fn_restaurants_code_court();
-- (l'insertion sans code passe par la valeur par défaut du trigger : la colonne est « not null », on lui donne donc une valeur par défaut)
alter table public.restaurants alter column code_court set default public.fn_generer_code_court();

-- 2. Scans : compteur par restaurant, jour et source. Aucune donnée personnelle, aucune IP.
create table public.restaurant_scans (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  jour date not null default (now() at time zone 'utc')::date,
  source text not null check (source ~ '^[a-z0-9_-]{1,20}$'),
  nb integer not null default 0 check (nb >= 0),
  primary key (restaurant_id, jour, source)
);
alter table public.restaurant_scans enable row level security;
revoke all on public.restaurant_scans from anon, authenticated;
grant select on public.restaurant_scans to authenticated;
create policy membres_lecture_scans on public.restaurant_scans
  for select to authenticated using (public.fn_est_membre_restaurant(restaurant_id));
create policy admins_lecture_scans on public.restaurant_scans
  for select to authenticated using (public.fn_est_admin_systeme());

-- Écriture réservée au serveur (service-role) : un visiteur ne peut pas gonfler les chiffres directement.
create or replace function public.fn_compter_scan(p_code text, p_source text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_source text := case when p_source in ('qr', 'affiche', 'whatsapp', 'carte', 'table', 'lien') then p_source else 'lien' end;
begin
  select id into v_id from public.restaurants where code_court = lower(p_code) and publie and suspendu_le is null;
  if v_id is null then
    return null;
  end if;
  insert into public.restaurant_scans (restaurant_id, jour, source, nb)
  values (v_id, (now() at time zone 'utc')::date, v_source, 1)
  on conflict (restaurant_id, jour, source) do update set nb = public.restaurant_scans.nb + 1;
  return v_id;
end;
$function$;
revoke execute on function public.fn_compter_scan(text, text) from public, anon, authenticated;
grant execute on function public.fn_compter_scan(text, text) to service_role;

-- 3. Identité du restaurant sur ses documents. Table à part (lecture réservée aux membres).
create table public.restaurant_identite_documents (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  raison_sociale text check (raison_sociale is null or char_length(raison_sociale) between 2 and 120),
  adresse text check (adresse is null or char_length(adresse) <= 200),
  telephone text check (telephone is null or char_length(telephone) <= 30),
  nif text check (nif is null or nif ~ '^[0-9A-Za-z./ -]{3,30}$'),
  rccm text check (rccm is null or rccm ~ '^[0-9A-Za-z./ -]{3,30}$'),
  regime text not null default 'non_fiscal' check (regime in ('non_fiscal', 'fiscal_declare')),
  tva_taux smallint check (tva_taux is null or tva_taux between 0 and 30),
  mention text check (mention is null or char_length(mention) <= 200),
  mis_a_jour_le timestamptz not null default now()
);
alter table public.restaurant_identite_documents enable row level security;
revoke all on public.restaurant_identite_documents from anon, authenticated;
grant select, insert, update, delete on public.restaurant_identite_documents to authenticated;
create policy membres_gestion_identite_documents on public.restaurant_identite_documents
  for all to authenticated
  using (public.fn_est_membre_restaurant(restaurant_id))
  with check (public.fn_est_membre_restaurant(restaurant_id));
create policy admins_lecture_identite_documents on public.restaurant_identite_documents
  for select to authenticated using (public.fn_est_admin_systeme());

-- 4. Documents établis : numérotation continue par restaurant, type et année, instantané figé (modifier le profil ensuite ne change pas un document déjà émis).
create table public.restaurant_compteurs_documents (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null check (type in ('recu', 'facture')),
  annee smallint not null,
  dernier integer not null default 0,
  primary key (restaurant_id, type, annee)
);
alter table public.restaurant_compteurs_documents enable row level security;
revoke all on public.restaurant_compteurs_documents from anon, authenticated;

create table public.documents_commande (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null check (type in ('recu', 'facture')),
  annee smallint not null,
  numero_seq integer not null,
  numero text not null,
  emis_le timestamptz not null default now(),
  regime text not null check (regime in ('non_fiscal', 'fiscal_declare')),
  emetteur jsonb not null,
  client_nom text,
  lignes jsonb not null,
  sous_total integer not null check (sous_total >= 0),
  frais_livraison integer not null check (frais_livraison >= 0),
  total integer not null check (total >= 0),
  tva_taux smallint,
  tva_montant integer check (tva_montant is null or tva_montant >= 0),
  unique (order_id, type),
  unique (restaurant_id, type, annee, numero_seq)
);
alter table public.documents_commande enable row level security;
revoke all on public.documents_commande from anon, authenticated;
grant select on public.documents_commande to authenticated;
create policy membres_lecture_documents on public.documents_commande
  for select to authenticated using (public.fn_est_membre_restaurant(restaurant_id));
create policy admins_lecture_documents on public.documents_commande
  for select to authenticated using (public.fn_est_admin_systeme());

-- Émission : seul un membre du restaurant, sur une commande acceptée ; le reçu seulement après confirmation du paiement.
-- Idempotent : demander deux fois le même document renvoie le premier.
create or replace function public.fn_emettre_document(p_order_id uuid, p_type text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ordre public.orders%rowtype;
  v_resto public.restaurants%rowtype;
  v_id uuid;
  v_identite public.restaurant_identite_documents%rowtype;
  v_regime text := 'non_fiscal';
  v_annee smallint := extract(year from now() at time zone 'utc')::smallint;
  v_seq integer;
  v_total integer;
  v_tva integer;
  v_lignes jsonb;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if p_type not in ('recu', 'facture') then
    raise exception 'Type de document inconnu' using errcode = '22023';
  end if;
  select * into v_ordre from public.orders where id = p_order_id;
  if not found or not public.fn_est_membre_restaurant(v_ordre.restaurant_id) then
    raise exception 'Commande introuvable' using errcode = '42501';
  end if;
  if v_ordre.statut not in ('acceptee', 'prete', 'terminee') then
    raise exception 'Un document ne s''etablit qu''apres acceptation de la commande' using errcode = '42501';
  end if;
  if p_type = 'recu' and v_ordre.paiement_statut <> 'recu' then
    raise exception 'Le recu s''etablit apres confirmation du paiement' using errcode = '42501';
  end if;

  select id into v_id from public.documents_commande where order_id = p_order_id and type = p_type;
  if v_id is not null then
    return v_id;
  end if;

  select * into v_resto from public.restaurants where id = v_ordre.restaurant_id;
  select * into v_identite from public.restaurant_identite_documents where restaurant_id = v_ordre.restaurant_id;
  if found then
    v_regime := v_identite.regime;
  end if;

  insert into public.restaurant_compteurs_documents as c (restaurant_id, type, annee, dernier)
  values (v_ordre.restaurant_id, p_type, v_annee, 1)
  on conflict (restaurant_id, type, annee) do update set dernier = c.dernier + 1
  returning c.dernier into v_seq;

  v_total := v_ordre.sous_total + v_ordre.frais_livraison_estime;
  if v_regime = 'fiscal_declare' and coalesce(v_identite.tva_taux, 0) > 0 then
    v_tva := round(v_total::numeric * v_identite.tva_taux / (100 + v_identite.tva_taux))::int;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'nom', i.nom, 'prix', i.prix, 'quantite', i.quantite,
    'options', coalesce((select jsonb_agg(o.nom order by o.nom) from public.order_item_options o where o.order_item_id = i.id), '[]'::jsonb)
  ) order by i.nom), '[]'::jsonb)
  into v_lignes
  from public.order_items i where i.order_id = p_order_id;

  insert into public.documents_commande (
    order_id, restaurant_id, type, annee, numero_seq, numero, regime, emetteur, client_nom, lignes,
    sous_total, frais_livraison, total, tva_taux, tva_montant
  ) values (
    p_order_id, v_ordre.restaurant_id, p_type, v_annee, v_seq,
    (case when p_type = 'recu' then 'R' else 'F' end) || '-' || v_annee || '-' || lpad(v_seq::text, 4, '0'),
    v_regime,
    jsonb_build_object(
      'nom', coalesce(v_identite.raison_sociale, v_resto.nom),
      'adresse', v_identite.adresse,
      'telephone', v_identite.telephone,
      'nif', case when v_regime = 'fiscal_declare' then v_identite.nif end,
      'rccm', case when v_regime = 'fiscal_declare' then v_identite.rccm end,
      'mention', v_identite.mention
    ),
    case when p_type = 'facture' then v_ordre.client_nom end,
    v_lignes, v_ordre.sous_total, v_ordre.frais_livraison_estime, v_total,
    case when v_tva is not null then v_identite.tva_taux end, v_tva
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke execute on function public.fn_emettre_document(uuid, text) from public, anon;
grant execute on function public.fn_emettre_document(uuid, text) to authenticated;
