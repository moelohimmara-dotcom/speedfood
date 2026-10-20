-- Notifications de suivi de commande pour les clients (espace client, 21 octobre 2026).
--
-- Principe de confidentialité : la notification web push est envoyée VIDE (comme pour les restaurants). Le Service Worker du client récupère
-- ensuite le TEXTE sur notre serveur (`client_notifications`), avec la session du client : rien de ce qui concerne la commande ne transite par
-- Google, Mozilla ou Apple.
--
-- Les deux tables : lecture limitée à leur propriétaire (`to authenticated`, jamais anon) ; toutes les écritures passent par le serveur.

create table public.client_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  agent text check (agent is null or char_length(agent) <= 300),
  cree_le timestamptz not null default now(),
  derniere_reussite_le timestamptz,
  echecs integer not null default 0 check (echecs >= 0)
);
create index client_push_subscriptions_utilisateur_idx on public.client_push_subscriptions (utilisateur_id);

create table public.client_notifications (
  id bigint generated always as identity primary key,
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  type text not null check (type in ('acceptee', 'prete', 'refusee', 'annulee', 'terminee')),
  cree_le timestamptz not null default now(),
  lue_le timestamptz
);
create index client_notifications_non_lues_idx on public.client_notifications (utilisateur_id, cree_le desc) where lue_le is null;

alter table public.client_push_subscriptions enable row level security;
alter table public.client_notifications enable row level security;
revoke all on table public.client_push_subscriptions, public.client_notifications from anon;
revoke insert, update, delete, truncate on table public.client_push_subscriptions, public.client_notifications from authenticated;

create policy "client_lit_ses_abonnements_push" on public.client_push_subscriptions
  for select to authenticated using (utilisateur_id = (select auth.uid()));
create policy "client_lit_ses_notifications" on public.client_notifications
  for select to authenticated using (utilisateur_id = (select auth.uid()));

-- Au plus cinq appareils par compte ; une notification d'une même commande et d'un même type n'est créée qu'une fois.
create or replace function public.fn_client_push_limite()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.client_push_subscriptions where utilisateur_id = new.utilisateur_id) >= 5 then
    raise exception 'Cinq appareils au plus' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_client_push_limite() from public, anon, authenticated;
create trigger trg_client_push_limite
  before insert on public.client_push_subscriptions
  for each row execute function public.fn_client_push_limite();

create unique index client_notifications_une_par_etape_uq on public.client_notifications (utilisateur_id, order_id, type) where order_id is not null;
