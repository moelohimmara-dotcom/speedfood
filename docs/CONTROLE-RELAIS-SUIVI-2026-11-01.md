# Contrôle initial après activation du suivi — 1er novembre 2026

## Périmètre et preuve

Lecture directe du tableau Cloudflare dans le navigateur intégré, compte déjà connecté par Malika. Relevé vers **10 h 37 GMT**, période fixée dans les deux écrans au **1er novembre 2026, de 10 h 05 à 10 h 35 GMT** (heure de Conakry). Filtre : toutes les versions déployées. Aucun secret, réglage, code ou abonnement modifié pendant cette consultation.

Cette fenêtre comprend une partie avant l'activation et une partie après. Le site affiche la version active `41a9b4b7`, à 100 % du trafic ; l'API affiche `8a77448b`, à 100 %. La version du site précédemment active `fd173a5c` apparaît aussi dans la fenêtre.

| Indicateur affiché | Site `speedfood-app` | API `speedfood-api` |
|---|---:|---:|
| Invocations | 326 | 6 |
| Sous-requêtes | 938 | 14 |
| Erreurs d'exécution | 0 | 0 |
| Limites de temps processeur dépassées | 0 | 0 |
| Mémoire dépassée | 0 | 0 |
| Tuile « Temps processeur » | 17 ms | 4 ms |
| Tuile « Temps réel écoulé » | 233 ms | 6 ms |
| Tuile « Durée de requête » | 163 ms | 6 ms |
| Temps CPU médian affiché pour la version active | 38,68 ms | 6,1 ms |

Les tuiles de synthèse et les lignes de version ont des libellés distincts : leurs valeurs sont reproduites telles qu'affichées, sans supposer qu'elles calculent le même agrégat. Ce sont des mesures globales du Worker, pas le coût de `POST /commandes` ni celui du seul suivi. Le forfait et ses limites effectives n'ont pas été relus.

Dans le graphique des invocations du site : **199** pour `41a9b4b7` et **127** pour `fd173a5c`. Les erreurs par version sont à **0** pour chacune. Les graphiques n'affichent aucune déconnexion client dans la fenêtre.

## Appels entre le site et l'API

Le tableau des sous-requêtes du site montre la destination `speedfood-api.moelohimmara.workers.dev` : **2 réponses 2xx et 1 réponse 4xx**, durée affichée **42,9 ms**. C'est une preuve d'appels inter-Workers sur cette période, pas une attribution de chaque appel à `POST /suivi`. La réponse 4xx n'est pas une erreur d'exécution du Worker ; sa cause précise n'a pas été vérifiée.

Les autres sous-requêtes du site affichées vont vers Supabase : **935 réponses 2xx**. Côté API : Supabase **12 réponses 2xx** et Upstash **2 réponses 2xx**. Le quota quotidien restant n'est pas déduit de ces nombres.

Sources consultées :

- [Mesures du site](https://dash.cloudflare.com/71e00d35a00589b9497b6f65022c02a4/workers/services/view/speedfood-app/production/metrics).
- [Mesures de l'API](https://dash.cloudflare.com/71e00d35a00589b9497b6f65022c02a4/workers/services/view/speedfood-api/production/metrics).

Les liens ouvrent un tableau vivant : sélectionner la période ci-dessus pour rapprocher les valeurs du relevé. Aucune lecture de journaux bruts ni de corps contenant des jetons.

## Conclusion limitée à cet essai

- Réglage appliqué par Malika : `API_RELAIS=public,moi,client,livraison,suivi`, module `commandes` exclu.
- Comparaison du vrai suivi SF-G8V6H après activation, résultat transmis par Malika : site HTTP 200, API HTTP 200, **0 écart**, **code de sortie 0**.
- Observation initiale Cloudflare effectuée : **aucune erreur d'exécution ni dépassement CPU affiché dans cette fenêtre**. Pas de raison constatée ici d'exécuter un retour arrière.
- **Limites** : seulement six invocations API, trafic non contrôlé et fenêtre qui chevauche l'activation. Aucun essai de charge, aucune mesure isolée de création de commande, aucune preuve du trajet de chaque lecture (le repli sur le site reste possible). Les écritures d'annulation et de proposition n'ont pas été testées par cette consultation.

## Suite avant l'activation de `commandes`

Préparer l'essai d'idempotence croisée : une commande d'essai, même clé d'idempotence envoyée au site puis à l'API, seconde réponse HTTP 200 avec `idempotent: true` et même jeton, sans afficher ce jeton. L'action réelle exige son feu vert distinct ; le principe accepté antérieurement ne vaut pas activation de tout le module. Prévoir aussi la mesure CPU de cette création et la vérification de l'alerte restaurateur. Ne pas conclure à l'égalité des secrets à partir des seules lectures du suivi.

Retour arrière, uniquement sur autorisation explicite et saisi par Malika : retirer `suivi` pour retrouver `public,moi,client,livraison`, ou `non` pour arrêter tous les relais. Aucun retour arrière exécuté pendant ce contrôle.
