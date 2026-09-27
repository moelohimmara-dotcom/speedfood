-- Bloc 8c — CMS éditorial et taxonomie (CMS système, PLAN-EXECUTION.md).
--
-- 1. Taxonomie (menu_categories, neighborhoods) : la RLS du bloc 2 ne prévoyait
--    qu'une lecture publique, aucune policy d'écriture n'existait — un vrai
--    trou, pas un oubli mineur, puisque rien ne permettait de gérer ces tables
--    autrement qu'en SQL direct. Comblé ici avec la permission `taxonomie.editer`
--    (content_editor, super_admin — matrice v1.0.0, inchangée).
-- 2. `content_banners` n'avait ni auteur ni date de mise à jour, contrairement à
--    `content_pages` — incohérent avec l'exigence d'acceptation du bloc 8c
--    ("chaque contenu porte auteur, date et état brouillon/publié").
--
-- content_pages, content_banners, featured_placements ont déjà leurs policies
-- d'écriture correctes depuis le bloc 2 (vérifié) : aucun changement RLS ici
-- pour ces trois tables.

create policy "editeurs_gestion_taxonomie_categories" on menu_categories
  for all using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

create policy "editeurs_gestion_taxonomie_quartiers" on neighborhoods
  for all using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

alter table content_banners
  add column if not exists auteur_id uuid references auth.users(id),
  add column if not exists mis_a_jour_le timestamptz not null default now();
