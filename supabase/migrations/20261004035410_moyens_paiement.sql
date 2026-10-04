-- Moyens de paiement acceptes par le restaurant (lot D). Information DECLAREE par le restaurateur et affichee
-- sur la fiche : Speedfood n'encaisse rien. Liste fermee, cardinalite bornee.
alter table public.restaurants
  add column moyens_paiement text[] not null default '{}'
  check (moyens_paiement <@ array['especes', 'orange_money', 'mtn_momo']::text[] and cardinality(moyens_paiement) <= 3);
