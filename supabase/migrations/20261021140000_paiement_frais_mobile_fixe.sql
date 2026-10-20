-- Frais du prestataire de paiement : une PARTIE FIXE s'ajoute au pourcentage (lot P5, 21 octobre 2026).
--
-- Mesure faite en mode test chez Chap Chap Pay (docs/CHAPCHAP-NOTES-API.md) : commission = 200 GNF + 2 % du montant (3 000 GNF → 260,
-- 10 000 GNF → 400). Les réglages ne connaissaient qu'un pour-mille, ce qui sous-estimait les frais. On ajoute la partie fixe et on aligne les
-- valeurs de simulation sur cette mesure ; le frais Speedfood par commande passe de 1 000 à 1 500 GNF pour garder une marge (décision de
-- Malika, option « frais Speedfood relevé pour le paiement en ligne »). Toutes ces valeurs restent des valeurs de SIMULATION, réglables sans
-- déploiement, tant que « valeurs_validees_le » est vide.
alter table public.parametres_paiement
  add column frais_mobile_fixe_gnf integer not null default 0 check (frais_mobile_fixe_gnf >= 0 and frais_mobile_fixe_gnf <= 100000);

update public.parametres_paiement
   set frais_mobile_fixe_gnf = 200,
       frais_mobile_permille_orange = 20,
       frais_mobile_permille_mtn = 20,
       frais_speedfood_commande_gnf = 1500,
       mis_a_jour_le = now()
 where id = true;
