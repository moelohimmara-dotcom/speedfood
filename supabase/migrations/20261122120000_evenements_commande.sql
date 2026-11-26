-- File d'événements de commande (fiabilité des alertes, 22 novembre 2026).
--
-- Aujourd'hui, quand une commande est créée, l'alerte au restaurant part une fois, en meilleur
-- effort : un envoi qui échoue n'est jamais réessayé, et rien ne journalise la tentative. Cette
-- table est le journal des événements à livrer : une ligne par événement (clé unique, donc un
-- même événement ne s'écrit qu'une fois), son état d'envoi, le nombre d'essais et la prochaine
-- tentative. La tâche planifiée du site (toutes les 5 minutes) reprend les événements en attente
-- dont l'heure est venue, avec des délais qui s'espacent, et abandonne après 5 essais.
-- Réservée au serveur (clé de service) : aucun rôle de l'API ne la lit ni ne l'écrit.
create table public.evenements_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null check (type in ('commande_nouvelle')),
  cle text not null unique,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'envoye', 'abandonne')),
  essais integer not null default 0 check (essais >= 0),
  prochaine_tentative_le timestamptz not null default now(),
  cree_le timestamptz not null default now(),
  envoye_le timestamptz
);

create index evenements_commande_file_idx on public.evenements_commande (statut, prochaine_tentative_le);

alter table public.evenements_commande enable row level security;

revoke all on table public.evenements_commande from anon, authenticated;
