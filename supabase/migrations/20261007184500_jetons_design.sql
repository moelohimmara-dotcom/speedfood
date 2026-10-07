-- Jetons de design (palier 4, phase 1) — le design devient une DONNÉE, plus une valeur figée dans globals.css.
--
-- Objectif : permettre de changer les couleurs, typographies, espacements et rayons de TOUT le site
-- depuis un écran d'administration, sans toucher au code et sans qu'un bloc stocke jamais une valeur
-- brute. Un bloc référence une CLÉ de jeton ; changer la définition de la clé change le site entier.
--
-- Portée : `portee = 'site'` pour les jetons de la maison (édités par un super administrateur),
-- `portee = 'restaurant'` pour l'identité d'un restaurant (éditée par son propriétaire). À la
-- résolution, un jeton restaurant écrase le jeton site de même clé, sinon il y a repli.
--
-- SÉCURITÉ. Ces jetons décident de ce que le site affiche. Un contournement par l'API de données
-- (clé anon publique + son mot de passe) permettrait de rebaptiser tout le site et d'implanter des
-- 叶 valeurs arbitraires. Donc, comme les autres tables de contenu :
--   - RLS activée, aucune policy d'écriture pour `anon` ni `authenticated` ;
--   - toutes les écritures passent par des actions serveur en clé de service, après
--     `parametres.editer` + palier (voir src/lib/system-admin/design-actions.ts) ;
--   - un trigger `fn_garde_jetons_design` refuse en base toute écriture qui ne vient pas du rôle
--     de service, même si une policy était un jour révoquée par erreur.
--
-- CONTRASTE. Le contrôle WCAG ne peut pas être fait en base (il faut le calcul de luminance), il
-- est donc fait par l'action serveur AVANT l'écriture, avec la même fonction `contraste` que
-- celle du test des fonds de blocs. La base refuse seulement ce qui est structurellement
-- impossible : mauvaise portée, clé inconnue, valeur trop longue.

create table if not exists public.design_tokens (
  id uuid primary key default gen_random_uuid(),
  portee text not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  cle text not null,
  valeur text not null,
  libelle text not null,
  groupe text not null,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),

  constraint design_tokens_portee check (portee in ('site', 'restaurant')),
  -- Une portée « restaurant » exige un restaurant, et inversement : pas de jeton orphelin.
  constraint design_tokens_cible check (
    (portee = 'site' and restaurant_id is null) or
    (portee = 'restaurant' and restaurant_id is not null)
  ),
  constraint design_tokens_cle check (cle ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+)+$'),
  constraint design_tokens_libelle check (length(libelle) between 1 and 80),
  constraint design_tokens_valeur check (length(valeur) between 1 and 200),
  constraint design_tokens_groupe check (groupe in ('couleurs', 'typographie', 'espacements', 'formes'))
);

-- Un jeton par clé et par portée. `coalesce` parce qu'en PostgreSQL NULL <> NULL : sans lui,
-- deux jetons « site » de même clé seraient acceptés.
create unique index if not exists design_tokens_unique_cible
  on public.design_tokens (portee, coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), cle);

create index if not exists design_tokens_restaurant_idx on public.design_tokens (restaurant_id) where restaurant_id is not null;

alter table public.design_tokens enable row level security;

-- Aucune policy : les lectures et les écritures passent par la clé de service.

revoke all on public.design_tokens from anon, authenticated;

create or replace function public.fn_garde_jetons_design()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Refus : les jetons de design ne sont modifiables que par le serveur.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_garde_jetons_design() from public, anon, authenticated;

create trigger trg_garde_jetons_design
  before insert or update or delete on public.design_tokens
  for each row execute function public.fn_garde_jetons_design();

comment on table public.design_tokens is
  'Jetons de design du site et des restaurants (palier 4). Un bloc ne stocke qu''une clé, jamais une valeur. '
  'Écriture réservée au rôle de service ; le contraste WCAG est vérifié par l''action serveur avant l''écriture.';

-- ------------------------------------------------------------------------------
-- Semence : les jetons ACTUELS de globals.css, à l'identique.
--
-- But : que la phase 1 soit invisible. Les valeurs ci-dessous sont copiées caractère par
-- caractère depuis `src/app/globals.css` (lignes 7 à 53 au 7 octobre 2026). Tant que
-- `/system/design` n'a rien modifié, la résolution retourne exactement ces valeurs, et le site
-- ne peut pas changer d'un pixel.
--
-- Si une valeur diverge un jour de globals.css, c'est le code qui fait foi : voir
-- `scripts/tests/design.test.mts`, qui compare les jetons semés aux variables CSS du dépôt.
-- ------------------------------------------------------------------------------

insert into public.design_tokens (portee, cle, valeur, libelle, groupe) values
  -- Couleurs — identiques à globals.css:8-20
  ('site', 'couleur.rouge',        '#d9362b', 'Rouge principal',        'couleurs'),
  ('site', 'couleur.rouge-fonce',  '#b82a20', 'Rouge foncé',            'couleurs'),
  ('site', 'couleur.orange',       '#ff7a1a', 'Orange',                 'couleurs'),
  ('site', 'couleur.mangue',       '#ffc247', 'Mangue',                 'couleurs'),
  ('site', 'couleur.creme',        '#fff6ed', 'Crème (fond de page)',   'couleurs'),
  ('site', 'couleur.surface',      '#fffefc', 'Surface (cartes)',       'couleurs'),
  ('site', 'couleur.encre',        '#2b211d', 'Encre (texte)',          'couleurs'),
  ('site', 'couleur.secondaire',   '#75695f', 'Gris secondaire',        'couleurs'),
  ('site', 'couleur.bordure',      '#e9dcd2', 'Bordure',                'couleurs'),
  ('site', 'couleur.succes',       '#2e7d32', 'Succès',                 'couleurs'),
  ('site', 'couleur.succes-fond',  '#e7f4e8', 'Fond de succès',         'couleurs'),
  ('site', 'couleur.danger',       '#c62828', 'Danger',                 'couleurs'),
  ('site', 'couleur.danger-fond',  '#fbeaea', 'Fond de danger',         'couleurs'),
  ('site', 'couleur.gradient-marque', 'linear-gradient(135deg, #d4430f 0%, #b82a20 70%)',
   'Dégradé de marque', 'couleurs'),

  -- Typographie — familles auto-hébergées par next/font, donc aucune requête Google à l'exécution.
  -- On ne stocke que la valeur de font-family, jamais une adresse distante : la CSP
  -- (`font-src 'self' data:`) l'interdirait de toute façon.
  ('site', 'police.corps',    'var(--font-manrope), system-ui, sans-serif', 'Police du texte',   'typographie'),
  ('site', 'police.titre',    'var(--font-bricolage), system-ui, sans-serif', 'Police des titres', 'typographie'),
  ('site', 'police.condensee', 'var(--font-barlow), system-ui, sans-serif',    'Police condensée',  'typographie'),

  -- Espacements — l'échelle de globals.css:32-38, réinjectée telle quelle.
  ('site', 'espace.1', '4px',  'Espace 1', 'espacements'),
  ('site', 'espace.2', '8px',  'Espace 2', 'espacements'),
  ('site', 'espace.3', '12px', 'Espace 3', 'espacements'),
  ('site', 'espace.4', '16px', 'Espace 4', 'espacements'),
  ('site', 'espace.5', '20px', 'Espace 5', 'espacements'),
  ('site', 'espace.6', '24px', 'Espace 6', 'espacements'),
  ('site', 'espace.8', '32px', 'Espace 8', 'espacements'),

  -- Formes — rayons et ombres de globals.css:40-48
  ('site', 'forme.rayon-sm',    '8px',   'Rayon petit',  'formes'),
  ('site', 'forme.rayon-md',    '14px',  'Rayon moyen',  'formes'),
  ('site', 'forme.rayon-lg',    '20px',  'Rayon grand',  'formes'),
  ('site', 'forme.rayon-pill',  '999px', 'Pastille',     'formes'),
  ('site', 'forme.ombre-sm',    '0 1px 2px rgba(43, 33, 29, 0.06), 0 1px 1px rgba(43, 33, 29, 0.04)', 'Ombre petite', 'formes'),
  ('site', 'forme.ombre-md',    '0 6px 16px rgba(43, 33, 29, 0.1), 0 2px 4px rgba(43, 33, 29, 0.06)',   'Ombre moyenne', 'formes'),
  ('site', 'forme.ombre-lg',    '0 16px 32px rgba(43, 33, 29, 0.14), 0 4px 8px rgba(43, 33, 29, 0.08)',  'Ombre grande', 'formes'),
  ('site', 'forme.ombre-focus', '0 0 0 3px rgba(255, 122, 26, 0.35)', 'Focus clavier', 'formes'),
  ('site', 'forme.ease',        'cubic-bezier(0.2, 0.7, 0.3, 1)', 'Courbe d\'animation', 'formes'),
  ('site', 'forme.duree-fast',  '120ms', 'Animation rapide', 'formes'),
  ('site', 'forme.duree-base',  '200ms', 'Animation normale', 'formes')
on conflict do nothing;
