-- L12 : trace d'un remboursement fait A LA MAIN au client (le prestataire de paiement n'en propose pas).
-- Le passage du paiement a « rembourse » et les ecritures comptables existent deja ; cette table garde QUI a rendu l'argent, PAR QUEL MOYEN et AVEC QUELLE REFERENCE.
-- Orange Money et MTN MoMo sont les moyens normaux ; les especes sont le dernier recours (nom du receveur et motif detaille obligatoires).
-- Aucun acces client : la table n'est lue et ecrite que par le serveur (cle de service), comme les autres tables de paiement.
create table public.remboursements_manuels (
  id uuid primary key default gen_random_uuid(),
  paiement_id uuid not null unique references public.paiements (id) on delete restrict,
  litige_id uuid references public.litiges_paiement (id) on delete set null,
  moyen text not null check (moyen in ('orange_money', 'mtn_momo', 'especes')),
  montant_gnf integer not null check (montant_gnf > 0),
  -- Reference de la transaction (obligatoire en mobile money), ou numero du recu signe (especes).
  reference text check (reference is null or char_length(reference) between 3 and 60),
  -- Especes seulement : nom de la personne qui a recu l'argent.
  recu_par text check (recu_par is null or char_length(recu_par) between 3 and 80),
  motif text not null check (char_length(motif) between 5 and 300),
  effectue_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  constraint remboursement_mobile_money_reference check (moyen = 'especes' or reference is not null),
  constraint remboursement_especes_recu check (moyen <> 'especes' or (recu_par is not null and char_length(motif) >= 15))
);
alter table public.remboursements_manuels enable row level security;
revoke all on table public.remboursements_manuels from anon, authenticated;
