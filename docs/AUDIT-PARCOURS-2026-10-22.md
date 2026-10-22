# Audit de parcours : comptes factices dans l'émulateur (22 octobre 2026, application 2.19.0)

## Méthode
- Émulateur Android 14 (Pixel 6). **Aucun compte ni aucune commande n'a été créé en production** : l'application de test (version « debug ») est reliée à un **faux serveur local** (`scripts/faux-serveur-application.mjs`) qui simule les comptes et les données ; seules les lectures publiques (restaurants, plats, quartiers) sont relayées en lecture seule vers la vraie base.
- Comptes factices (mot de passe quelconque) : `client@test.sf`, `resto@test.sf`, `livreur@test.sf`, `equipe@test.sf`, `multi@test.sf` (restaurateur + livreur).
- Parcours joués : lancement à froid, visite guidée, accueil, fiche restaurant, panier, commande **sans compte**, connexion, les trois espaces professionnels, déconnexion depuis un espace pro, reprise de l'espace au redémarrage, **session révoquée pendant que la personne reste dans l'application** (interrupteur `/__revoquer` du faux serveur).
- Limites : émulateur lent (démarrage à froid d'environ 20 s, à mesurer sur un vrai téléphone) ; non testés : Google, paiement, carte, appels, notifications reçues, hors ligne (testé lors de l'audit du matin).

## Ce qui fonctionne bien (à ne pas casser)
- Un client ordinaire ne voit **aucun** espace professionnel ; un compte restaurateur, livreur ou équipe voit seulement les siens (`/api/v1/moi`).
- Chaque espace pro a sa coque (barre du bas sombre, onglets propres, pas de flèche retour à la racine). Un compte multi-rôle change d'espace depuis Compte.
- L'espace pro est repris au redémarrage ; la déconnexion depuis un espace pro ramène au client, l'appareil est retiré du compte (`/appareils/retirer`).
- Tunnel de commande sans compte : le formulaire se remplit AVANT la connexion et il est conservé.

## Phase A livrée le 22 octobre 2026 (2.20.0)
Corrigés et vérifiés dans l'émulateur avec le faux serveur : **S1** (un 401 ferme la session proprement : bandeau « Votre session a expiré » avec « Me reconnecter », retour au client, rien d'effacé), **S2** (la déconnexion garde les commandes en cours ; case « Effacer aussi… »), **S3** (droits relus à la reprise et toutes les 10 min ; un 403 dans un espace relit les droits ; « Votre accès … a été retiré »), **S4** (connexion depuis « Espace professionnel » : espace ouvert directement, ou choix « Quel espace ouvrir ? » s'il y en a plusieurs ; espaces pro en tête de Compte), **S5** (message après déconnexion), **S7** (libellés), **O1** (visite guidée page 5). Tests natifs : `AccesSessionTest`.

## Phase B livrée le 22 octobre 2026 (2.21.0)
Corrigés : **S8** (suppression de compte dans l'application), **O1/O2** (visite en 3 écrans ; invitation aux notifications au moment du suivi), **S9** (verrou optionnel des espaces pro). Nouveau constat corrigé au passage : les clients ne recevaient aucune notification de commande sur Android 13+ faute d'autorisation demandée. Reportés : choix de localité, code SMS, profil de référence (voir la feuille de route).

## Constats, par gravité
**P0 : à corriger avant d'ouvrir au public**

| # | Constat | Preuve | Correction |
|---|---|---|---|
| S1 | **Session révoquée ou droit retiré : la console reste affichée avec « Connexion perdue : nouvelle tentative en cours », indéfiniment**, les boutons Accepter/Refuser restent actifs. Le code traite une réponse 401/403 comme une coupure réseau (`ErreurAcces` hérite de `ErreurReseau`). | capture « session révoquée » ; `RestaurateurViewModel` (`catch ErreurReseau`) | Un 401/403 sur un espace ferme la session ou l'espace, avec un message clair et un bouton « Me reconnecter » (voir machine d'états ci-dessous). |
| S2 | **Se déconnecter efface les commandes de l'appareil, y compris celles en cours** (`locales.oublier()`) : on perd le seul moyen de les suivre. | `CompteViewModel.deconnecter` | Ne jamais effacer les commandes en cours ; proposer « garder / effacer » ; rattacher les commandes au compte quand il existe. |
| S8 | **Pas de suppression de compte dans l'application** (exigée par Google Play et utile pour la confiance). | Aide : « Comment supprimer mon compte » renvoie au site | Écran Compte → « Supprimer mon compte » (confirmation, serveur, déconnexion). |

**P1 : forte valeur, à planifier tout de suite**

| # | Constat | Correction |
|---|---|---|
| S3 | Les droits ne sont relus qu'à un changement de session : un droit retiré n'est vu qu'au prochain démarrage. | Relire `/api/v1/moi` à la reprise de l'application et toutes les 10 minutes en espace pro. |
| S4 | Après connexion, un restaurateur/livreur/équipe **atterrit sur le Compte client**, l'entrée de son espace est sous la ligne de flottaison. | Si le compte a un seul espace pro : l'ouvrir directement (ou proposer « Ouvrir mon espace » en haut) ; plusieurs : écran « Choisir mon espace ». |
| O1 | Visite guidée, page 5 : « Choisissez le vôtre pour commencer » : faux depuis la 2.19.0 (plus de choix de rôle au lancement). | Remplacer par le message sur les espaces professionnels ; raccourcir à 3 écrans. |
| O2 | Aucune préparation des autorisations (position, notifications) avant la demande du système ; aucun choix de zone au premier lancement. | Écrans « pourquoi on demande » au moment utile (pas au lancement), choix de la localité avant la liste. |
| S6 | Connexion : pas de Google (interrupteur éteint), pas de téléphone ; compte obligatoire pour commander ; un invité ne retrouve pas sa commande hors de l'appareil. | Google (interrupteur), puis code SMS (décision de coût), suivi par téléphone + référence. |
| L1 | ~~Livreur : bouton « Me mettre hors ligne » affiché alors que hors ligne~~ **Retiré** : erreur de mon faux serveur (statut inventé `en_ligne`) ; l'application affiche correctement « Me mettre en ligne » / « Me mettre hors ligne » selon le statut réel. Reste : pas d'onglet gains/historique. | Onglets Courses · Gains · Compte. |
| C1 | Accueil nu : pas de bandeaux, cuisines, photos, ni temps/frais/note sur la carte ; jargon « Statut à confirmer (dernière confirmation il y a 19 jours) ». | Sections (Ouverts maintenant, Près de vous, Les mieux notés), pastilles de cuisine, photos, ETA et frais ; libellé « Disponibilité à vérifier ». |
| C2 | Fiche restaurant : pas de photos, pas de navigation par sections, pas de fiche plat (options, quantité), « À confirmer » sur chaque plat décourage la commande. | Fiche plat, stepper de quantité, reconfirmation des menus (outil livré en 2.17.0 ; reste le contenu). |
| C3 | Commande : pas de carnet d'adresses, pas de détail des frais ni de délai estimé, pas de note au restaurant, pas de commande programmée. | Voir feuille de route, phase C. |
| X2 | Les trois publics partagent une seule APK : la demande de position en arrière-plan et le service de surveillance du restaurateur exposent le client à un **refus de Google Play**. | Séparer en trois applications au moment du dépôt sur Play (phase E). |

**P2 : finition**

| # | Constat |
|---|---|
| S5 | Le message « Vous êtes déconnecté » est posé dans un écran qui n'existe plus : aucun retour visible. |
| S7 | « Compte client Speedfood » affiché pour un compte professionnel ; « Espace équipe speedfood » en minuscules (`titre.lowercase()`). |
| S9 | Pas de verrouillage biométrique/PIN pour les espaces pro (téléphones partagés en restaurant). |
| O3 | Une image vide s'affiche avant le logo animé au démarrage à froid (pas d'écran de démarrage système Android 12+) ; démarrage lent à mesurer sur un vrai téléphone (profil de référence à ajouter). |
| R1 | Console restaurateur : bouton « Mon menu » en double avec l'onglet Menu ; pas d'historique, de statistiques, d'horaires, ni de réglage du son. |
| E1 | Tableau équipe : mur de rouge, tout est « urgent » ; statuts « Acceptée » en rouge. Pas de hiérarchie de priorité. |
| X1 | Seule la barre du bas distingue un espace pro : ajouter une bande d'identité (nom de l'espace, du restaurant) en haut. |

## Comportement attendu quand on se déconnecte (ou perd sa session) en restant dans l'application
Machine d'états de la session, à implémenter telle quelle (phase A) :

| État | Déclencheur | Ce que voit la personne | Ce qui est conservé |
|---|---|---|---|
| **Invité** | premier lancement, ou déconnexion | l'espace Client complet (parcourir, panier, commander avec connexion au moment d'envoyer) | panier, commandes en cours (suivi), préférences d'appareil |
| **Client connecté** | connexion | Client + profil, adresses, favoris, avis ; si droits pro : « Mes espaces professionnels » | tout |
| **Espace pro actif** | entrée dans un espace | coque de l'espace ; reprise au redémarrage | espace choisi |
| **Session expirée** (jeton de renouvellement refusé) | 401 définitif | écran/feuille « Votre session a expiré. Reconnectez-vous » (garde l'écran, ne vide rien) ; en espace pro, retour au Client avec le même message | panier, commandes, brouillon de commande |
| **Droit retiré** (`/moi` ne contient plus l'espace) | relecture à la reprise ou toutes les 10 min | retour au Client, message « Votre accès à l'espace X a été retiré » | idem |
| **Déconnexion volontaire** | bouton | Client invité, message bref (« Vous êtes déconnecté ») | **commandes en cours conservées** ; on efface profil, adresses, favoris, jeton push ; « effacer aussi les commandes de cet appareil » en option |
| **Hors ligne** | pas de réseau | contenu en cache + bandeau ; **pas de déconnexion** ; actions pro désactivées avec le motif | file d'attente seulement pour les actions sans risque |
| **Compte supprimé** | suppression demandée | écran de confirmation, retour Invité | rien du compte |

Règles : (1) un 401/403 ne se confond jamais avec une coupure réseau ; (2) jamais de perte silencieuse de données (panier, commande en cours) ; (3) une action pro en échec montre pourquoi et ce qu'on peut faire ; (4) toute transition d'état est testée avec le faux serveur.

## Pratiques des applications à succès (à retenir)
- **Parcourir sans compte, compte au paiement** (Uber Eats, Glovo, Jumia Food) : déjà en place ; ajouter la connexion en un geste (Google, téléphone par code) car le mot de passe est le frein n°1 en mobile.
- **Une application par métier** : Uber Eats / Uber Eats Orders (restaurant) / Uber (chauffeur-livreur) ; Deliveroo / Hub restaurant / Rider ; Glovo / Glovo Courier. Raisons : autorisations sensibles (position en arrière-plan) isolées du public, rythme de mise à jour distinct, revue Play plus simple, vocabulaire et ergonomie propres (gros boutons, sons, mode « poste fixe » pour le restaurant).
- **Le client voit toujours où en est sa commande** (frise d'étapes, délai estimé, notification qui ouvre le bon écran, appel/message du livreur) ; la commande en cours survit à la déconnexion.
- **Confiance** : photos, notes, délai et frais avant de s'engager, prix total sans surprise, remboursement clair.
- **Rétention** : recommander en un geste, favoris, adresses, codes promo, parrainage, notifications utiles (pas de spam).
- **Pro** : le restaurateur veut un son fiable, un bouton « Je suis fermé / en pause », l'historique et les gains ; le livreur veut ses gains en direct, la navigation et le support ; l'équipe veut une file de tâches priorisées, pas un tableau de chiffres.

## Outil d'essai (reproductible)
1. `node scripts/faux-serveur-application.mjs` (port 8787).
2. Dans `mobile/speedfood.properties`, mettre `supabase.url` et `site.url` à `http://10.0.2.2:8787` (garder la clé publique), `./gradlew :androidApp:assembleDebug`, **remettre les vraies valeurs ensuite** (le fichier n'est pas versionné).
3. Installer l'APK « debug » dans l'émulateur. La version `debug` autorise le HTTP en clair (`mobile/androidApp/src/debug/AndroidManifest.xml`) ; l'APK publiée ne l'autorise pas.
4. Interrupteurs : `GET /__revoquer` (toutes les sessions deviennent invalides), `GET /__restaurer`.
