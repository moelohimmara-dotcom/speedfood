-- Studio, palier 1 : emplacements de contenu. Chaque texte du site public est un « emplacement » nommé (clé) avec une valeur
-- par défaut dans le code ; une ligne ici remplace ce défaut. Table additive. Aucune policy pour anon : la lecture publique
-- passe par le service-role (comme `fonctionnalites`). Édition réservée aux mêmes rôles que les policies
-- `editeurs_gestion_contenu` / `editeurs_gestion_bannieres` (content_editor, super_admin ; permission « contenu.editer »).

create table contenu_emplacements (
  cle text primary key check (cle ~ '^[a-z0-9_.]{3,80}$'),
  valeur text not null check (char_length(valeur) between 1 and 2000),
  mis_a_jour_le timestamptz not null default now(),
  mis_a_jour_par uuid references auth.users(id) on delete set null
);

alter table contenu_emplacements enable row level security;

create policy "editeurs_gestion_emplacements" on contenu_emplacements
  for all to authenticated
  using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

-- Défense en profondeur : aucun droit de table pour anon (la RLS sans policy donnerait déjà zéro ligne).
revoke all on contenu_emplacements from anon;
