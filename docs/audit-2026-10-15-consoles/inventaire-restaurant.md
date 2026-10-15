# Inventaire de la console restaurateur (lecture seule)

Dépôt : `C:\Users\moelo\dev\speedfood` (Next.js 16, App Router). Aucun fichier du dépôt modifié. Les chemins ci-dessous sont relatifs à `src/`.

## 1. Carte des routes

Le dossier `(console)` est un groupe de routes : il n'apparaît pas dans l'URL. Le proxy (`src/proxy.ts`) protège `/restaurant` et `/restaurant/*` (redirection vers `/connexion`). Chaque page appelle `obtenirContexteRestaurant()` (`src/lib/auth/contexte.ts`) : session obligatoire, membership restaurant obligatoire, admin système sans membership renvoyé vers `/system`.

| URL | Fichier | Lignes | Titre (metadata) | Accès requis | Composants client du même dossier |
|---|---|---|---|---|---|
| `/restaurant` | `(console)/page.tsx` | 259 | Accueil | Session + membership (layout + page) | `BasculesStatut.tsx` (102) |
| `/restaurant/commandes` | `(console)/commandes/page.tsx` | 120 | Commandes | Idem | `CommandeCarte.tsx` (410), `FormulaireProposition.tsx` (177) |
| `/restaurant/menu` | `(console)/menu/page.tsx` | 254 | Mon menu | Idem | `PlatItem.tsx` (238), `FormulairePlat.tsx` (222), `ChefIA.tsx` (278), `AjoutEnLot.tsx` (103), `SectionsMenu.tsx` (140), `OptionsPlat.tsx` (83) |
| `/restaurant/menu-du-jour` | `(console)/menu-du-jour/page.tsx` | 79 | Menu du jour | Idem | `MenuDuJour.tsx` (297) |
| `/restaurant/ouverture` | `(console)/ouverture/page.tsx` | 73 | Ouvrir ma journée | Idem | `FormulaireOuverture.tsx` (96) |
| `/restaurant/profil` | `(console)/profil/page.tsx` | 155 | Mon restaurant | Idem | `FormulaireProfil.tsx` (203), `FormulaireQuartier.tsx` (61), `FormulaireZonesDesservies.tsx` (103), `SelecteurCouleur.tsx` (66) |
| `/restaurant/tables` | `(console)/tables/page.tsx` | 78 | QR de tables | Idem | `BasculeServiceTable.tsx` (37), `BoutonImprimerTables.tsx` (11) |
| `/restaurant/affiche` | `(console)/affiche/page.tsx` | 133 | Affiche et QR code | Idem | `BoutonImprimer.tsx` (12) |
| `/restaurant/documents` | `(console)/documents/page.tsx` | 93 | Reçus et factures | Idem | `FormulaireIdentite.tsx` (101) |
| `/restaurant/nouveau` | `nouveau/page.tsx` | 58 | Créer mon établissement | Connecté (sinon `/connexion`) ; redirige vers `/restaurant` si déjà membre et vers `/system` si admin système pur. Hors `(console)`, cadre `CadreSite` (`nouveau/layout.tsx`, 9 lignes) | `NouvelEtablissementForm.tsx` (56) |

Routes API dans `src/app/restaurant/alertes/` (pas de page) :

| URL | Fichier | Lignes | Méthodes | Accès |
|---|---|---|---|---|
| `/restaurant/alertes` | `alertes/route.ts` | 53 | GET | Session (401 sinon), membership (403 sinon), réponse minimale sans données client |
| `/restaurant/alertes/abonnement` | `alertes/abonnement/route.ts` | 102 | POST, DELETE | `obtenirMembreCourant` + `origineValide` |
| `/restaurant/alertes/test` | `alertes/test/route.ts` | 33 | POST | Idem, limité à 3 essais / 5 min |

Layouts : `(console)/layout.tsx` (120 lignes, cadre commun), `nouveau/layout.tsx` (9). Le CSS `restaurant/recap.css` (106 lignes, impression du récapitulatif) est importé par le layout `(console)`.

## 2. Navigation

Source : `src/components/restaurant/NavRestaurant.tsx`, rendu par `(console)/layout.tsx`.

**Liste commune (`ENTREES`), 4 entrées :**

| Libellé | Libellé court (barre basse) | Href | Icône | Actif si |
|---|---|---|---|---|
| Accueil | Accueil | `/restaurant` | tableau | égalité stricte |
| Commandes | Commandes | `/restaurant/commandes` | commandes | préfixe |
| Menu | Menu | `/restaurant/menu` | carte | préfixe |
| Mon restaurant | Mon resto | `/restaurant/profil` | boutique | préfixe |

**Badge** : uniquement sur « Commandes », affiché si `aTraiter > 0`. Le compte vient du layout : commandes du restaurant dont `statut = 'en_attente'` (requête directe). Voir écarts.

**Menu latéral (ordinateur, `ad-barre-laterale`, `NavRestaurantCote`) :**
- les 4 entrées ci-dessus, pastille `.rc-pastille` dans le lien ;
- puis `liensBas` (même liste dans le tiroir mobile) : « Voir ma page publique » ou « Aperçu de ma page » (externe, nouvel onglet), « Affiche et QR code » (`/restaurant/affiche`), « QR de tables » (`/restaurant/tables`), « Reçus et factures » (`/restaurant/documents`), « Sécurité du compte » (`/compte/securite`), « Console admin » (`/system`, seulement si rôle système), « Se déconnecter » (formulaire) ;
- outils : `AlerteCommandes` et `InstallationApp` (`.rc-outils`).

**Barre basse (`rc-bas`, `NavRestaurantBas`) :** les 4 entrées seulement. Pastille en coin (`.rc-pastille-coin`). Visible sous 1024 px (`display: none` à partir de 1024 px dans `console-resto.css`). En fenêtre basse (hauteur ≤ 520 px et largeur < 1024 px), la barre passe en position statique.

**Écarts entre les deux :**
- Libellé : « Mon restaurant » (latéral) contre « Mon resto » (barre basse).
- Les liens secondaires (affiche, tables, documents, sécurité, console admin, déconnexion) ne sont que dans le latéral et dans le tiroir mobile. Sur téléphone, ils s'ouvrent depuis le bouton du tiroir (`AdminMenuMobile`, en-tête `.ad-entete-mobile`), pas depuis la barre basse.
- Le latéral affiche la marque avec le nom du restaurant ; l'en-tête mobile aussi.

**Pages sans entrée de navigation directe :**
- `ouverture` : accessible par la tuile « Ma journée » de l'accueil et le bouton « Ouvrir ma journée » de la page Menu.
- `menu-du-jour` : accessible par l'accueil (« Mon menu en statut WhatsApp ») et par les boutons de la page Menu.
- `tables`, `affiche`, `documents` : seulement dans les liens secondaires (latéral ou tiroir), pas dans la barre basse. `affiche` est aussi atteignable depuis l'accueil (bloc « Mon lien et mon QR code » : à vérifier).
- `nouveau` : hors console (parcours de création).

## 3. Écrans clés

| Écran | Une phrase | Actions principales | Mobile (classes ou media queries) |
|---|---|---|---|
| **Commandes** (`commandes/page.tsx`) | Commandes triées par urgence : « À traiter », « En cours », puis historique replié (`<details>`). | Accepter, refuser, prête, terminée, annuler (`traiterCommandeAction`) ; confirmer paiement (`confirmerPaiementAction`) ; émettre reçu ou facture (`emettreDocumentAction`) ; proposition révisée (`creerPropositionAction`) ; message WhatsApp. | Pas de media query propre dans `commandes`. Classes `cmd-*` définies surtout dans `marche.css` (media 264, 575 px, dont le lien avec `cmd-*` reste à vérifier). |
| **Menu** (`menu/page.tsx`) | Liste des plats par section, disponibilité du jour, ajout de plats. | Confirmer toutes les disponibilités ; plat : modifier, basculer disponibilité, confirmer, archiver, options ; ajout unitaire, en lot, dictée ou photo via IA (`analyserMenuPhotoAction`, `importerPlatsChefIaAction`) ; sections : créer, renommer, supprimer, déplacer. | Deux colonnes seulement à partir de 1180 px (`.menu-colonnes`, `.menu-panneau`, `console.css`). Sous 1180 px, colonne unique. `.chef-ia-ligne-bas` en une colonne sous 480 px. Beaucoup de `style={{ }}` inline sur la page (7) et dans `SectionsMenu` (9), `CommandeCarte` (22). |
| **Profil « Mon restaurant »** (`profil/page.tsx`) | Identité publique : photo, logo, couleur, horaires, consignes, moyens de paiement, quartier, zones desservies. | Enregistrer le profil (`modifierProfilAction`, barre `BarreEnregistrement`) ; quartier (`modifierQuartierRestaurantAction`) ; ajouter ou retirer une zone desservie ; illustrations (`definirIllustrationRestoAction`). Le bouton « Fermer temporairement » a été retiré (commentaire de la page). | Deux colonnes à partir de 1180 px (`.profil-colonnes`, aperçu collant) ; `.profil-medias` en une colonne sous 599 px ; `.rappel-securite` ajusté sous 559 px ; `.zones-desservies-deux` à partir de 640 px ; `.selecteur-quartier` à partir de 640 px (`components.css`). |
| **Horaires et statut** (accueil `BasculesStatut` + champ `horaires` du profil) | Ouverture du restaurant et pause des commandes, réglées à un seul endroit (accueil). Les horaires sont un texte libre dans le profil. | `definirStatutRestaurantAction` (champs `ouvert` et `accepte_commandes`) depuis les bascules ; horaires enregistrés avec le profil. | Bascules en deux colonnes à partir de 720 px (`.rc-bascules`, `console-resto.css`). |
| **Paiement** (pas de page dédiée) | Moyens de paiement et codes marchands (Orange, MTN), affichés dans le profil ; encaissement confirmé depuis la commande ; documents dans « Reçus et factures ». | Cases à cocher `moyens_paiement`, champs `code_orange` et `code_mtn` (dans `FormulaireProfil`) ; `confirmerPaiementAction` (commandes) ; identité sur les documents (`enregistrerIdentiteDocumentsAction`, page documents). | Hérite des règles du profil et de `doc-colonnes` (une colonne sous 900 px, `documents.css`). |
| **Équipe** | Absente : aucune page, aucune entrée, aucune mention de gestion de membres dans `src/app/restaurant`. | Néant. | Néant. |
| **Alertes et notifications** | Son, titre d'onglet et notifications push pour les commandes à traiter ; test ; double authentification. | `AlerteCommandes` dans le layout (outil de la barre latérale) ; routes `/restaurant/alertes` (GET), `/abonnement` (POST, DELETE), `/test` (POST) ; `RappelDoubleAuthentification` dans le layout ; avertissement « page fermée » de l'alerte. | Dans `console-resto.css`, `.ad-tiroir .alerte-commandes` et `.ad-barre-laterale .alerte-commandes` (détails repliables). |

Écrans complémentaires (pour mémoire) :
- **Ouverture** (`ouverture`) : rituel du matin, « oui » ou « épuisé » par plat, puis un seul bouton. Barre fixe `.rc-ouv-barre` (au-dessus de la barre basse sur téléphone, `bottom: calc(66px + …)`, décalée de 264 px à partir de 1024 px).
- **Menu du jour** (`menu-du-jour`) : image canvas à publier en statut WhatsApp ; deux colonnes (`.rc-mj`) à partir de 900 px.
- **Tables** (`tables`) : bascule du service à table et planche de QR (`.tables-haut`, une colonne sous 900 px, `affiche.css`).
- **Affiche** (`affiche`) : affiche A4 et statistiques de visites par source ; `.affiche-grille` en une colonne sous 900 px.

## 4. Composants partagés avec la console système ou le site public

Compte des fichiers hors `src/app/restaurant` qui importent le composant (`grep` sur `src/`).

| Composant | Utilisé par | Hors restaurant | Risque de couplage |
|---|---|---|---|
| `components/ui` (Button, Card, Alert, Badge, Input…) | Restaurant + partout | 71 | Faible si l'API reste stable. Base commune. |
| `components/admin/blocs` (PageHeader, Panneau, EtatVide, Pastille, CarteChiffre, Volet, Tuile) | Restaurant + système | 32 (système et public) | **Élevé** : une modification de bloc touche les trois consoles. |
| `components/admin/icones` (IconeAdmin) | Restaurant + système | 9 | Moyen : les noms d'icônes sont partagés. |
| `components/admin/AdminMenuMobile` | Layout restaurant + `system/layout.tsx` | 1 | Moyen : le tiroir mobile est le même composant. |
| `components/admin/graphiques` | Accueil restaurant + `system/page.tsx` | 1 | Moyen. |
| `components/admin/BarreEnregistrement` | Profil restaurant + `system/parametres` | 1 | Moyen. |
| `components/RappelDoubleAuthentification` | Layout restaurant + `system/layout.tsx` | 1 | Moyen. |
| `components/CadreSite` | `nouveau/layout.tsx` + 18 pages publiques et de compte | 18 | Faible pour la console (un seul usage). |
| `components/BoutonsPartage` | Accueil restaurant + `restaurants/[id]/page.tsx` (public) | 1 | Faible. |
| `components/illustrations/Illustration` | Restaurant (menu, profil) + accueil public, `RestaurantCard`, `VignettePlat`, `BanniereRestaurant`, `CartePub` | 10 | **Élevé** : composant du site public. |
| `components/illustrations/EditeurIllustration` | Menu, profil + `system/catalogue/restaurants/[id]` | 1 | Moyen. |
| `components/geographie/SelecteurQuartier` | Profil (2 usages) + `compte/FormulaireQuartierClient` + `system/catalogue` | 2 | Moyen. |
| `components/AlerteCommandes`, `InstallationApp`, `ListeDemarrage`, `restaurant/RecapitulatifJour`, `restaurant/NavRestaurant` | Restaurant seul | 0 | Aucun. |

Couplages côté `lib` relevés dans les pages de la console (non exhaustif) :
- `src/app/restaurant/(console)/page.tsx` importe `@/lib/system-admin/pilotageCalculs` (calculs prévus pour la console système) : **couplage à surveiller**.
- Le même écran et `profil` importent `@/lib/parametres/assistance`, `@/lib/illustrations/*`, `@/lib/geographie/quartiers`, partagés avec le site public (à vérifier cas par cas).
- Le wrapper `.ad-app` est posé à la fois par `(console)/layout.tsx` (classe `ad-app console-resto`) et par `system/layout.tsx` (classe `ad-app`). Toute règle `.ad-app …` touche donc les deux consoles.

## 5. Patterns répétés (pages x blocs)

Croix = bloc présent dans la page.

| Page | En-tête (`PageHeader`) | Panneau ou carte | Liste | Formulaire | Tiroir ou dialogue | État vide (`EtatVide`) | Barre d'enregistrement |
|---|---|---|---|---|---|---|---|
| Accueil | x | x (Panneau, Volet, CarteChiffre) | x (`rc-aTraiter-liste`) | | | x | |
| Commandes | x | x (CommandeCarte en `Card`) | x (`cmd-liste`) | x (FormulaireProposition) | | x | |
| Menu | x | x (aside de `Card`) | x (PlatItem) | x (FormulairePlat, AjoutEnLot, ChefIA, SectionsMenu) | | x | |
| Menu du jour | x | x (aperçu) | x (lignes) | | | x | |
| Ouverture | x (avec retour) | | x (`rc-ouv-liste`) | x (oui ou épuisé) | | x | x (barre fixe `rc-ouv-barre`) |
| Profil | x | x (Card aperçu, Panneau) | x (zones desservies) | x (Profil, Quartier, Zones, Couleur) | | | x (`BarreEnregistrement`) |
| Tables | x | x (2 Panneau) | x (planche de QR) | x (formulaire GET) | | x (non publié) | |
| Affiche | x | x (4 Panneau) | x (tableau des sources) | | | x (non publié) | |
| Documents | x | x (2 Panneau) | x (`doc-liste`) | x (FormulaireIdentite) | | x | |
| Nouveau | | x (Card) | | x (NouvelEtablissementForm) | | | |

Remarques :
- Aucun tiroir ni dialogue (`ad-tiroir`, `ad-dialogue`, `<dialog>`) dans les pages de la console : seul le tiroir mobile du layout (`AdminMenuMobile`) existe.
- La barre d'enregistrement n'existe que sur le profil ; sur les autres formulaires, l'enregistrement se fait par bouton en bas.
- `nouveau/page.tsx` n'utilise pas `PageHeader` et met son style en ligne (`style={{ … }}` sur `main`, `h1`, `p`).

## 6. Feuilles CSS

| Fichier | Lignes | Sélecteurs `.rc-` (distincts / occurrences) | Sélecteurs `.ad-` (distincts / occurrences) | Rôle |
|---|---|---|---|---|
| `src/app/console-resto.css` | 652 | 44 / 61 | 3 / 13 (`.console-resto .ad-contenu`, `.ad-barre-laterale .alerte-commandes`, `.ad-tiroir .alerte-commandes`) | Composants propres au restaurateur (`rc-*`, `saisie-*`, `chef-ia-*`, `zones-desservies-*`, `profil-section`) |
| `src/app/console.css` | 845 | 0 / 0 | 0 / 0 | Classes génériques non préfixées : `tableau`, `kpi`, `menu-colonnes`, `menu-panneau`, `etat-vide`, `interrupteur`, `aide-champ`, `champs-ligne`, `partage-*`, `profil-colonnes`, `plat-ligne-*`, `rappel-securite` |
| `src/app/console-b.css` | 342 | 3 / 8 (`rc-pastille`, `rc-bas`, `rc-bas-item`) | 53 / 238 (toutes sous `.ad-app`, base du cadre) | Direction « Marché en photos » pour les deux consoles ; `mj-*` (menu du jour) |
| `src/app/fantaisie.css` | 440 | 1 / 5 (`rc-bas-item`, sous `.ad-app`) | 11 / 68 | Règles de formulaire et de cadre étendues à `.ad-app` (45 lignes concernées, entre 148 et 393 : voir ci-dessous) |
| `src/app/restaurant/recap.css` | 106 | 0 / 0 | 0 / 0 | Impression du récapitulatif (`recap-*`) |

Pour référence (hors périmètre) : `src/app/admin.css` (2598 lignes) porte la base de `.ad-app` (395 occurrences de `.ad-`, 202 distinctes).

**Règles globales qui s'appliquent à `.ad-app` et risquent de heurter un nouveau composant** :
- `console-b.css` (scopé `.ad-app`) : `.ad-app .btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn:focus-visible`, `.ad-app .field :is(input, select, textarea)` et son `:focus`, `.ad-app :is(h1, h2, h3)` (typographie), `.ad-app .ad-contenu > *` (animations d'entrée sur les enfants directs, avec délais `nth-child`), `.ad-app :is(.ad-tuiles, .ad-cartes, .cmd-liste, .ad-volets, .menu-liste) > *`.
- `fantaisie.css` (lignes 148 à 393, `:is(.theme-public, .ad-app)`) : **éléments ciblés, pas des classes** : `input[type="file"]` (bouton de sélection, survol, focus, `data-choisi`), `input:is([type="checkbox"], [type="radio"])` (et `:checked`), `label:has(> input checkbox/radio):not(.option-supplement, .choix-carte)`, `details[open] > :not(summary)`, `.alerte-danger[role="alert"]`, `:is(.alerte-succes, .alerte-info)`. Ces règles touchent tout nouvel élément de formulaire ou toute alerte placé dans `.ad-app`.
- `fantaisie.css` : `.ad-app .ad-dialogue[open]`, `.ad-app .ad-tiroir[open]`, `.ad-app .ad-barre-enregistrement-conteneur` ; `.ad-app .ad-aide-champ`.
- `console.css` (non scopé, donc global, public inclus) : `.field` (sous `.menu-panneau`), `.aide-champ`, `.etat-vide`, `.interrupteur`, `.kpi`, `.tableau`, `.menu-colonnes`, `.profil-colonnes`, `.partage-*`. Ces noms génériques s'appliquent partout.

**Collisions de noms détectées** (classe définie dans au moins deux feuilles, ou classe absente) :
- Définies dans 2 feuilles ou plus : `btn`, `btn-primary`, `btn-secondary`, `field` (9 feuilles), `alerte`, `alerte-info`, `aide-champ` (cadre, console, recap), `lien-texte` (components, public-info), `lien-evitement` (affiche, cadre, paiement), `cmd-liste` (marche, console-b), `menu-liste` (console, console-b), `profil-colonnes` et `profil-sous-titre` (console, fantaisie), `bandeau-dispo` (console, public-pages), `section-renommer` (console, controles), `rc-bas` (affiche et paiement : seulement dans les `@media print`, sans conflit réel), `rc-pastille` (console-b et console-resto, prévu).
- `cmd-carte`, `cmd-carte-`, `cmd-section`, `cmd-vide`, `cmd-compteur` et autres `cmd-*` : définis dans `marche.css` (parcours client) et utilisés par la console. Couplage à vérifier.
- Noms utilisés dans les TSX mais sans règle exacte : `affiche-page`, `chef-ia`, `plat-ligne` (seules les variantes `chef-ia-*` et `plat-ligne-*` existent), `rc-illustration`, `rc-mj-choix`, `rc-ouv-groupe` (aucune règle trouvée, à vérifier si intentionnel).

## 7. Chiffres

| Indicateur | Valeur |
|---|---|
| Pages (`page.tsx`) sous `src/app/restaurant` | 10 (9 dans `(console)`, 1 dans `nouveau`) |
| Layouts | 2 (`(console)` 120 lignes, `nouveau` 9 lignes) |
| Route handlers (`route.ts`) | 3 (GET 1, POST et DELETE sur `abonnement`, POST sur `test`) |
| Fichiers `'use client'` dans `src/app/restaurant` | 20 |
| Fichiers `'use server'` dans `src/app/restaurant` | 0 (un seul mot trouvé en commentaire dans `ChefIA.tsx`) |
| Actions serveur importées (noms distincts, depuis `src/lib`) | 30 (dont `deconnexionAction`) |
| Occurrences `style={{` dans `src/app/restaurant` | 96 (dont `CommandeCarte` 22, `SectionsMenu` 9, `menu/page` 7, `BasculesStatut` 7, `affiche` 7) |
| Occurrences `style={{` dans `src/components/restaurant` et composants propres au restaurateur | 0 |
| Composants partagés cités (hors restaurant) | 12 familles, voir section 4 |
| Media queries dans `console-resto.css` | 8 blocs (`min-width` 720, 900, 1024 ; `max-width` 480 ; `max-height` 520 combiné ; `min-width` 640) |
| Media queries dans `console.css` concernant les écrans restaurateur | 6 blocs (1180 px ×2, 900 px, 599 px, 559 px, impression exclue) ; 2 autres (900 et 330 px) touchent `.tableau` et sont génériques |
| Media queries dans `affiche.css` | 3 blocs écran à 900 px (`affiche-grille` ×2, `tables-haut` ×1) et 2 blocs impression |
| Media queries dans `documents.css` | 1 écran (900 px) et 1 impression |
| Media queries dans `fantaisie.css` liées à `.ad-app` / `rc-` | 3 blocs (≤ 480 px, ≤ 420 px sur `.rc-bas-item`, réduction de mouvement) |
| Lignes des feuilles `console-resto` / `console` / `console-b` / `fantaisie` | 652 / 845 / 342 / 440 |

## 8. Parcours mobile

Socle commun (tous les écrans) :
- Barre basse `.rc-bas` visible sous 1024 px ; en-tête mobile `.ad-entete-mobile` avec tiroir (`AdminMenuMobile`) jusqu'à 1024 px ; `.ad-contenu` avec marge basse réservée à la barre.

| Page | Mise en page spécifique petit écran ? | Détail |
|---|---|---|
| Accueil | Oui (partielle) | Bascules et tuiles en deux colonnes à partir de 720 px ; chiffres (`ad-cartes`) en une colonne sous 420 px, deux colonnes au-delà, quatre à partir de 1100 px (`admin.css`). |
| Commandes | Non vérifiable (à vérifier) | Pas de media query dans `commandes/` ; les classes `cmd-*` viennent de `marche.css` (media 264 px, 575 px) : lien avec la console à confirmer. |
| Menu | Oui | Colonne unique puis deux colonnes à partir de 1180 px ; formulaires en une colonne (`chef-ia-ligne-bas`) sous 480 px. |
| Menu du jour | Oui (partielle) | Deux colonnes (`.rc-mj`) à partir de 900 px ; aperçu en colonne unique sur téléphone. |
| Ouverture | Oui | Barre fixe de validation au-dessus de la barre basse sur téléphone. |
| Profil | Oui | Deux colonnes à partir de 1180 px (aperçu collant) ; `profil-medias` en colonne unique sous 599 px ; `rappel-securite` ajusté sous 559 px ; `zones-desservies-deux` à partir de 640 px. |
| Tables | Oui | Deux colonnes puis une colonne sous 900 px (`tables-haut`) ; planche de QR en grille fluide (220 px minimum). |
| Affiche | Oui | Deux colonnes puis une colonne sous 900 px (`affiche-grille`). |
| Documents | Oui | Deux colonnes puis une colonne sous 900 px (`doc-colonnes`). |
| Nouveau | Non | Largeur maximale 420 px en ligne (`style`), pas de media query propre. |

Pages sans règle spécifique petit écran : **Nouveau** (style en ligne seulement) et **Commandes** (à vérifier). Les autres ont au moins une règle de colonnes ou de barre dédiée.

Note : les deux navigations (latéral et barre basse) reçoivent le même compteur `aTraiter` du layout ; la divergence possible avec la page Commandes est décrite dans les écarts.

## Écarts et points à vérifier

1. **Pastille « Commandes » (layout) et section « À traiter » (page)** : le layout compte `statut = 'en_attente'` ; la page filtre sur `etatDerive === 'en_attente'`. Les deux peuvent diverger (à vérifier avec `chargerApercusCommandes`).
2. **Équipe** : aucune fonctionnalité de gestion des membres dans la console restaurateur (à confirmer côté produit).
3. **Paiement** : pas de page dédiée ; les moyens et codes marchands sont dans le profil, les reçus dans « Reçus et factures ».
4. **Classes `cmd-*`** : partagées avec `marche.css` (parcours client). Risque de régression visuelle si l'une des deux feuilles change.
5. **Classes référencées sans règle exacte** : `rc-illustration`, `rc-mj-choix`, `rc-ouv-groupe`, `affiche-page`, `chef-ia`, `plat-ligne`.
6. **Couplage** : `(console)/page.tsx` importe `lib/system-admin/pilotageCalculs`.
7. **Lien `/restaurant/affiche` depuis l'accueil** : le bloc « Mon lien et mon QR code » n'a pas de lien direct vers l'affiche ; la page est atteinte par le latéral et le tiroir (à vérifier).

## Réponse de synthèse

- 10 pages et 3 routes API ; 4 entrées de navigation, plus 7 liens secondaires seulement dans le latéral et le tiroir.
- 20 composants client et 30 actions serveur importées depuis `src/lib`, aucune directive `'use server'` dans le dossier.
- 96 `style={{` dans `src/app/restaurant` ; 0 dans `src/components/restaurant`.
- Feuilles : `console-resto.css` (652 lignes, 44 sélecteurs `.rc-`), `console-b.css` (342 lignes, 53 sélecteurs `.ad-` sous `.ad-app`), `fantaisie.css` (440 lignes, ~45 lignes `.ad-app`/`.rc-`), `console.css` (845 lignes, classes génériques non préfixées).
- Risque principal : `components/admin/blocs` et `components/illustrations/Illustration` sont partagés avec la console système et le site public ; les règles `.ad-app` ciblant `input`, `label`, `details` et `alerte` touchent tout nouvel élément de formulaire.
