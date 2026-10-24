# Parcours de premier lancement — application Speedfood

Cadrage du lot **C0** de la phase C (voir `docs/FEUILLE-DE-ROUTE-APPLICATION.md`).
Établi le 24 octobre 2026, après avoir joué le parcours réel dans l'émulateur.

## 1. Le point de départ

Aujourd'hui, un clic sur l'icône de l'application donne :

1. écran de démarrage (logo, fond crème, pas d'éclair blanc) ;
2. visite guidée de 3 écrans (« Les restaurants près de chez vous » → « Commandez, puis suivez »
   → « Chacun son espace »), skippable ;
3. **liste des restaurants, sans authentification**.

Deux décisions sont **bonnes et à conserver** : le client voit la cuisine avant de créer un compte
(modèle Uber Eats / DoorDash : on parcourt d'abord, on s'inscrit au moment de commander), et il ne
choisit pas de rôle (le restaurateur ou le livreur ouvre son espace depuis « Compte »).

Trois frictions ont été constatées :

- **La promesse de l'écran 1/3 n'est pas tenue.** « Les restaurants près de chez vous » annonce une
  liste de restaurants proches, alors qu'aucune localisation n'est demandée et qu'il n'existe pour
  l'instant qu'un seul établissement, affiché avec la mention « Statut à confirmer (dernière
  confirmation il y a 20 jours) ». L'honnêteté de la mention est bonne ; la promesse non tenue, non.
- **Le démarrage bloque sur le réseau.** Android Vitals vise un démarrage à froid sous la seconde,
  avec un écran de démarrage qui *transitionne* vers le contenu au lieu de bloquer sur un logo. Sur
  un réseau instable, le premier écran doit s'afficher depuis un cache local.
- **Le lien profond n'est pas exploité.** Le site a déjà des liens par restaurant (`/r/…`) et par
  plat (`/p/…`). Un lien reçu sur WhatsApp doit ouvrir le bon écran dans l'application, sans
  repasser par la visite guidée. En Guinée, c'est probablement le premier canal d'acquisition réel.

## 2. Le parcours cible

| # | Étape | Règle | Sortie |
|---|---|---|---|
| 1 | **Démarrage** | La liste s'affiche depuis le cache local en moins d'une seconde. Jamais d'écran bloqué, jamais d'attente réseau. | liste des restaurants |
| 2 | **Lien profond** | Si l'application est ouverte par un lien de restaurant ou de plat, on **saute la visite guidée** et on ouvre la fiche. | fiche restaurant ou plat |
| 3 | **Visite guidée** | Ramenée à **2 écrans** : la promesse, puis le choix de zone. Toujours skippable, toujours visible. | liste filtrée par zone |
| 4 | **Zone de livraison** | Une zone est choisie par défaut (la plus probable), modifiable en un geste. La position n'est demandée **que** si l'utilisateur choisit « près de moi ». | liste par zone |
| 5 | **Navigation sans compte** | Parcourir, lire une fiche, remplir le panier : tout est possible sans compte. Le panier est **conservé hors ligne**. | panier |
| 6 | **Création du compte** | Au moment de commander, en **un seul écran** : Google d'abord, puis téléphone. Pas de parcours d'inscription en plusieurs étapes. | commande passée |
| 7 | **Suivi** | La commande revient par notification ; le suivi en un geste, avec la frise d'étapes. | commande livrée |
| 8 | **Retour dans l'application** | Un lien WhatsApp vers la commande existante ouvre le suivi directement. | suivi |

## 3. Permissions : jamais au lancement

| Permission | Quand | Pourquoi |
|---|---|---|
| Notifications | **Au moment du suivi de commande**, avec l'invitation déjà écrite dans l'application (« activer le suivi de commande »). | C'est le moment où elle sert : sans elle, Android 13+ ne montre aucune notification de commande. Déjà fait. |
| Position | **Sur action explicite** (« près de chez moi »), jamais au premier lancement. | La localisation n'est pas nécessaire pour commander dans une zone choisie. |
| Photo / caméra | Au moment de l'action (photo de plat, preuve de livraison). | — |
| Biométrie / code | À l'activation du verrouillage d'espace professionnel, jamais par défaut. | Déjà fait (Paramètres → Sécurité). |

Règle : **une permission demandée au lancement est une permission refusée**. La règle
d'or de l'Android : la permission se demande au moment où l'utilisateur vient d'expérience le
bénéfice.

## 4. Le cas « le contenu n'est pas prêt »

Quand la liste est vide ou que les plats d'un établissement sont périmés, l'écran ne montre **jamais**
une page vide ni une promesse non tenue. Il montre un état qui explique et propose :

- **Aucun établissement dans la zone** → proposer de changer de zone, et annoncer les prochaines
  zones ouvertes, si l'information existe.
- **Établissement sans plats confirmés** → l'état « Statut à confirmer » est conservé tel quel (c'est
  un signal de confiance utile), mais accompagné d'une action : « Voir le plat du jour » ou
  « Demander une confirmation ».

Lien direct avec l'autre côté de la plateforme : l'application restaurateur (lot
`app-restaurateur`) permet de **reconfirmer son menu en quelques secondes**. C'est ce qui fera
passer la mention « dernière confirmation il y a 20 jours » à « confirmée il y a 2 h ». Les deux
lots doivent donc produire des messages **compatibles** : le même vocabulaire de fraîcheur
(partagé par une règle pure côté serveur, pas dupliqué côté client).

## 5. Le compte, au bon moment

- Aucun compte pour parcourir, lire une fiche, remplir le panier.
- Compte créé **au moment de commander**, en un écran.
- Le panier survit à la création du compte (le panier est local, il est rattaché au compte à la
  commande — **aucune perte silencieuse**).
- Connexion par Google déjà branchée. Connexion par téléphone : le fournisseur de code SMS n'est pas
  choisi ; en attendant, le lot ne l'implémente pas et n'affiche pas d'entrée de connexion par
  téléphone qui ne fonctionne pas. **Recommandation à trancher** : au lieu d'un SMS payant, un code
  par WhatsApp ou un appel vocal — moins cher, plus rapide, et le numéro WhatsApp est déjà
  l'identité sociale usuelle. Trancher avant d'afficher une entrée de connexion.

## 6. Liens profonds et acquisition

- Les liens de restaurant et de plat du site doivent ouvrir l'application installée (Android App
  Links) et, à défaut, le site. Le partage d'un restaurant sur WhatsApp devient ainsi un canal
  d'acquisition direct.
- Un lien vers une commande ouvre le suivi de cette commande.
- Le lien de sortie de l'application est toujours présent (« Retour au site ») : l'application ne
  doit jamais devenir un cul-de-sac pour quelqu'un qui veut juste regarder.

## 7. Hors ligne et robustesse

- La liste des restaurants et les fiches sont **mises en cache** au premier chargement réussi, puis
  rafraîchies en arrière-plan. Un démarrage hors réseau doit afficher la dernière version connue,
  datée, jamais un écran vide.
- Le panier est local et ne se perd pas (règle déjà appliquée par le projet).
- Toute action impossible affiche **pourquoi** et **quoi faire**, et propose « réessayer ».

## 8. Critères d'acceptation

Le lot est livré quand, **joué dans l'émulateur** :

1. un démarrage à froid affiche la liste sans attendre le réseau (mesuré, pas supposé) ;
2. un lien profond de restaurant ouvre la fiche **sans** visite guidée ;
3. la visite guidée tient en 2 écrans, se passe, et mène à une liste filtrée par zone ;
4. changer de zone se fait en un geste, sans quitter l'écran ;
5. aucune permission n'est demandée avant que l'utilisateur en ait besoin ;
6. un panier rempli hors ligne survit au redémarrage de l'application et à la création du compte ;
7. la création du compte tient en un écran et la commande part ;
8. la liste vide et l'établissement périmé affichent un état utile, jamais une page vide ;
9. la mention de fraîcheur client et celle du restaurateur disent la même chose.

Chaque point a un test (natif pour l'état, l'audit émulateur pour le parcours) et une capture.

## 9. Périmètre du lot

Le lot est réalisé par l'agent `app-decouverte` (phase C), qui possède déjà l'accueil, la fiche
restaurant, la fiche plat et le suivi. Le cadrage s'y ajoute.

Fichiers probablement concernés :

- `mobile/shared/src/commonMain/kotlin/com/speedfood/app/ui/Accueil*.kt` (zone, état vide, filtres),
- `mobile/shared/src/commonMain/kotlin/com/speedfood/app/ui/Onboarding*.kt` (visite guidée en 2 écrans),
- `mobile/shared/src/commonMain/kotlin/com/speedfood/app/data/Client*.kt` (cache local de la liste),
- `mobile/shared/src/commonMain/kotlin/com/speedfood/app/data/Zone*.kt` (modèle de zone, si nouveau),
- `mobile/shared/src/commonTest/kotlin/com/speedfood/app/…` (tests du parcours),
- `scripts/faux-serveur-client-decouverte.mjs` (zones, restaurants d'essai).

**Réservés à l'orchestrateur** (l'agent fournit la ligne exacte dans sa note d'intégration) :
`mobile/shared/.../App.kt` (routage du lien profond), `mobile/shared/.../di/Koin.kt`,
`mobile/androidApp/src/main/AndroidManifest.xml` (App Links), `mobile/shared/.../EspacePro.kt`,
`src/lib/application/version.ts`, `mobile/androidApp/build.gradle.kts`, `public/speedfood.apk*`,
`scripts/tests/lancer.mjs`, `docs/**`, `package.json`.

## 10. Hors périmètre

- Le fournisseur de code SMS (décision en attente) : le lot n'affiche aucune entrée de connexion
  par téléphone non fonctionnelle.
- Le paiement mobile (dossier Chap Chap Pay) : la commande est Jouée jusqu'à l'envoi, le
  branchement du paiement reste ailleurs.
- La publication sur Google Play et le découpage en trois applications (phase E).
