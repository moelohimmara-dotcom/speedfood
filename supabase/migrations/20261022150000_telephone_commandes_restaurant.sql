-- Poste de répartition (ADR-020) : pour un établissement tenu par l'équipe (mode « speedfood »), l'équipe confirme chaque commande par téléphone ou WhatsApp.
-- Le numéro à joindre est un contact INTERNE de l'établissement : il vit dans une table à part, réservée au serveur (aucun accès navigateur), et non dans
-- `restaurants`, dont la lecture publique (policy « lecture_publique_restaurants_publies ») exposerait toute colonne ajoutée à n'importe quel visiteur.
-- Repris de la demande de référencement à la création de l'établissement, modifiable ensuite par l'administration.

create table public.restaurant_contacts_internes (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  telephone_commandes text not null check (char_length(telephone_commandes) between 6 and 20),
  mis_a_jour_le timestamptz not null default now()
);

alter table public.restaurant_contacts_internes enable row level security;
revoke all on public.restaurant_contacts_internes from anon, authenticated;
create policy "aucun_acces_direct" on public.restaurant_contacts_internes for all to anon, authenticated using (false) with check (false);
