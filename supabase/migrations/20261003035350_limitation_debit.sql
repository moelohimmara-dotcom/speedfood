-- Limitation de debit des actions publiques (commande invitee, reponse a une
-- proposition). Compteur a fenetre fixe dans la base existante : aucun service
-- externe ni cout. Les cles sont des empreintes HMAC (jamais d'IP ni de
-- telephone en clair). Table reservee au service-role : RLS activee, aucune
-- policy (meme principe que les tables de commande, ADR-011).
create table rate_limits (
  cle text not null,
  fenetre timestamptz not null,
  compteur integer not null default 0,
  primary key (cle, fenetre)
);
create index idx_rate_limits_fenetre on rate_limits(fenetre);
alter table rate_limits enable row level security;

-- Incremente le compteur de la fenetre courante et renvoie true tant que la
-- limite n'est pas depassee. Atomique (upsert) donc sur entre plusieurs isolats.
create or replace function fn_limiter_debit(p_cle text, p_fenetre_secondes integer, p_max integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_fenetre timestamptz;
  v_compteur integer;
begin
  if p_cle is null or length(p_cle) = 0 or p_fenetre_secondes < 1 or p_max < 1 then
    raise exception 'parametres de limitation invalides';
  end if;

  v_fenetre := to_timestamp(floor(extract(epoch from now()) / p_fenetre_secondes) * p_fenetre_secondes);

  insert into rate_limits (cle, fenetre, compteur)
  values (p_cle, v_fenetre, 1)
  on conflict (cle, fenetre) do update set compteur = rate_limits.compteur + 1
  returning compteur into v_compteur;

  -- Nettoyage opportuniste des fenetres anciennes (~1 appel sur 100).
  if random() < 0.01 then
    delete from rate_limits where fenetre < now() - interval '1 day';
  end if;

  return v_compteur <= p_max;
end;
$$;

-- Supabase accorde l'execution a anon/authenticated par defaut : retrait
-- explicite, seul le service-role (cote serveur) peut appeler cette fonction.
revoke execute on function fn_limiter_debit(text, integer, integer) from public, anon, authenticated;
