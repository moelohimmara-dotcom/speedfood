# Audit visuel et fonctionnel de l'application Android Speedfood (22 octobre 2026, APK 2.13.0)

## Complément : essai sur un vrai Android 14 émulé (même jour)
Un émulateur Android 14 avec les services Google (profil Pixel 6, 1080 × 2400) a été installé sur ce poste (SDK dans `C:\Users\moelo\.bubblewrap\android_sdk`, téléphone virtuel `speedfood_pixel`) et l'APK 2.13.0 de production y a été installée et parcourue avec les vraies données de production (lecture seule : aucune commande envoyée, aucun compte créé). Captures : `docs/audit-2026-10-22/emulateur/`.

**Constats réels (ils corrigent ou complètent la suite de ce rapport) :**
| # | Constat sur l'émulateur | Gravité |
|---|---|---|
| E1 | **Un seul restaurant est publié en production** (« barbie food », sans photo), avec 3 plats. Le catalogue est quasi vide : c'est le premier frein à l'adoption | Critique (contenu) |
| E2 | **Tous les plats affichent « À confirmer · dernière confirmation il y a 10 jours »** et le restaurant « statut à confirmer (19 jours) » : personne ne reconfirme, donc la plateforme a l'air abandonnée. Il faut le rappel de confirmation (lot L5) ou une règle moins punitive | Critique |
| E3 | **Pas de commande sans compte** : « Commander » mène à « Connectez-vous (ou créez un compte) pour envoyer votre commande ». Les documents du projet parlaient d'une commande invité ; l'application l'impose. Chaque étape de plus fait perdre des clients | Élevée |
| E4 | **Le panier est perdu quand l'application est redémarrée** (le badge « 1 » disparaît après relance) | Élevée. **Corrigé en 2.16.0** (vérifié sur l'émulateur : le panier survit à un redémarrage hors ligne) |
| E5 | **Aucun cache hors ligne** : au démarrage sans réseau, seul « Impossible de joindre Speedfood… » et un bouton « Réessayer » s'affichent, sans aucune donnée | Élevée. **Corrigé en 2.16.0** (vérifié sur l'émulateur : liste affichée avec « Hors ligne : liste enregistrée il y a 1 min ») |
| E6 | Connexion : pas de « Mot de passe oublié », pas d'œil pour afficher le mot de passe, pas de connexion par téléphone (la norme locale). Le bouton Google est présent et son message de repli (« Aucun compte Google n'est connecté… ») fonctionne ; la connexion Google complète n'a pas pu être essayée (il faut un compte Google réel sur l'émulateur) | Moyenne |
| E7 | Section de menu affichée « Autres plats » : les plats n'ont pas de section, l'en-tête n'apporte rien | Faible |
| E8 | Grande police (1,6×) : tout reste lisible, mais les horaires sont coupés (« 9h00–2… »), le champ de recherche passe sur deux lignes et la rangée de filtres déborde à droite | Faible |
| E9 | « 1 article(s) » : pluriel mal géré dans la barre de panier | Faible |
| **Bon point** | **Démarrage à froid d'environ 1 seconde, 61 Mo de mémoire, aucun plantage de l'application, clavier qui ne masque rien, barre de panier fixe et bouton « Commander » bien présents** | — |

**Correction de mon rapport précédent :** les lignes V10 (« panier sans bouton ») et « barre de panier fixe à ajouter » (C3) étaient FAUSSES : mes captures de test ne montraient pas la barre du bas. Sur l'émulateur, la barre « Voir mon panier · 1 article(s) · 25 000 GNF » et le bouton « Commander » existent. Ne pas en tenir compte.

## Méthode et limites (à lire d'abord)
- **Ce qui a été fait :** les 34 écrans de l'application ont été dessinés par le moteur de captures du projet (`mobile/shared/.../CapturesTest.kt`, vrai code Compose, 412 px de large comme un téléphone, densité 2), du lancement au suivi de commande, à la console restaurateur, au menu, à l'espace livreur et à l'espace équipe, puis relus. Variantes testées : police du système agrandie 1,5 fois. Planches de relecture : `docs/audit-2026-10-22/planche-A.png` à `planche-J.png`.
- **Limites restantes :** les captures du moteur utilisent des données d'exemple. L'émulateur n'a pas de compte Google (connexion Google non testée de bout en bout), pas de vraies notifications poussées, et les comptes restaurateur, livreur et équipe n'ont pas été essayés (ils demandent des identifiants). Un vrai téléphone sur le réseau mobile de Conakry reste nécessaire pour la fluidité réelle.
- Les écarts « sur site seulement » sont notés quand une fonction existe sur la plateforme web mais pas dans l'application.

## 1. Défauts visuels constatés
| # | Constat | État |
|---|---|---|
| V1 | Police agrandie (réglage d'accessibilité) : « WhatsApp » se coupait en « What / sApp » dans le poste de répartition | **Corrigé** (les boutons passent à la ligne ensemble) |
| V2 | Puces de filtre du support en violet par défaut, hors charte (la liste des restaurants utilise la mangue) | **Corrigé** |
| V3 | Titre d'une commande du support dans un style plus léger que partout ailleurs | **Corrigé** |
| V4 | Écran d'accueil : le premier écran après la visite demande « Qui êtes-vous ? » avec trois cartes. À 1,5 fois la police, la carte livreur sort de l'écran (défilement nécessaire pour voir tout) | À revoir (voir C1) |
| V5 | Boutons-textes (Appeler, Modifier, + Supplément, Ajouter une photo, Archiver) sans forme de bouton, alignés sur des lignes différentes : on ne voit pas qu'on peut appuyer | À faire (icônes + groupes cohérents) |
| V6 | Champs de saisie avec seulement un texte d'indication qui disparaît dès qu'on écrit (nom, téléphone, adresse) : pas d'étiquette permanente | À faire |
| V7 | Messages d'erreur du formulaire de commande affichés au milieu de la page, loin du champ fautif | À faire |
| V8 | Le détail « statut à confirmer (dernière confirmation il y a 2486 jours) » est bavard pour un client | À simplifier |
| V9 | Aucune photo dans les captures : les vignettes montrent une lettre. L'affichage des images existe (Coil), mais les restaurants et plats n'ont pas encore de photos en base | Contenu à produire |
| V10 | ~~Panier sans bouton de validation~~ | **Faux** : voir la correction en tête de rapport (barre et bouton présents) |
| V11 | Aucun thème sombre ; pas de squelettes de chargement (un simple cercle qui tourne) | À faire |

## 2. Parcours client : ce qu'il faut ajouter pour atteindre le niveau des applis pro
**C1. Entrée et premier lancement**
- Ouvrir directement sur les restaurants. Les espaces restaurateur, livreur et équipe passent dans un menu « Autres espaces » (aujourd'hui, un client voit trois cartes dont deux ne le concernent pas).
- Autorisations demandées au bon moment, avec une phrase d'explication (position pour les courses, notifications au premier ordre).

**C2. Découverte**
- Photos de couverture et logos, catégories de cuisine en puces, bandeau de promotions.
- Tri : distance, note, délai de livraison, frais. Frais de livraison et délai estimé directement sur chaque carte.
- Restaurants favoris, recherches récentes, carte avec les restaurants autour de soi.
- Filtre « ouvert maintenant » déjà présent ; ajouter « livre chez moi » selon le quartier.

**C3. Fiche restaurant et plats**
- Photo en tête, plats avec photos (dès que le restaurant en met), fiche détaillée d'un plat (suppléments à cocher, quantité, note pour la cuisine), allergènes.
- Partage d'un restaurant par WhatsApp (lien profond).

**C4. Panier et commande**
- Code promo, minimum de commande, ajout de boissons suggérées.
- Choix de l'adresse sur carte avec position GPS, adresses enregistrées (nom, repère), consigne pour le livreur.
- **Paiement dans l'application** : aujourd'hui « je règle directement le restaurant ». Ajouter Orange Money / Chap Chap Pay avec confirmation dans l'application (dépend du dossier KYC).
- Commande programmée (« pour 13 h »), numéro précédé de +224 et vérifié.

**C5. Suivi**
- Carte avec la position du livreur en direct et temps restant estimé.
- Boutons « Appeler le restaurant » et « Appeler le livreur », annulation tant que rien n'est accepté, partage du suivi.
- Notification poussée à chaque changement d'étape (la mécanique existe côté serveur ; il manque l'écran de réglage et l'ouverture directe de la bonne commande au toucher).
- Après livraison : note et avis, reçu téléchargeable.

**C6. Compte (aujourd'hui absent de l'application)**
- Écran Profil : nom, pseudo et avatar, téléphone, e-mail, adresses, favoris, historique avec filtres, préférences de notification, langue, suppression du compte, déconnexion visible, aide et contact, conditions et confidentialité, version de l'application.
- Ces fonctions existent déjà sur le site (espace client) : il faut les porter, pas les inventer.

## 3. Restaurateur
- Tableau du jour : chiffre d'affaires, nombre de commandes, plats les plus vendus, historique avec export.
- Horaires d'ouverture modifiables, pause temporaire avec durée (« 30 minutes »), fermeture exceptionnelle.
- Téléphones des clients appelables en un toucher, minuteur coloré selon l'attente d'une commande.
- Menu : réorganisation des sections, promos planifiées, duplication d'un plat, stock par plat. Les photos viennent d'être ajoutées (2.10.0).
- Alerte de nouvelle commande : sonnerie réglable, test au démarrage du service, explication quand l'économiseur de batterie du téléphone coupe l'application.

## 4. Livreur
- Navigation vers le restaurant puis le client (ouvrir Google Maps ou Waze avec l'adresse), carte de la course.
- Gains : total du jour et de la semaine, historique des courses, demande de versement.
- Preuve de remise (photo), signalement d'un incident (client injoignable, colis endommagé), contact de l'équipe.
- Comportement hors réseau : file d'attente des actions et message clair.

## 5. Équipe Speedfood
- **Fait :** répartition, support commandes, livraisons, livreurs. **Reste sur le site :** paiements, restaurants et menus, référencements, partenariats, liste d'attente, avis, comptes, contenu, design, paramètres, audit (voir `FEUILLE-DE-ROUTE-ADMIN.md`).
- Tableau de bord d'accueil de l'équipe (commandes à confirmer, courses sans livreur, établissements sans numéro) avec compteurs.
- Au toucher d'une notification « commande à confirmer », ouvrir directement le poste de répartition.
- Verrou biométrique à l'ouverture de l'espace équipe (données de clients).

## 4. Transversal : ce qui fait la différence entre « fonctionne » et « pro »
| Domaine | Manque constaté |
|---|---|
| Accessibilité | Peu de descriptions pour lecteur d'écran (17 repères dans tout le code, aucun libellé d'état), cibles tactiles à vérifier (48 dp), contrastes à relire sur les textes secondaires |
| Hors ligne | Aucun cache des restaurants et menus ; en cas de coupure, écran d'erreur au lieu des dernières données avec un bandeau « hors ligne » |
| Liens profonds | Aucun lien profond : un lien WhatsApp vers un restaurant ou un suivi n'ouvre pas l'application |
| Mesure | Seulement les rapports de plantage (Crashlytics). Aucune mesure de parcours (ouverture → commande) pour savoir où les gens abandonnent |
| Langues | Français seulement ; prévoir l'anglais, et un vocabulaire local pour les noms de plats |
| Fluidité | Squelettes de chargement, tirer pour actualiser, retours de vibration, transitions entre écrans |
| Mises à jour | Dépend de la page `/installer` ; publier sur Google Play (compte payant, décision de Malika) apporte les mises à jour automatiques et supprime l'avertissement « source inconnue » |
| Confiance | Page « À propos », numéro de support, conditions et confidentialité accessibles depuis l'application, version affichée |
| Tablettes et orientation | Mises en page prévues seulement pour téléphone portrait |
| Performance | APK de 14 Mo (correct) ; démarrage et défilement à mesurer sur un téléphone d'entrée de gamme (cible de la clientèle) |

## 5. Priorités proposées
**P0, avant d'ouvrir à de vrais clients :** remplir le catalogue (restaurants, photos, plats confirmés : E1, E2) ; commande sans compte ou compte en deux gestes (E3) ; panier conservé après redémarrage (E4) ; cache hors ligne (E5) ; test sur téléphone réel de tout le parcours ; ouvrir sur les restaurants (C1) ; compte et profil (C6) ; suivi avec appel du restaurant et du livreur (C5) ; mode hors ligne minimal ; liens profonds ; étiquettes de champs et erreurs au bon endroit (V6, V7).
**P1 :** paiement dans l'application (C4), carte et position du livreur (C5, section 4), photos des restaurants et des plats (contenu), tableau du jour restaurateur, navigation du livreur, gains du livreur, poursuite de la parité équipe.
**P2 :** thème sombre, langues, tablettes, mesures de parcours, publication sur Google Play, tri et favoris avancés, codes promo.

## 6. Prochaine étape recommandée
1. Installer un vrai téléphone de test (ou valider le téléchargement d'un émulateur) et refaire cet audit avec les gestes, le clavier et le réseau.
2. Lancer un premier lot « application client pro » : accueil direct, profil, barre de panier, suivi avec appels, hors ligne minimal, liens profonds.
