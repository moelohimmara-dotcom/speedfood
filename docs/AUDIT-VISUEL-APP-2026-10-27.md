# Audit visuel de l'application mobile (27 octobre 2026, APK 2.43.0)

## Méthode et limites (à lire d'abord)
- **Ce qui a été joué** : build debug 2.43.0 dans l'émulateur Android 14 (Pixel 6), relié au faux serveur local `scripts/faux-serveur-application.mjs` (lecture seule vers la vraie base pour le catalogue ; aucun compte ni donnée écrits en production). Parcours joués : choix de profil, visite guidée, accueil, fiche restaurant, panier, commande (erreurs puis envoi), suivi, espace client (profil, adresses, favoris, avis, paramètres, aide), déconnexion, accès professionnel, espace restaurateur (commandes, menu, activité, horaires, compte), espace livreur (courses, gains, compte), espace équipe (tableau, répartition, menus à reconfirmer, avis, paiements, référencements), session révoquée, démarrage hors ligne, grande police (1,6×).
- **Ce que le faux serveur fausse** : les montants et références de la commande envoyée (30 000 au lieu de 40 000) ; l'historique restaurateur (route absente du faux serveur : l'erreur affichée est un artefact) ; l'absence du bouton Google ; le formulaire de connexion sans e-mail (volontaire en mode local, voir `ConnexionScreen.kt:177`). **Ce ne sont pas des défauts de l'application.**
- **Non audité visuellement dans cette passe** (mon pilote de test a échoué sur ces écrans, pas l'application) : modules équipe Restaurants, Partenariats, Liste d'attente, Comptes utilisateurs, Bannières, Médias ; candidature restaurateur et menu par photo (joués lors des lots R2 à R5, pas rejoués ici) ; compte client réel (impossible en mode local) ; connexion Google/Facebook ; notifications push ; liens profonds ; mode sombre (n'existe pas).
- Les chiffres de dette technique viennent d'une analyse statique du code (`mobile/`).

## 1. Ce qui marche bien (observé)
| Zone | Constat |
|---|---|
| Entrée | Logo animé, écran de choix clair, visite en 2 écrans sautable, reprise directe de l'espace pro à la réouverture |
| Commande | Validation lisible (nom, téléphone, case de consentement), message d'erreur placé juste au-dessus du bouton, champ fautif entouré de rouge, panier conservé à travers la connexion, barre « Voir mon panier » fixe |
| Session | Session révoquée : retour à l'accueil client avec « Votre session a expiré… Me reconnecter » ; déconnexion avec dialogue clair (commandes en cours et panier conservés) et message de retour |
| Hors ligne | Démarrage à froid sans réseau : la liste des restaurants s'affiche depuis le cache |
| Restaurateur | Console de commandes complète (accepter, refuser, proposer un changement, prête, annuler), menu avec confirmation par plat, activité du jour et de 7 jours |
| Équipe | Répartition (appel/WhatsApp du restaurant), modération des avis avec motif obligatoire, paiements en lecture seule avec avertissement « valeurs de simulation » |
| Compte | Écran complet : profil, adresses, favoris, avis, paramètres, aide, déconnexion, suppression de compte |
| Stabilité | Aucun plantage (`AndroidRuntime` vide) sur tout le parcours |

## 2. Ce qui semble marcher mais ne marche pas vraiment
| # | Constat | Gravité |
|---|---|---|
| A1 | **Corrigé le 27/10 (non publié).** **Profil « restaurateur » périmé après une session expirée.** Le profil choisi reste mémorisé (il n'est effacé qu'à la déconnexion volontaire, `ProfilEntree.kt:3`). Reproduit : un compte équipe dont la session est révoquée, après être passé par « Je suis restaurateur », rouvre l'application sur « Créer mon compte pour inscrire votre restaurant », **sans lien vers les restaurants** (seule la flèche retour, qui quitte l'application). La personne est piégée. | **Élevée** |
| A2 | **Corrigé le 27/10 (non publié) : toute la ligne se coche, cible de 48 dp.** **Case de consentement de la commande** : seule la case de 24 dp réagit, pas le texte. Taper sur la phrase (réflexe) ne coche rien et l'erreur « Cochez la case » apparaît. Même motif ailleurs (`CommandeScreen.kt:220`, aussi `RestaurantScreen.kt:185`, `CandidatureScreen.kt:232`, `EspacesScreens.kt:195`). | Moyenne |
| A3 | **Corrigé le 27/10 (non publié).** **Favoris** : le message vide dit « Ajoutez un restaurant à vos favoris depuis sa fiche **sur le site** » alors que le cœur existe dans la fiche de l'application (`EspaceClientScreens.kt:229`). | Faible |
| A4 | **Référencements dans l'application (équipe)** : l'écran ne connaît que les demandes du site (statuts Rappelée / Visite prévue / Accord signé / Refusée) et renvoie « sur le site » pour créer la fiche. **Les candidatures déposées depuis l'application, avec dossier, motif de refus et rattachement du compte (lots R3/R4), ne se traitent que sur la page web.** Un membre d'équipe qui n'a que son téléphone ne peut pas tenir la promesse des 48 h. | Élevée (fonctionnel) |
| A5 | **Message d'erreur trompeur** : une réponse 404 ou 500 du serveur s'affiche « Impossible de joindre Speedfood. Vérifiez votre connexion » (vu sur l'historique restaurateur). La connexion n'est pas en cause. | Moyenne |
| A6 | **Livreur : pièce d'identité uniquement sur le site.** L'application dit « Déposez la pièce sur le site Speedfood (page Devenir livreur) ». Pour un livreur mobile, c'est un cul-de-sac ; « Je suis livreur » (accès pro) ouvre l'aide générique, pas une vraie page. | Moyenne |
| A7 | **Statut du livreur en rouge** : l'interrupteur « En ligne » est rouge, alors que « Ouvert » du restaurateur est vert. Le rouge signifie partout ailleurs « danger ». | Faible |

**Correctif complémentaire, boutons « retour » inactifs (27/10, non publié) :** sur un écran de départ (accès professionnel, candidature, lien reçu), la flèche retirait le dernier écran au lieu de rediriger : page blanche ou bouton qui semble mort. Un seul helper `retour()` (`App.kt`) envoie désormais à la liste des restaurants quand il n'y a rien avant ; 26 écrans l'utilisent. La création de compte restaurateur offre aussi « Voir d'abord les restaurants ». Vérifié dans l'émulateur.

## 3. À améliorer (ergonomie et visuel)
| # | Constat |
|---|---|
| B1 | **25 boîtes de dialogue** (`AlertDialog`) sans `containerColor` : fond lavande par défaut de Material, hors de la charte crème/mangue (vu sur « Se déconnecter » et « Être alerté application fermée »). Un seul réglage global dans le thème règle les 25. |
| B2 | **Fenêtre « Être alerté application fermée ? »** : un bloc de texte de huit lignes avant les boutons. À découper (3 puces) et à placer avant les deux choix. |
| B3 | **Icônes de navigation incohérentes** : « Activité » (restaurateur) et « Gains » (livreur) utilisent le « i » d'information ; « Je suis livreur » utilise une cloche ; « Espace professionnel » et « Confidentialité » partagent le même cadenas. |
| B4 | **Boutons-textes** (Modifier, + Supplément, Ajouter une photo, Archiver ce plat, Retirer) sans forme de bouton, alignés sur des lignes différentes : constat V5 de l'audit du 22 octobre, **toujours présent**. « Retirer » (une option) est rouge comme « Archiver ce plat » (le plat entier) : risque de confusion. |
| B5 | **Section « Autres plats »** toujours affichée quand les plats n'ont pas de section (E7, non corrigé) ; « 1 article(s) » (E9, non corrigé). |
| B6 | **Fiche plat absente** : pas de recherche dans le menu, pas de détail ni d'options (prévus en phase C). Pas de photos (contenu à produire). |
| B7 | **Suivi de commande** : pas de numéro du restaurant à appeler, pas de délai estimé, pas d'annulation. La liste « Mes commandes » ne montre ni statut ni badge, seulement montant et « à l'instant ». « Mes commandes » existe deux fois (onglet et Compte). |
| B8 | **Tableau équipe** : les six tuiles « À traiter » sont toutes rouges même pour « 1 », donc rien ne se distingue (fatigue d'alerte) ; chaque module porte « Dans l'application » ou « Sur le site » : le texte répété est du bruit, une pastille « Sur le site » seule suffirait. |
| B9 | **Console livreur** : deux avertissements (pièce manquante, position) passent avant la course en cours, qui est sous la ligne de flottaison. La course active doit venir en premier. |
| B10 | **Dates brutes** « 2026-10-27 02:34 » (activité restaurateur, gains livreur, avis, paiements) au lieu de « aujourd'hui 02:34 ». Horaires saisis comme texte « 11:00 » plutôt qu'avec un sélecteur d'heure. |
| B11 | **Grande police (1,6×)** : le libellé « Commandes » de la barre du bas se coupe au milieu du mot (« Command / es »), la rangée de filtres sort de l'écran, les horaires sont tronqués (« 9h00–22… »). |
| B12 | **Écran de commande** : titre « Restaurants » en haut mais onglet « Accueil » en bas (deux noms pour la même chose). |
| B13 | **Actions destructrices proches de l'action principale** (Prête / Annuler, Confirmée / Annuler dans la répartition ; « Annuler la note » dans les avis) : à vérifier qu'une confirmation est demandée. |

## 4. Dette technique (analyse statique du code mobile)
| # | Constat | Effet |
|---|---|---|
| D1 | `isMinifyEnabled = false` en release (`androidApp/build.gradle.kts:84`) : APK de 14,6 Mo non réduite, non obfusquée | Téléchargement plus lourd (3G) et code lisible par décompilation. À activer avec règles R8 et un essai complet |
| D2 | **Aucun test d'interface Compose** (0 fichier) ; 47 fichiers de tests, tous sur les règles pures et les API | Les défauts A1, A2, B1, B11 ci-dessus n'auraient pas été attrapés. Le seul garde-fou visuel est l'audit à la main |
| D3 | **53 `catch` silencieux** (Auth 4, GoogleAndroid 4, SurveillanceCommandes 3, LivreurViewModel 3, FirebaseSpeedfood 3…) | Des échecs disparaissent sans trace : à journaliser ou à faire remonter, au moins pour l'authentification et la surveillance des commandes |
| D4 | **504 textes français écrits en dur** dans le code, 1 seule chaîne dans `strings.xml` | Aucune traduction possible (anglais, pular, soussou) sans reprise complète ; correctifs de texte = nouvelle version |
| D5 | **Accessibilité** : 11 `contentDescription = null`, 18 descriptions renseignées pour 504 textes ; 1 seule cible tactile dimensionnée (`48.dp`) | Lecteur d'écran (TalkBack) partiellement muet ; cibles de 24 dp (cases) trop petites |
| D6 | `ConnexionScreen.kt:177-187` : bloc `if (modeLocal …)` mal indenté, accolades décalées (le code compile mais se lit mal et a trompé ma lecture) | Risque de modification erronée ; à reformater |
| D7 | Fichiers volumineux : `Equipe.kt` 533 lignes, `App.kt` 527 (navigation de toute l'application) | `App.kt` concentre phases, routes et état d'entrée : à découper avant d'y ajouter la suite |
| D8 | Le faux serveur ne couvre pas toutes les routes (historique restaurateur absent) | Un écran réel reste « non vérifié » ; compléter le faux serveur à chaque nouvelle route |
| D9 | Aucun thème sombre, aucun squelette de chargement (V11 du 22 octobre) | Confort de nuit et perception de vitesse |

## 5. Ordre de correction proposé
1. **A1** (profil périmé : effacer le profil à toute perte de session, et toujours offrir « Voir les restaurants »), **A2** (zone tactile de la case), **A5** (distinguer erreur serveur et réseau) : correctifs courts, à livrer ensemble.
2. **B1** (thème global des dialogues), **B3** (icônes), **B4** (boutons de la carte de plat), **B11** (libellé de la barre) : un lot « finitions » sans risque.
3. **A4** (traiter les candidatures dans l'application côté équipe) : le vrai chaînon manquant de la promesse « réponse sous 48 h ».
4. **D1** (R8) et **D2** (premiers tests Compose sur commande et connexion) : stabilité à long terme.
5. **A6**, **B6**, **B7** : fonctionnalités de la phase C et D (fiche plat, suivi enrichi, documents livreur dans l'application).

Rien n'a été modifié dans le code, la base ni la production par cet audit. Le fichier `mobile/speedfood.properties` a été remis à l'identique (la compilation de debug a changé temporairement ses adresses).
