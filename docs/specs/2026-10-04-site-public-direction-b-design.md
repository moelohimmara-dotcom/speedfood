# Site public Speedfood, direction B « Marché »

Décidé avec Malika le 4 octobre 2026 après la maquette interactive des trois directions (A Braise, B Marché, C Ticket). Choix : **B**. Référentiel d'inspiration : le dossier Fluxora (navigation en pilule, titres serrés, bouton à pastille blanche, cartes nettes, rythme d'animation), traduit dans l'univers de B.

## 1. But et principes

Un site public à **plusieurs pages**, une par rubrique, et non une page d'atterrissage. Animé, interactif, convivial, attractif. Il remplace l'habillage actuel du parcours client sans toucher à sa logique (recherche, disponibilité, panier, commande, suivi, comptes).

Principes : la page d'accueil est un point d'entrée court, pas un long argumentaire ; chaque rubrique a sa page ; le contenu réel prime (vraies données, vraies photos quand elles existent, jamais de chiffre inventé) ; une seule rupture de grille assumée par page ; aucune animation sans raison.

## 2. Plan du site et routes

| Rubrique | Route | État |
|---|---|---|
| Accueil | `/` | **nouvelle page** (remplace la redirection vers `/restaurants` décidée le 3 octobre) : envie du moment, restaurants à la carte, quartiers, trois étapes en bref |
| Restaurants | `/restaurants` | existe : habillage B, recherche, filtres, disponibilité inchangés |
| Fiche restaurant | `/restaurants/[id]` | existe : bandeau et plats habillés B, illustration si pas de photo |
| Comment ça marche | `/comment-ca-marche` | **nouvelle** : quatre étapes interactives, avec l'animation signature |
| Quartiers | `/quartiers` et `/quartiers/[slug]` | **nouvelles**, alimentées par la table `neighborhoods` (utile au référencement : « restaurants à Kaloum ») |
| Restaurateurs | `/devenir-partenaire` | existe : refaite, liste de contrôle de la fiche (mêmes critères que la console admin) |
| Aide | `/aide` | existe : refaite, questions dépliables |
| À propos | `/a-propos` | existe : allégée (histoire, principes), l'ancien argumentaire long est retiré |
| Panier, commande, suivi, compte, entrer | inchangées | seul l'habillage commun (jetons, boutons, cartes) change |

Navigation principale : Accueil, Restaurants, Comment ça marche, Quartiers, Restaurateurs, Aide. Pastille de panier toujours visible. Sur téléphone, la navigation basse actuelle est conservée (Accueil, Restaurants, Panier, Compte) et un tiroir donne accès aux autres rubriques.

## 3. Système visuel (décisions de Malika, 4 octobre)

- **Polices** : Barlow Condensed (logotype, chiffres) et Manrope (texte) **plus Bricolage Grotesque** pour les titres du site public. Chargée par `next/font` (poids 700 et 800, latin, `display: swap`, `preload: false`) : le fichier n'est téléchargé que par les pages qui l'utilisent, pas par la console.
- **Ombres décalées et contours épais** (effet autocollant) : autorisées sur le **site public uniquement**, derrière une classe de portée `.theme-public`. Console admin et espace restaurateur gardent leur style sobre.
- **Couleurs** : tokens inchangés (rouge, orange, mangue, crème, encre). Aplats uniquement ; le dégradé de marque reste réservé au bouton d'action principale.
- **Contraste** (règle ajoutée) : jamais de texte rouge sur fond mangue (2,9 pour 1). Sur mangue : encre. Le surlignage d'un mot de titre se fait en mangue sous du texte encre.
- **Illustrations** : priorité photo, puis illustration (logo, couverture, plat) déjà modifiable dans la console. Les motifs d'ornement (bazin, enseigne peinte) du composant `Illustration` servent aussi de séparateurs.
- **Éléments** : barre de navigation en pilule, autocollants (état « Ouvert », « Mise à jour il y a… »), cartes restaurant et plat à contour épais, bandeau défilant des quartiers, boutons à pastille blanche et flèche.

## 4. Mouvement et interactivité

- **Animation signature** (une seule) : une commande qui voyage, du panier au ticket puis aux quatre statuts réels (en attente, acceptée, prête, terminée). Sur l'accueil et sur `/comment-ca-marche`.
- **Interactions** : sélecteur d'envie (famille de plats) qui propose un vrai restaurant ouvert, filtres et recherche en direct, sélecteur de quartier, étapes cliquables, liste de contrôle du restaurateur.
- **Discret** : apparition au défilement (depuis un état déjà visible, jamais de contenu caché au chargement), survol des cartes, bandeau défilant.
- **Règles** : `prefers-reduced-motion` coupe tout sauf les changements d'état ; pas de vidéo ; pas de bibliothèque d'animation (CSS et un peu de JavaScript natif) ; tout contenu lisible sans JavaScript.

## 5. Données et textes

- Les restaurants, plats, quartiers et statuts viennent de la base. La découverte existante (`src/lib/decouverte/recherche.ts`) est étendue pour charger les illustrations, validées avant affichage.
- **Aucun chiffre inventé.** Les compteurs publics (restaurants, quartiers) ne s'affichent qu'à partir des vraies données et seulement après nettoyage des restaurants de test.
- Les textes d'accueil réglables depuis la console (promesse) restent la source de l'accroche ; les autres textes sont écrits en français simple, sans slogan interchangeable, dans l'esprit de la spécification pilote.

## 6. Ce qui rend le résultat non générique (liste de contrôle de relecture)

1. Au moins une rupture volontaire de grille par page (visuel qui déborde, texte qui chevauche), jamais plus.
2. Pas de grille de cartes identiques sans variation de rythme : une carte « à la une » plus grande par liste.
3. Les photos et illustrations réelles passent avant tout décor ; pas de dessin générique sans raison.
4. Titres écrits comme une personne du quartier les dirait ; pas de formule d'application interchangeable.
5. Pas de séparateurs ✦ ou d'icônes décoratives sans sens ; les motifs inspirés du bazin et des enseignes peintes les remplacent.
6. Une seule animation mémorable ; le reste est discret.
7. Contrôle visuel avant et après, à 360 px et 1280 px.

## 7. Hors périmètre

Logique de commande, panier, comptes clients, console admin, espace restaurateur (chantier suivant), paiement. Aucune nouvelle dépendance.

## 8. Contrôles de fin et livraison

`tsc`, lint, tests unitaires ; accessibilité (focus, contrastes, cibles de 44 px, navigation au clavier, lecteur d'écran sur la navigation) ; 360 px sans défilement horizontal ; mouvement réduit ; poids de page mobile suivi (objectif : moins de 300 Ko hors images, rendu utile sur réseau lent) ; essai sur vrai téléphone par Malika. Livraison par étapes, un commit par étape, déploiement uniquement sur « Déploie » :

1. Spécification et charte (ce document, `DESIGN-SYSTEM.md`).
2. Enveloppe : polices, jetons `.theme-public`, navigation, pied de page, panier.
3. Accueil, puis Restaurants et fiche (avec illustrations).
4. Pages d'information : comment ça marche, quartiers, restaurateurs, aide, à propos.
5. Couche d'animation.
6. Contrôles et corrections.
