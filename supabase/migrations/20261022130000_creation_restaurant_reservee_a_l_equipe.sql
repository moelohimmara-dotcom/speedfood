-- Modèle « Speedfood intermédiaire » (ADR-020) : un restaurant n'est plus créé par son propriétaire. L'équipe inscrit l'établissement après la
-- demande de référencement et tient son catalogue. La fonction d'onboarding libre n'est donc plus exécutable par un compte connecté (elle
-- l'était seulement par l'application ; sans ceci, un appel direct à l'API aurait contourné le changement). Les restaurants déjà créés ne sont pas
-- touchés ; l'équipe crée les nouveaux avec la clé de service (policy « admins_creation_restaurants » pour les administrateurs).

revoke execute on function public.fn_creer_restaurant_et_owner(text, uuid, uuid) from authenticated;
