-- Historique des jetons de design (palier 4, phase 1) — « revenir à un point antérieur ».
--
-- Un journal d'ÉCRITURES, pas d'instantanés : chaque ligne dit ce qu'un jeton VALAIT avant et ce
-- qu'il vaut après. Rétablir une ligne remet ce jeton à sa valeur précédente. On peut ainsi
-- revenir en arrière N actions, une par une, même après avoir rechargé la page ou changé de
-- navigateur — contrairement à un simple annuler/refaire, qui vit dans la seule session.
--
-- Pourquoi pas un instantané complet des 35 jetons à chaque changement : c'était l'autre option,
-- et elle est rejetée. Un instantané ne dit pas CE QUI a changé, oblige à réécrire tout l'état
-- (donc à écraser une couleur saisie par quelqu'un d'autre entre-temps), et grossit pour rien :
-- changer une couleur sur 35 n'en change qu'une.
--
-- SÉCURITÉ. Même posture que `design_tokens` : ces lignes décrivent ce que le site affiche, donc
-- RLS sans policy et trigger qui n'accepte que le rôle de service. La lecture se fait par la clé
-- de service, après `parametres.editer` + palier 2, comme le reste de l'écran Design.

create table if not exists public.design_tokens_historique (
  id uuid primary key default gen_random_uuid(),
  portee text not null default 'site',
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  cle text not null,
  /** Valeur avant le changement. `null` = le jeton n'existait pas encore (premiere ecriture). */
  valeur_avant text,
  valeur_apres text not null,
  /** `retour_origine` = le jeton a ete supprime pour revenir a la valeur du code. */
  action text not null,
  auteur_id uuid references auth.users(id) on delete set null,
  cree_le timestamptz not null default now(),

  constraint design_tokens_historique_action check (action in ('creation', 'modification', 'suppression', 'retour_origine')),
  constraint design_tokens_historique_cle check (cle ~ '^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$')
);

-- La liste de l'ecran est un ordre chronologique inverse ; un index sur (portee, cree_le desc)
-- evite un tri de toute la table.
create index if not exists design_tokens_historique_recent
  on public.design_tokens_historique (portee, cree_le desc);

-- On garde 200 changements par portee : de quoi remonter loin, sans grossir indefiniment. Le
-- nettoyage est fait par le trigger ci-dessous, ce qui evite une tache planifiee.
create or replace function public.fn_garde_jetons_historique()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Refus : l''historique des jetons de design n''est modifiable que par le serveur.'
      using errcode = '42501';
  end if;

  -- Retention : on ne garde que les 200 derniers changements de la meme portee.
  delete from public.design_tokens_historique
   where id in (
     select id from public.design_tokens_historique
      where portee = new.portee
      order by cree_le desc
      offset 200
   );

  return new;
end;
$$;

revoke execute on function public.fn_garde_jetons_historique() from public, anon, authenticated;

alter table public.design_tokens_historique enable row level security;
revoke all on public.design_tokens_historique from anon, authenticated;

-- Le déclencheur est créé ICI, après la RLS. Sans lui la fonction ci-dessus n'est jamais appelée :
-- ni la garde d'écriture, ni la rétention. (Une première version de cette migration oubliait
-- précisément ce `create trigger` — la fonction existait, la table n'était donc ni gardée ni bornée.)
create trigger trg_garde_jetons_historique
  before insert on public.design_tokens_historique
  for each row execute function public.fn_garde_jetons_historique();

comment on table public.design_tokens_historique is
  'Journal des changements de jetons de design. Une ligne = un changement, avec sa valeur avant et '
  'apres ; la restaurer remet ce jeton a sa valeur precedente. Les lignes retour_origine correspondent '
  'a une suppression : leur valeur_apres est la valeur du code.';
