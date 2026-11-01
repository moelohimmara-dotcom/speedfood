# Diagnostic des deux Workers — 1er novembre 2026

## Conclusion

L’essai réel a créé SF-WMQXU sur le site et SF-SC78P sur l’API, deux commandes TEST confirmées par la capture client. HTTP 201 des deux côtés, jetons différents, code 1. Ne pas relancer le lanceur, supprimer son verrou ou allumer commandes.

La divergence du secret effectif de dérivation est la piste principale, pas une cause définitivement prouvée. L’audit n’a lu aucune valeur secrète. Aucun changement de configuration, déploiement, POST de commande ou changement de statut effectué.

## Vérifications

| Point | Site speedfood-app | API speedfood-api |
| --- | --- | --- |
| Version active visible | 41a9b4b7, trafic 100 % | 8a77448b, trafic 100 % |
| Date de compatibilité visible | 2026-09-27 | 2026-09-27 |
| Indicateurs visibles | nodejs_compat, global_fetch_strictly_public | identiques |
| COMMANDE_JETON_SECRET | présent, valeur chiffrée | présent, valeur chiffrée |
| SUPABASE_SERVICE_ROLE_KEY | présent, valeur chiffrée | présent, valeur chiffrée |
| FCM_SERVICE_ACCOUNT | présent, valeur chiffrée | absent de la liste des variables/secrets |
| VAPID_PRIVATE_KEY | présent, valeur chiffrée | absent de la liste des variables/secrets |

Sources : paramètres et déploiements consultés en lecture dans le tableau Cloudflare connecté. Les versions identifient les déploiements, pas leur correspondance exacte à un commit : celle-ci n’a pas été prouvée. Aucun bouton Modifier/Supprimer/Enregistrer actionné. Les noms des secrets sont des métadonnées, jamais leurs valeurs.

- [Paramètres du site](https://dash.cloudflare.com/71e00d35a00589b9497b6f65022c02a4/workers/services/view/speedfood-app/production/settings)
- [Paramètres de l’API](https://dash.cloudflare.com/71e00d35a00589b9497b6f65022c02a4/workers/services/view/speedfood-api/production/settings)
- [Déploiements de l’API](https://dash.cloudflare.com/71e00d35a00589b9497b6f65022c02a4/workers/services/view/speedfood-api/production/deployments)

## Code local vérifié

L’API importe executerCreationCoeur du site, puis creerCommande et genererJetonSuivi ; pas de copie de cette règle dans sa route. La validation partagée conserve la même clé après trim. Le lanceur réutilise le même corps JSON en mémoire pour ses deux POST.

apps/web/src/lib/commande/jetons.ts dérive le jeton par HMAC-SHA256, préfixe speedfood-jeton-suivi-v1, base64url tronqué à 40 caractères. La clé est COMMANDE_JETON_SECRET si non vide, sinon SUPABASE_SERVICE_ROLE_KEY. Avec les mêmes entrées et la même version de cet algorithme, le jeton est identique. Deux jetons différents rendent donc suspectes des valeurs effectives différentes ou une différence de code déployé ; un secret présent dans la liste peut également être vide/inadapté. Ces possibilités ne sont pas départagées.

Le contrôle de process.env est compatible avec la date et les indicateurs visibles : la documentation Cloudflare indique son alimentation automatique par variables et secrets avec nodejs_compat à partir du 2025-04-01. Cela ne prouve pas les valeurs effectivement utilisées par les deux versions déployées.

Source : https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/

## Autre obstacle à la mise en service

Le code notifierRestaurant appelle Firebase puis le push web en meilleur effort. Sans configuration, ces chemins peuvent retourner sans envoyer de notification. L’API n’affiche ni FCM_SERVICE_ACCOUNT ni VAPID_PRIVATE_KEY dans sa configuration actuelle, contrairement au site. Le succès HTTP de création et l’absence d’erreur Worker ne prouvent donc pas la réception d’une alerte. Ni l’envoi ni la réception réels n’ont été contrôlés pendant ce diagnostic.

## Correction proposée, non exécutée

Préserver la valeur du site. Si Malika possède la valeur originale de COMMANDE_JETON_SECRET dans un stockage sûr, préparer son rétablissement à l’identique sur l’API seulement, avec saisie locale masquée par Malika, après feu vert distinct. Ne jamais coller cette valeur dans le chat ni la passer en argument.

Ne pas générer un nouveau secret pour les deux Workers : les clés QR de table et les empreintes de limitation utilisent aussi ce secret. Les anciens jetons de suivi stockés ne sont pas automatiquement effacés par une rotation, mais le rejeu des anciennes clés d’idempotence et les QR seraient affectés. Si l’original n’est pas disponible, préparer une stratégie écrite distincte à faire arbitrer, sans rotation improvisée.

Avant toute correction : définir la sauvegarde ou le retour arrière de la configuration API actuelle sans lecture de sa valeur par l’agent. Une restauration de version qui ne garantit pas la restauration des bindings ne doit pas être présentée comme un retour arrière certain. Ne pas toucher au site.

Après une correction autorisée : contrôle en lecture du suivi existant, puis nouvel essai borné uniquement sur feu vert distinct ; conserver le verrou de l’essai échoué et préparer un identifiant de nouvel essai séparé. La configuration et l’essai des alertes constituent un autre pas, également soumis aux autorisations de production applicables.

## Limites et contrôles de ce lot

Le premier onglet Cloudflare ne pouvait plus être piloté ; un nouvel onglet connecté a permis les lectures. Wrangler 4.142.0 a été vérifié depuis un dossier isolé sans fichier de secrets du projet ; secret list a échoué à code 1 faute de connexion CLI utilisable. Aucun jeton d’API demandé ni nouveau compte créé. Ce refus n’est pas une absence de secrets en production ; les constats ci-dessus viennent du navigateur.

Lot documentaire uniquement : aucun code métier ni migration modifié ; pas de suite fonctionnelle relancée. Vérification de mise en forme git diff --check requise avant commit. Aucun retour arrière de production nécessaire puisque aucune configuration n’a été modifiée.
