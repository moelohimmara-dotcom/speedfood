-- L10 : suivi des incidents de livraison. Aucun remboursement automatique ni argent dans cette table.
create table public.incidents_livraison (
  id uuid primary key default gen_random_uuid(),
  livraison_id uuid references public.livraisons (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  type text not null check (type in ('retard', 'colis_perdu', 'litige', 'autre')),
  gravite text not null default 'normale' check (gravite in ('faible', 'normale', 'elevee', 'critique')),
  statut text not null default 'ouvert' check (statut in ('ouvert', 'en_cours', 'resolu', 'clos')),
  motif text not null check (char_length(motif) between 5 and 500),
  responsable_id uuid references auth.users (id) on delete set null,
  resolution text check (resolution is null or resolution in ('relivraison', 'avoir', 'remboursement_manuel', 'aucune')),
  resolution_motif text check (resolution_motif is null or char_length(resolution_motif) between 5 and 500),
  cree_par uuid not null references auth.users (id) on delete restrict,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  clos_le timestamptz,
  constraint incident_cible check (livraison_id is not null or order_id is not null),
  constraint incident_resolution_coherente check (statut in ('ouvert', 'en_cours') or (resolution is not null and resolution_motif is not null))
);
create index incidents_livraison_statut_idx on public.incidents_livraison (statut, mis_a_jour_le desc);
create index incidents_livraison_livraison_idx on public.incidents_livraison (livraison_id) where livraison_id is not null;
create index incidents_livraison_order_idx on public.incidents_livraison (order_id) where order_id is not null;
alter table public.incidents_livraison enable row level security;
create policy "support_lit_incidents_livraison" on public.incidents_livraison for select to authenticated using (public.fn_est_admin_systeme(array['support', 'super_admin']));
create policy "support_cree_incidents_livraison" on public.incidents_livraison for insert to authenticated with check (public.fn_est_admin_systeme(array['support', 'super_admin']) and cree_par = (select auth.uid()));
create policy "support_maj_incidents_livraison" on public.incidents_livraison for update to authenticated using (public.fn_est_admin_systeme(array['support', 'super_admin'])) with check (public.fn_est_admin_systeme(array['support', 'super_admin']));
revoke delete on public.incidents_livraison from authenticated;
revoke all on public.incidents_livraison from anon;
