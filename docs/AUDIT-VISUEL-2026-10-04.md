# Audit visuel et d'accessibilité du frontend — 4 octobre 2026

**Version :** 1.0. **Norme de référence :** WCAG 2.1 AA (+ cibles tactiles de 44 px). **Méthode :** validation visuelle sceptique (une exigence n'est tenue que si elle est prouvée par une mesure ou une capture) et revue d'accessibilité, sur la production (`speedfood-app.moelohimmara.workers.dev`) et, pour les consoles, sur une copie locale avec un compte de test supprimé ensuite.

## 1. Ce qui a été fait, et ses limites

| Passage | Écrans | Largeurs | Preuve |
|---|---|---|---|
| Mesures instrumentées dans le navigateur (script injecté page par page) | 11 écrans publics, 5 écrans de console | 375 px et 1280 px | contraste calculé élément par élément, cibles tactiles, étiquettes de champs, noms accessibles, niveaux de titres, repères (landmarks), identifiants dupliqués, débordement horizontal |
| Test clavier réel (touche Tab) | découverte | 1280 px | ordre de tabulation et style de focus relevés élément par élément |
| Passage visuel (captures) | 404, commande, profil, fiche, découverte | 375 et 1000 px | captures commentées |

**Limites assumées**
- Les pages interdisent d'être intégrées dans un cadre (`X-Frame-Options: DENY`, `frame-ancestors 'none'`) : bon point de sécurité, mais l'audit a dû se faire page par page.
- **Non audité** : la console d'administration (exige le compte super_admin), les lecteurs d'écran réels (NVDA, VoiceOver), l'agrandissement à 200 %, les appareils réels.
- Le contraste n'est pas calculé sur les fonds en dégradé (1 à 4 éléments par page, dont les boutons principaux) : ces cas sont traités à part (constat M1).
- Le test de focus « programmatique » (donner le focus par script) est **écarté** : il ne déclenche pas `:focus-visible` et donnerait de faux positifs. Seuls les résultats du vrai test clavier sont retenus.

## 2. Synthèse

| | Constats |
|---|---|
| Majeurs | 8 |
| Moyens | 6 |
| Mineurs | 4 |

**Ce qui est solide** (mesuré) : langue `fr` partout ; un seul `h1` par page ; aucune image sans attribut `alt` ; aucun champ sans étiquette ; aucun identifiant dupliqué ; **aucun débordement horizontal** à 375 et à 1280 px ; contraste conforme sur plus de 99 % des textes mesurés (découverte : 223 textes, 0 échec) ; repères `header`, `nav`, `main`, `footer` présents sur toutes les pages publiques ; en-têtes de sécurité stricts.

## 3. Constats majeurs

| # | Écran | Constat et preuve | Critère | Recommandation |
|---|---|---|---|---|
| M1 | Boutons principaux (tous) | Texte blanc sur dégradé orange → rouge. Calcul : blanc sur `#ff7a1a` = **2,6 : 1** (extrémité orange), blanc sur `#d9362b` = 4,65 : 1 (extrémité rouge). Le texte (16 px, gras) n'est pas « grand texte » au sens WCAG (18,66 px gras). **Théorique, non mesuré sur rendu** : le dégradé est un jeton verrouillé de `DESIGN-SYSTEM.md`. | 1.4.3 | Décision de Malika : assombrir l'extrémité orange (ex. `#e8590c`, ≥ 4,5 : 1), ou caler le dégradé pour que le texte reste dans la zone rouge (déjà fait pour la barre de panier). |
| M2 | Tous les éléments focalisables | Anneau de focus = `rgba(255,122,26,0.35)` sur 3 px. Sur le fond crème (`#fff6ed`) il vaut **1,4 : 1** (calcul). Sur le bouton « Rechercher » (principal), **aucun changement visible au focus** : seule l'ombre ordinaire est présente. | 2.4.7, 1.4.11 | Un anneau plein de 3 px en `--encre` ou `--rouge-fonce` avec décalage de 2 px, pour tous les contrôles, y compris les boutons à dégradé. |
| M3 | Pages publiques | **Aucun lien d'évitement** : le premier Tab tombe sur le logo, puis 3 liens d'en-tête avant le contenu. | 2.4.1 | Lien « Aller au contenu » visible au focus, en tête de `CadreSite`. |
| M4 | Console restaurateur (5 écrans) | **Aucun repère `<main>`** (`main: 0`) ; la page de profil n'a même pas de `header`. | 1.3.1, 2.4.1 | Envelopper `console-principal` dans `<main>`. |
| M5 | 12 écrans | Titre de page identique « Speedfood » : connexion, inscription, mot de passe oublié, panier, commande, alternatives, 404, console (accueil, commandes, menu, profil, sécurité). Seules la fiche et la confidentialité ont un titre propre. | 2.4.2 | `export const metadata = { title: "Connexion · Speedfood" }` par page. |
| M6 | 404 | Page nue : ni en-tête, ni pied de page, ni navigation ; **le message « Ce restaurant n'existe pas, ou n'est plus publié » s'affiche pour n'importe quelle adresse** ; à 375 px le texte touche les deux bords (aucune marge). | UX, 3.3 | `not-found.tsx` dans `CadreSite`, message neutre (« Cette page n'existe pas »), marges, un message spécifique pour une fiche restaurant introuvable. |
| M7 | Panier et commande | **Flash de panier vide** : tant que la page n'est pas hydratée, elle affiche « Votre panier est vide » avant de montrer les articles (vu sur capture à 375 px, puis contenu complet à 3 s). Trompeur, et décalage de mise en page. | UX, CLS | Ne rien afficher (ou un squelette) tant que le panier n'est pas lu, au lieu de l'état vide. |
| M8 | À propos | Texte « Je suis client » (bascule de `/a-propos`) : **4,10 : 1** à 14,7 px. | 1.4.3 | Assombrir le texte inactif (≥ 4,5 : 1). |

## 4. Constats moyens

| # | Écran | Constat et preuve | Critère | Recommandation |
|---|---|---|---|---|
| Y1 | Panier, résumé de fiche | Boutons − / + : **34 × 44 px** et 36 × 44 px (largeur sous 44). Alternatives : lien « Chercher « … » » 248 × 39. | 2.5.5 | Largeur minimale 44 px. |
| Y2 | Mon restaurant | **18 cibles sous 44 px** : pastilles de couleur et croix de 32 × 32 px. | 2.5.5 | Zone de 44 px autour de chaque pastille. |
| Y3 | Navigation basse, console, profil | Pastilles de nombre à **10,9 px** (sous le minimum de 12 px retenu au design). | lisibilité | `0.75rem` minimum. |
| Y4 | Console (toutes pages) | Bandeau rouge de double authentification de **~100 px en haut de chaque page**, non masquable. Il pousse le contenu et se répète. | UX | Bandeau compact d'une ligne, masquable pour la session, plein format seulement sur l'accueil. |
| Y5 | Mon restaurant | Longue pile de formulaires pleine largeur (non refondue) ; « Fermer temporairement » double l'état d'ouverture de l'accueil. | UX | Deux colonnes (identité / horaires), un seul endroit pour l'état d'ouverture. |
| Y6 | Commande (ordinateur) | Colonne unique de 640 px centrée, sans récapitulatif de commande à côté du formulaire. | UX | Récapitulatif collant à droite à partir de 900 px. |

## 5. Constats mineurs

| # | Constat | Critère |
|---|---|---|
| m1 | Sauts de niveaux de titres : fiche restaurant (h2 « Menu » → h4 des plats) ; console (h1 → h3). | 1.3.1 |
| m2 | Lettre décorative de tuile sans photo à 1,5 : 1 (32 px) : `aria-hidden`, donc non bloquant, mais le visuel est très pâle. | 1.4.3 (exempté, décoratif) |
| m3 | Liens en ligne de 19 px de haut (« Activer maintenant ») : acceptables dans un texte courant, mais petits à toucher. | 2.5.5 |
| m4 | Pastilles `.nav-basse-badge` et compteurs : à relier à Y3. | — |

**Faux positif écarté** : un lien d'appel « sans nom accessible » dans l'historique des commandes. Il se trouve dans un bloc replié (`<details>`) : son texte existe mais n'est pas rendu.

## 6. Plan de correction proposé (par lots, par impact)

1. **Accessibilité transversale (M2, M3, M4, M5)** : anneau de focus net, lien d'évitement, `<main>` dans la console, un titre par page. Un seul lot, peu risqué, visible par tous les utilisateurs au clavier.
2. **Parcours client (M6, M7, M8, Y1)** : 404 dans le cadre du site avec un bon message, plus de flash de panier vide, contraste de la bascule, cibles de quantité.
3. **Boutons principaux (M1)** : **décision de Malika** (jeton de design verrouillé).
4. **Console (Y2 à Y6)** : bandeau 2FA compact, page « Mon restaurant » en deux colonnes, cibles des pastilles.
5. **Vérifications manuelles** : lecteur d'écran (NVDA), agrandissement 200 %, test sur téléphone réel, console d'administration.

## 7. Reproductibilité

Le script de mesure est un utilitaire jetable (injecté dans l'onglet, non commité). Pour refaire les mesures : charger chaque page à 375 et à 1280 px, injecter le script, comparer aux tableaux ci-dessus. Les valeurs de contraste de M1 et M2 se recalculent à la main avec la formule WCAG (luminance relative) à partir des jetons de `globals.css`.

## 8. Suite donnée (4 octobre 2026, même jour)

| Lot | Constats | État | Vérification |
|---|---|---|---|
| 1 | M2, M3, M4, M5 | **Corrigé (local, non déployé)** | Vrai test clavier : le premier Tab met en évidence « Aller au contenu » ; anneau plein de 3 px en `--rouge-fonce` (5,8 : 1) sur tous les contrôles, blanc sur le pied de page sombre ; `<main>` présent dans la console restaurateur et l'administration ; 11 écrans publics + 6 écrans de console avec un titre unique. |
| 2 | M6, M7, M8, Y1 | **Corrigé (local, non déployé)** | 404 dans le cadre du site avec un message neutre ; panier et commande ne montrent plus « panier vide » avant la lecture du panier (HTML initial : indicateur de chargement, pas de texte « vide ») ; bascule « Je suis client » en rouge foncé ; boutons − / + et lien des alternatives à 44 px. |
| 3 | M1 | **En attente de décision de Malika** | Jeton de design verrouillé (dégradé orange → rouge, blanc à 2,6 : 1 côté orange). Options : assombrir l'extrémité orange, ou garder le texte dans la zone rouge. |
| 4 | Y2 à Y6 | **Corrigé (local, non déployé)** | Console : 0 cible sous 44 px (avant : 18 sur « Mon restaurant »), rappel de double authentification en une ligne et masquable pour la session, « Mon restaurant » en deux blocs avec barre d'enregistrement collée et aperçu à droite (≥ 1180 px), doublon « Fermer temporairement » supprimé (un seul endroit : l'accueil), commande en deux colonnes à partir de 900 px (récapitulatif collant). Administration vérifiée avec un rôle de test temporaire (supprimé). |

**Reste** : m1 (sauts de niveaux de titres), vérifications manuelles (lecteur d'écran, zoom 200 %, téléphone réel).
