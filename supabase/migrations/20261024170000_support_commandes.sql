-- Lot L4 : fil de support lié à une commande.
-- Les tables sont isolées par commande ; aucune coordonnée client n'y est copiée.
create table if not exists public.support_threads (
  commande_id uuid primary key references public.orders(id) on delete cascade,
  statut text not null default 'ouvert' check (statut in ('ouvert', 'resolu')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.orders(id) on delete cascade,
  auteur text not null check (auteur in ('client', 'equipe')),
  contenu text not null check (length(trim(contenu)) between 1 and 1000),
  cree_le timestamptz not null default now()
);

create index if not exists idx_support_messages_commande_date on public.support_messages(commande_id, cree_le);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create policy "support_lecture_fils" on public.support_threads for select to authenticated
  using (public.fn_est_admin_systeme(array['support', 'super_admin']));
create policy "support_ecriture_fils" on public.support_threads for insert to authenticated
  with check (public.fn_est_admin_systeme(array['support', 'super_admin']));
create policy "support_modification_fils" on public.support_threads for update to authenticated
  using (public.fn_est_admin_systeme(array['support', 'super_admin']))
  with check (public.fn_est_admin_systeme(array['support', 'super_admin']));

create policy "support_lecture_messages" on public.support_messages for select to authenticated
  using (public.fn_est_admin_systeme(array['support', 'super_admin']));
create policy "support_ecriture_messages" on public.support_messages for insert to authenticated
  with check (public.fn_est_admin_systeme(array['support', 'super_admin']));

revoke all on public.support_threads, public.support_messages from anon;
grant select, insert, update on public.support_threads to authenticated;
grant select, insert on public.support_messages to authenticated;
