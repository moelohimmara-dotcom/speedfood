-- Commission Speedfood mixte (décision de Malika du 19 novembre 2026).
--
-- Jusqu'ici la commission Speedfood sur un paiement en ligne était un frais FIXE par commande
-- (`frais_speedfood_commande_gnf`, 1 000 GNF par défaut), prélevé sur la part du restaurant.
-- Elle devient MIXTE : le même fixe, plus un pourcentage du montant du repas
-- (`commission_speedfood_permille`, en pour-mille comme les frais du prestataire : 20 = 2 %),
-- le total restant plafonné au repas. À 0 par défaut : rien ne change tant que la console
-- n'a pas réglé le taux. Le calcul vit côté serveur (`calculerRepartition`), la console
-- `/system/parametres/paiement` règle les deux parts sans déploiement.
alter table public.parametres_paiement
  add column if not exists commission_speedfood_permille integer not null default 0
    check (commission_speedfood_permille between 0 and 1000);
