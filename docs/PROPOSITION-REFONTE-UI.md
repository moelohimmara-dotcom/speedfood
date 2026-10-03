# Proposition de refonte de l'interface Speedfood

**Version :** 1.0, 3 octobre 2026. **Statut :** proposition à décider par Malika, rien n'est appliqué.
**À lire avec :** `AUDIT-VISUEL-2026-10-03.md` (les défauts constatés), `cadrage/DESIGN-SYSTEM.md` (règles verrouillées) et la **page de comparaison** `design/directions-refonte.html` (maquettes des trois directions, à ouvrir dans un navigateur).

## 0. Méthode et ses limites

La démarche suit la méthode publiée dans le dépôt `oil-oil/oil-ui` (licence MIT), **lue comme document de référence, sans rien installer** : ancrer chaque direction dans le produit réel plutôt que dans un modèle par défaut, calibrer le ton sur cinq échelles, rendre les directions réellement différentes, concentrer l'effort sur un ou deux « moments mémorables », faire choisir par la propriétaire avant d'approfondir, puis vérifier aux vraies tailles d'écran.

Ce qui a été fait ici : audit de l'application réelle, lecture du design system et de l'étude concurrentielle du dépôt, regard sur l'accueil mobile de NelDaari (concurrent direct le plus proche), maquettes de comparaison avec les vrais textes. **Ce qui n'a pas été fait :** étude visuelle approfondie des autres concurrents (resto224, GuineaFood, Madifood) ni des références mondiales ; revue visuelle indépendante « à l'aveugle » par un second relecteur ; essai sur de vrais téléphones ; tests avec de vrais restaurateurs et clients (l'étude concurrentielle prévoit ces tests en semaine 1 du terrain). Les directions sont donc des **hypothèses de design**, pas des résultats prouvés.

## 1. Cahier des charges (les trois questions de départ)

**Quelle catégorie de produit ?** Portail web de découverte de restaurants et de commande directe au restaurant, à Conakry, sans compte ni application obligatoire. Le restaurant garde la relation commerciale (étude concurrentielle §7 et §8).

**Quelle tâche principale sur le premier écran ?**
- **Client** : trouver un plat réellement disponible, dans un restaurant ouvert, puis le commander en quelques gestes depuis un téléphone, souvent sur une connexion lente.
- **Restaurateur** : voir et traiter une commande, déclarer ce qui est disponible, ouvrir ou mettre en pause, d'une main, debout.

**Quelles références ?**
- **NelDaari** (vu le 3 octobre 2026, mobile) : accueil pensé comme une application (recherche d'abord, puces de catégories, carrousels « Populaires près de chez vous » avec grandes photos, logo en pastille sur la photo, étoile de note, minimum de commande, **barre de navigation en bas** : Accueil, Restos, Panier, Commandes, Compte). Accent rouge, typographie ronde géométrique.
- **resto224, GuineaFood, Madifood** : décrits dans l'étude concurrentielle (suite client + console, fil de découverte, livraison). Leur apparence réelle n'a pas été étudiée.

**Constat clé du benchmark :** les concurrents ouvrent sur un **écran d'application** (recherche et restaurants tout de suite). Speedfood ouvre sur une **page de lancement** marketing en plusieurs blocs ; la découverte n'apparaît qu'après un clic sur « Voir les restaurants ». Pour un pilote où l'on veut des commandes, c'est un frein.

## 2. Calibrage du ton (cinq échelles)

Évaluation de l'identité actuelle, à conserver ou à déplacer :

| Échelle | Aujourd'hui | Cible proposée | Pourquoi |
|---|---|---|---|
| Énergie (calme ↔ bruyant) | moyenne | moyenne, plus calme dans les consoles | Le rouge et l'orange servent l'action ; la console de travail doit rester calme (design system §2) |
| Finition (brut ↔ raffiné) | moyenne, inégale selon les écrans | **raffinée et régulière** | Le défaut principal de l'audit est l'inégalité entre écrans |
| Densité (aéré ↔ dense) | très aérée, parfois bavarde | aérée mais plus courte en texte | Trop de blocs d'explication avant les actions (commande, rappels) |
| Poids (léger ↔ lourd) | léger, titres lourds en condensé | inchangé | Les titres Barlow gras donnent l'identité |
| Ton (joueur ↔ solennel) | chaleureux | chaleureux et **sérieux sur l'argent et la fraîcheur** | Les prix et la disponibilité doivent inspirer confiance |

## 3. Les trois directions (fiches)

Les maquettes sont dans `design/directions-refonte.html`. Les trois partagent les mêmes couleurs et polices (verrouillées) ; elles se distinguent par le **squelette** et le **moment mémorable**.

### Direction A : « Carnet de table »
- **Phrase directrice :** un menu bien tenu, lisible d'un coup d'œil.
- **Squelette du premier écran :** en-tête avec quartier, recherche, puces de filtres, groupe « Disponible maintenant », cartes de restaurants en liste, **navigation en bas**.
- **Moment mémorable :** le **tampon de fraîcheur** : « Disponible · confirmé il y a 1 h » en vert, gros, sur chaque plat et chaque carte. C'est ce que les concurrents n'ont pas (étude §7, différence 5).
- **Contrôles :** boutons ronds, un seul bouton principal par écran (dégradé réservé à celui-ci).
- **Omissions assumées :** notes et étoiles, promotions, fil social.
- **Effort :** moyen. **Risque :** faible. **Dépend de :** rien.

### Direction B : « Marché en photos »
- **Phrase directrice :** je vois, j'ai faim, je commande.
- **Squelette :** carrousels horizontaux de plats, grande photo en tête de fiche, plats en **vignettes sur deux colonnes**, **barre de commande flottante** en bas.
- **Moment mémorable :** la **barre de panier qui se remplit** (quantité et total qui montent à chaque ajout, sans quitter la fiche).
- **Omissions assumées :** longues descriptions au premier plan.
- **Effort :** moyen à fort. **Risque :** moyen. **Dépend de :** de vraies photos de plats fournies par les restaurateurs ; sans elles les vignettes sont vides.

### Direction C : « Pass de cuisine » (console d'abord)
- **Phrase directrice :** une commande, un geste.
- **Squelette :** en tête, un **grand sélecteur Ouvert / En pause** ; puis une pile de **cartes de commande** avec une action principale de 56 px ; navigation basse (Commandes, Menu, Mon resto, Compte).
- **Moment mémorable :** le **sélecteur d'état géant**, confirmé par le serveur, visible de loin.
- **Omissions assumées :** statistiques, graphiques ; le QR code et le partage passent en second plan.
- **Effort :** moyen. **Risque :** moyen (ne change rien pour le client). **Dépend de :** rien.

### Vérification de la différence entre directions
La méthode demande que deux directions partagent **au plus un** facteur parmi squelette, police, couleur, visuel principal. **Ici, ce n'est pas respecté, à dessein :** police et couleurs sont verrouillées, donc identiques. La différence repose sur le squelette et le moment mémorable. Les trois ont des squelettes nettement différents (liste, carrousels et vignettes, pile de cartes d'action). Si Malika veut une vraie rupture d'identité, il faut **rouvrir le design system** (voir direction D).

### Direction D (non maquettée) : « Nouvelle identité »
Rouvre police et couleurs : par exemple fond sombre chaleureux, accent mangue, autre police de titre. À considérer seulement si Malika estime que l'identité actuelle ne convient pas. Coûts : tous les composants, un nouveau contrôle de contraste, une nouvelle revue d'accessibilité, et l'abandon d'un design system récemment verrouillé. **Non recommandée avant le pilote.**

## 4. Recommandation

1. **Base commune A** (cohérence, navigation en bas, tampon de fraîcheur) : corrige l'inégalité entre écrans relevée par l'audit et répond au constat sur les écrans d'ouverture des concurrents.
2. **C en premier dans le temps** : un restaurateur qui rate une commande fait perdre un client ; c'est aussi ce qui fait revenir un restaurateur.
3. **B ensuite**, seulement quand de vraies photos de plats existent (sinon ne pas la faire).

## 5. Plan de mise en œuvre par lots

Chaque lot : écran complet, vérification en mobile (375 px) et en largeur de bureau, tous les états (vide, chargement, erreur, rupture, « à confirmer »), contraste AA, cibles tactiles de 44 px au moins, focus clavier visible. Aucun lot ne touche aux règles métier.

| Lot | Contenu | Direction | Preuve attendue |
|---|---|---|---|
| R1 | Console des commandes et sélecteur d'état (cartes, action de 56 px, état fixe en tête) | C | Captures mobile, essai sur un compte de test, temps pour accepter une commande |
| R2 | Navigation basse commune (client et console), onglets non coupés, en-tête d'administration compact | A, C | Mobile 375 px, tablette, clavier |
| R3 | Accueil client = écran de découverte (la page de lancement devient une page d'information secondaire) | A | Parcours « arriver, trouver un plat, ajouter au panier » chronométré |
| R4 | Fiche restaurant : tampon de fraîcheur, lignes de menu sans bruit, partage discret | A | États : disponible, à confirmer, épuisé, panier non vide |
| R5 | Commande : cases et boutons radio stylés, un seul bloc d'information avant le bouton, consentement lisible | A | Test de remplissage mobile, accessibilité |
| R6 | Connexion et inscription : « mot de passe oublié », affichage du mot de passe | A | Parcours de récupération réel (nécessite l'envoi d'e-mails, à vérifier) |
| R7 | Photos : vignettes, carrousels, barre de panier flottante | B | Seulement avec de vraies photos |

Après R3 puis après R7 : **revue visuelle indépendante** par un relecteur qui ne connaît pas l'historique (méthode recommandée), avec constat des écarts.

## 6. Décisions à prendre par Malika

1. **Direction retenue** : A seule, A puis C (recommandé), tout, ou autre mélange ; ou rouvrir l'identité (D).
2. **La page de lancement** actuelle : la garder en page d'information, ou la supprimer au profit de la découverte ?
3. **Photos** : des photos de plats réelles seront-elles disponibles avant le pilote (condition de B) ?
4. **Ordre** : commencer par C (console) comme recommandé ?
5. **Tests** : accepter de montrer les écrans à 5 restaurateurs et 5 clients avant de figer (l'étude de terrain le prévoit) ?

## 7. Ce qui est déjà corrigé et ne dépend pas de cette décision

Voir `AUDIT-VISUEL-2026-10-03.md` §5 : chevauchement des prix, rappel de sécurité, ordre des blocs de la console, page Menu, liens de connexion (commit `aec7957`, pas encore déployé).
