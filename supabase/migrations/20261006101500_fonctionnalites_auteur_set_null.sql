-- L'auteur de la dernière modification d'un interrupteur ne doit pas empêcher la suppression de son compte : la référence passe à NULL.
alter table fonctionnalites drop constraint fonctionnalites_mis_a_jour_par_fkey;
alter table fonctionnalites add constraint fonctionnalites_mis_a_jour_par_fkey
  foreign key (mis_a_jour_par) references auth.users(id) on delete set null;
