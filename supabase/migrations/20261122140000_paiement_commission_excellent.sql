-- Commission réduite du palier excellent (chantier score qualité, 22 novembre 2026).
--
-- Au palier « excellent » du score qualité mensuel, la commission Speedfood (fixe plus pourcentage du repas)
-- est réduite de ce taux, en pour-mille de la commission elle-même : 500 = moitié moins. À 500 par défaut,
-- réglable dans la console `/system/parametres/paiement` sans déploiement. Le calcul reste côté serveur
-- (`calculerRepartition`), plafonné au repas comme avant.
alter table public.parametres_paiement
  add column if not exists commission_reduction_excellent_permille integer not null default 500
    check (commission_reduction_excellent_permille between 0 and 1000);
