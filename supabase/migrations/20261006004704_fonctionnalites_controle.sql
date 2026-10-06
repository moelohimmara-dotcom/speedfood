-- Contrôle des mises à jour par le super administrateur : chaque nouveauté livrée en octobre 2026 est une « fonctionnalité » qu'on peut
-- couper ou rétablir sans redéployer (interrupteur d'urgence). Lecture : administrateurs système. Modification de l'état : super_admin
-- seulement, et UNIQUEMENT les colonnes d'état (le catalogue, lui, ne se modifie que par migration). Aucune insertion ni suppression
-- depuis l'application. La lecture côté application publique passe par le service-role (comme parametres_application).

create table fonctionnalites (
  cle text primary key check (cle ~ '^[a-z0-9_]{3,40}$'),
  libelle text not null check (char_length(libelle) between 3 and 80),
  description text not null check (char_length(description) <= 400),
  groupe text not null check (groupe in ('public', 'commande', 'restaurant')),
  ordre integer not null default 0,
  active boolean not null default true,
  mis_a_jour_le timestamptz not null default now(),
  mis_a_jour_par uuid references auth.users(id)
);

alter table fonctionnalites enable row level security;

create policy "admins_lecture_fonctionnalites" on fonctionnalites
  for select to authenticated using (fn_est_admin_systeme());

create policy "super_admin_maj_fonctionnalites" on fonctionnalites
  for update to authenticated
  using (fn_est_admin_systeme(array['super_admin']))
  with check (fn_est_admin_systeme(array['super_admin']));

-- Seules les colonnes d'état sont modifiables par une session (le libellé, la description et la clé restent propres au catalogue).
revoke insert, update, delete on fonctionnalites from anon, authenticated;
grant select on fonctionnalites to authenticated;
grant update (active, mis_a_jour_le, mis_a_jour_par) on fonctionnalites to authenticated;

insert into fonctionnalites (cle, libelle, description, groupe, ordre) values
  ('animations_public', 'Animations du site public', 'Boucles et micro-animations (défilement des accroches, macarons, confettis, illustrations animées). Coupées, le site reste complet et lisible.', 'public', 10),
  ('scenes_envie_accueil', 'Scènes animées « Votre envie du moment ? »', 'Les quatre scènes vectorielles de l''accueil qui défilent au rythme des puces. Coupées, le bloc revient à la version simple (puces et plat suggéré).', 'public', 20),
  ('commande_a_table', 'Commande à table', 'Mode « à table » avec numéro de table (QR de table). Coupé, les clients ne peuvent plus choisir ce mode ; les commandes déjà passées ne changent pas.', 'commande', 30),
  ('documents_recus', 'Reçus et factures numérotés', 'Émission des reçus et factures numérotés par les restaurants. Coupée, plus aucun nouveau document n''est émis ; ceux déjà émis restent consultables.', 'restaurant', 40),
  ('lien_court_scans', 'Comptage des scans du lien court', 'Comptage anonyme des visites par QR, affiche, WhatsApp et table. Coupé, le lien court redirige toujours mais ne compte plus.', 'restaurant', 50);
