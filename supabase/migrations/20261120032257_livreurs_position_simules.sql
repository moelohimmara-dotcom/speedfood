-- Livreurs de démonstration : leur position n'est plus effacée au passage hors ligne.
--
-- La migration 20261118200000 efface la position d'un livreur dès qu'il passe hors ligne, et exclut
-- les livreurs simulés (`simule = true`) du seul nettoyage de 24 heures. Le déclencheur, lui, ne les
-- excluait pas : mettre un livreur de démonstration hors ligne puis en ligne depuis la console lui
-- retirait sa position pour de bon. Or le dispatch ignore tout livreur sans position : la
-- démonstration ne lui aurait plus jamais donné de course.
--
-- Un livreur simulé est fictif (aucune donnée personnelle) : l'exempter du déclencheur ne change
-- rien à la décision de confidentialité du 18 novembre 2026, qui vise les vrais livreurs.
-- Le reste est inchangé : un vrai livreur hors ligne n'a toujours aucune position.
create or replace function public.fn_livreurs_effacer_position_hors_ligne()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut = 'hors_ligne' and new.simule = false then
    new.latitude := null;
    new.longitude := null;
    new.position_le := null;
  end if;
  return new;
end;
$$;
