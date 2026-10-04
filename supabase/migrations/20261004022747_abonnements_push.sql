-- Abonnements aux notifications push web : alerte de nouvelle commande, page fermee (lot A2).
-- Un abonnement = un navigateur d'un membre du restaurant. La notification est envoyee SANS contenu
-- (texte generique cote Service Worker) : aucune donnee de client ne passe par les services de push.
-- Les cles p256dh et auth sont conservees pour un futur contenu chiffre ; elles ne sortent jamais du serveur.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  agent text check (agent is null or char_length(agent) <= 300),
  cree_le timestamptz not null default now(),
  derniere_reussite_le timestamptz,
  echecs integer not null default 0 check (echecs >= 0)
);

create index push_subscriptions_restaurant_idx on public.push_subscriptions (restaurant_id);
create index push_subscriptions_utilisateur_idx on public.push_subscriptions (utilisateur_id);

alter table public.push_subscriptions enable row level security;

-- Un membre ne voit, ne cree et ne supprime que SES abonnements. L'envoi lit tous les abonnements d'un
-- restaurant avec la cle service-role, cote serveur uniquement. Pas de policy de modification.
create policy "membre_lit_ses_abonnements_push" on public.push_subscriptions
  for select to authenticated
  using (utilisateur_id = (select auth.uid()));

create policy "membre_cree_son_abonnement_push" on public.push_subscriptions
  for insert to authenticated
  with check (utilisateur_id = (select auth.uid()) and fn_est_membre_restaurant(restaurant_id));

create policy "membre_supprime_son_abonnement_push" on public.push_subscriptions
  for delete to authenticated
  using (utilisateur_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;

-- Au plus 10 appareils par personne (un navigateur oublie ses abonnements sans prevenir : on borne).
create or replace function public.fn_limiter_abonnements_push()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if (select count(*) from public.push_subscriptions where utilisateur_id = new.utilisateur_id) >= 10 then
    raise exception 'Trop d''appareils abonnes pour ce compte.' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

revoke execute on function public.fn_limiter_abonnements_push() from public, anon, authenticated;

create trigger trg_limiter_abonnements_push
  before insert on public.push_subscriptions
  for each row execute function public.fn_limiter_abonnements_push();
