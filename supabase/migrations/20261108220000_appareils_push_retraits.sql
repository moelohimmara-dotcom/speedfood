-- Appareils des applications natives : traces de retrait (protocole I2, résidu du lot « cycle de session »).
--
-- Le retrait d'un appareil laissait une course possible : un enregistrement parti avant la déconnexion pouvait être
-- appliqué par le serveur APRES le retrait et réattacher l'appareil à un compte déconnecté. Le client ordonne déjà ses
-- émissions ; ce qui manquait est l'ordre d'application côté serveur.
--
-- Cette table garde, par compte et par appareil (empreinte SHA-256 du jeton, jamais le jeton), la session qui a retiré
-- l'appareil. Un enregistrement de la même session est ensuite refusé ; une autre session (vraie reconnexion) consomme
-- la trace en s'enregistrant. Même régime que `appareils_push` : table réservée au serveur (clé de service), aucune
-- policy, aucun accès pour anon ni authenticated. Le jeton d'appareil ne figure pas dans cette table.

create table public.appareils_push_retraits (
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  jeton_empreinte text not null check (jeton_empreinte ~ '^[0-9a-f]{64}$'),
  session_id text not null check (char_length(session_id) between 1 and 200),
  retire_le timestamptz not null default now(),
  primary key (utilisateur_id, jeton_empreinte)
);

alter table public.appareils_push_retraits enable row level security;
revoke all on public.appareils_push_retraits from anon, authenticated;
