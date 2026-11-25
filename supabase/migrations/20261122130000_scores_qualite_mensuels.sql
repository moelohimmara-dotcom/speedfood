-- Scores qualité mensuels des restaurants (décisions de Malika du 22 novembre 2026).
--
-- Un instantané par restaurant et par mois : le score (0 à 100), le palier, les six indicateurs
-- qui l'ont composé (gardés en jsonb pour pouvoir expliquer le score au restaurateur) et le
-- nombre de mois consécutifs au palier le plus bas, qui pilote l'échelle de dégradation écrite
-- (avertissements, retrait des avantages, suspension, puis décision humaine, jamais automatique).
-- Calculé par le serveur (tâche planifiée), lu par la console équipe et, plus tard, la console
-- du restaurateur. Réservé à la clé de service : aucun rôle de l'API n'y touche directement.
create table public.scores_qualite_mensuels (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  mois date not null,
  score integer not null check (score between 0 and 100),
  palier text not null check (palier in ('excellent', 'tres_bon', 'bon', 'moyen', 'mauvais')),
  indicateurs jsonb not null default '{}'::jsonb,
  mois_bas_consecutifs integer not null default 0 check (mois_bas_consecutifs >= 0),
  calcule_le timestamptz not null default now(),
  unique (restaurant_id, mois)
);

alter table public.scores_qualite_mensuels enable row level security;

revoke all on table public.scores_qualite_mensuels from anon, authenticated;
