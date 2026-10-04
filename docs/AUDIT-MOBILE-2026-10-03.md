# Audit visuel mobile — 3 octobre 2026

**Méthode.** Chrome piloté par le protocole de débogage, viewport **390 × 844** (et 360 / 430 pour
la barre de panier), densité 2. Treize écrans parcourus, chacun instrumenté : débordement
horizontal, cibles tactiles, contrastes calculés, tailles de police, champs de saisie,
recouvrement par les barres fixes. Chaque écran a aussi été capturé et regardé. Rien n'a été
modifié pendant l'audit.

**Écrans couverts :** découverte, recherche, fiche avec photo, fiche sans photo, alternatives,
panier, commande, suivi (404), à-propos, confidentialité, connexion, inscription, mot de passe
oublié.

---

## 1. Ce qui fonctionne déjà

- **Aucun débordement horizontal** sur les treize écrans : `scrollWidth` = 390 partout. Le
  correctif global `body > * { min-width: 0; width: 100% }` tient.
- **Aucun défaut de contraste** mesuré (< 4,5:1) sur les textes à fond uni.
- **Aucun champ ne provoque le zoom automatique d'iOS** : tous les champs visibles sont à **16 px**
  (48 px de haut pour les champs de saisie, 52 px pour la recherche).
- **Les cases et boutons radio ont une vraie zone tactile** : ce sont les cartes-libellés qui
  captent le clic — **62 px** pour « Retrait sur place » et « Livraison », **197 px** pour la case
  de consentement.
- **La barre de navigation basse ne recouvre pas le pied de page** (`piedMasque: false`).
- **Les montants sont correctement formatés** : espace fine insécable (U+202F) présente partout.
- **Toutes les images ont un attribut `alt`** (vide pour les images décoratives, ce qui est correct).

## 2. Ce qui ne va pas

### 2.1 🔴 La barre de panier flottante déborde sur les téléphones étroits

C'est le défaut le plus sérieux, et il touche la cible principale.

| Largeur | Barre | Contenu | Débordement |
|---|---|---|---|
| **360 px** | 12 → 348 | jusqu'à **364** | **+16 px** (4 px hors écran) |
| 390 px | 12 → 378 | jusqu'à 378 | aucun |
| 430 px | 12 → 418 | jusqu'à 418 | aucun |

**360 px est la largeur des Android d'entrée de gamme** — le parc dominant à Conakry.

Éléments en cause, mesurés :

- `.barre-panier-gauche` (« 2 articles » + vignettes) : **144 px**, non compressible ;
- `.barre-panier-droite` (« Voir le panier · 17 000 GNF ») : **188 px**, en `white-space: nowrap`.

Soit 332 px de contenu plus les marges internes, pour 336 px de barre : il manque de la place, et
`nowrap` interdit au libellé de céder. **Le montant est coupé au bord droit.**

### 2.2 🟠 Les chips de filtre sont à 38 px au lieu de 44 px

**Onze cibles** sur l'écran le plus utilisé de l'application :

> « Ouvert maintenant », « Accepte les commandes », « Plat disponible », « Riz & sauces »,
> « Grillades », « Fast-food », « Petit-déjeuner », « Kaloum », « Dixinn », « Ratoma », « Matam »

Toutes mesurent **38 px de haut**. Le design system impose 44 px, et ce sont les filtres
principaux : six pixels de moins, sur les commandes les plus sollicitées, c'est exactement là que
l'écart se paie.

### 2.3 🟠 Le premier affichage de la découverte est vide

Le HTML servi par le serveur contient **« Chargement des restaurants… »** : la liste est rendue
côté client. Mesures (réseau rapide de cette machine) :

| Instant | Ce qui est affiché |
|---|---|
| ~400 ms | « Chargement des restaurants… », puis directement **le pied de page** |
| ~1,2 s | la page complète (titre, filtres, plats du moment) |

Sur un réseau mobile lent, c'est une page qui paraît cassée — un titre de chargement suivi du
pied de page, sans squelette de contenu. Aucun état intermédiaire ne donne à l'utilisateur
l'impression que quelque chose arrive.

### 2.4 🟡 Les libellés de la navigation basse sont à 11,5 px

« Découvrir », « Panier », « Espace pro » : **11,5 px**. Les badges de l'application ont déjà été
remontés de 11,5 à 12 px pour la lisibilité ; la navigation basse, qui est la commande la plus
utilisée, est restée en dessous.

### 2.5 🟡 Trois liens de texte n'ont pas de zone tactile

| Écran | Lien | Hauteur |
|---|---|---|
| Alternatives | « Retour au catalogue » | **22 px** |
| À-propos | « Voir les restaurants disponibles » | **22 px** |
| Confidentialité | `moelohimmara@gmail.com` | **22 px** |

Ailleurs, les liens de retour (`LienRetour`) et les liens de texte (`.lien-texte`) réservent 44 px.
Ces trois-là sont des liens bruts, sans classe : même défaut que celui corrigé sur les flèches, à
un endroit qu'on n'avait pas balayé.

## 3. Fausses pistes vérifiées (et écartées)

Les relever fait partie du travail : trois soupçons se sont révélés infondés, et je préfère
l'écrire plutôt que de les laisser passer pour des trouvailles.

- **« Des champs à 13,33 px »** sur presque tous les écrans : ce sont des `<input>` **masqués**
  (la recherche de l'en-tête, invisible sous 900 px). Tous les champs réellement visibles sont à
  16 px.
- **« Les cases à cocher font 24 px »** : c'est l'élément `<input>` lui-même. La zone réellement
  cliquable est le libellé qui l'enveloppe — 62 à 197 px.
- **« 22000 GNF au lieu de 22 000 GNF »** : lecture erronée de ma part sur une capture réduite.
  La mesure de la police donne bien un écart (113,8 px avec l'espace fine, 109 px sans), donc le
  séparateur existe et s'affiche.

## 4. Ce que la mesure ne voit pas, et qui méritait un œil

- Sur la découverte, les deux groupes de chips (« Ouvert maintenant / Accepte les commandes /
  Plat disponible » puis « Type de cuisine ») **ne reposent pas sur le même fond** : une rupture
  horizontale nette traverse la page. Elle se lit comme une couture de mise en page, pas comme un
  choix.
- La vignette de panier affiche des **pastilles noires** avec l'initiale du plat pour les plats
  sans photo ; sur la barre rouge, ces disques sombres pèsent visuellement plus que le montant.
- Le pied de page occupe, sur mobile, **plus d'un écran entier** (liens clients, restaurateurs,
  informations, en grand corps blanc sur fond sombre) avant d'atteindre la fin de la page.

## 5. Priorités

| # | Défaut | Gravité | Effort |
|---|---|---|---|
| 1 | Barre de panier qui déborde à 360 px | **Élevée** — touche la cible principale | Faible |
| 2 | Premier affichage vide sur la découverte | **Élevée** — première impression, réseaux lents | Moyen |
| 3 | Chips de filtre à 38 px | Moyenne — accessibilité, usage intensif | Faible |
| 4 | Trois liens sans zone tactile | Moyenne | Faible |
| 5 | Libellés de navigation à 11,5 px | Faible | Trivial |
| 6 | Rupture de fond entre les groupes de chips | Faible — esthétique | Faible |

## 6. Ajout après relecture de Malika — la bande sous le pied de page (corrigée)

Signalé par Malika après l'audit : en bas de « Mon panier », une bande de fond crème
apparaissait sous le pied de page sombre, donnant l'impression d'un pied de page qui ne tient
pas le bas de l'écran.

**L'audit ne l'avait pas vu, et il faut le dire :** je vérifiais que les barres fixes **ne
recouvrent rien** (`piedMasque: false`), jamais qu'elles **laissent un vide**. Le test était
incomplet.

**Cause mesurée :** `.cadre-site.avec-navigation` portait `padding-bottom: 150px` — la réserve
d'espace pour la navigation basse et la barre de panier. Le pied de page étant le dernier enfant
de cette enveloppe, la réserve tombait **après** lui, sur une boîte transparente : c'est le fond
crème du `body` qui apparaissait sous le pied sombre. Une seconde réserve, de 96 px, existait
déjà dans le pied de page — les deux se cumulaient.

**Correctif :** la réserve est déplacée sur le pied de page lui-même
(`.avec-navigation .site-pied { padding-bottom: calc(var(--space-6) + 150px + safe-area) }`),
pour que son fond sombre descende jusqu'au bas de la page. Elle doit couvrir les **deux**
éléments fixes : la barre de panier (58 px) s'ajoute à la navigation (61 px).

**Vérifié par mesure :** écart sous le pied de page **0 px** (150 px avant), fond sombre
jusqu'au bas, et le dernier texte du pied de page reste **au-dessus** de la barre de panier
(670 contre 718) et de la navigation (783).

## 7. Correctifs appliqués (4 octobre 2026)

Version Worker `016d9708`. Chaque point a été revérifié par la même instrumentation que l'audit.

| Défaut | Correctif | Vérification |
|---|---|---|
| Barre de panier débordante sous 380 px | Sous 380 px : marges ramenées à 8 px, écart à 6 px, et **nombre d'articles retiré** — il est déjà porté par la pastille de la navigation basse et par le libellé accessible du lien | Débordement **0 px** à 360 et 375 px (contre +16 px) ; le montant n'est plus coupé |
| Chips de filtre à 38 px | `min-height: 44px` sur `.chip` | Hauteur **44 px**, et **plus aucune cible sous 44 px** sur la découverte (11 avant) |
| Liens à 22 px | `<Link><Button>` — un `<button>` imbriqué dans un `<a>`, HTML invalide — remplacé par un lien portant les classes de bouton | « Retour au catalogue » **45 px**, aucune cible sous 44 px sur la 404, à-propos et confidentialité |
| Adresse de contact à 22 px | Lien en pleine phrase : `padding: 11px 0` (n'agrandit pas la ligne, porte la zone tactile à 44 px — exception « lien en ligne » de WCAG 2.5.5) | Plus aucune cible sous 44 px sur la confidentialité |
| Libellés de navigation basse à 11,5 px | `font-size: 0.75rem` | **12 px** |

**Non traités :** le premier affichage vide de la découverte (§ 2.3), qui demande un choix
d'architecture (rendu serveur ou squelette de chargement), et la rupture de fond entre les deux
groupes de chips (§ 4), esthétique.

## 8. Retouche du bloc « article au panier » (4 octobre 2026)

Signalé par Malika : sous une vignette de plat, le bloc du plat déjà au panier était à l'étroit —
« Sans supplément » se cassait sur deux lignes et les commandes se serraient.

**Deux causes, dont une plus profonde que prévu :**

1. **Mise en page horizontale.** Le libellé et la pilule `− 1 + ✕` étaient sur la même ligne, en
   `justify-content: space-between`. Dans une vignette étroite, le libellé se comprimait et
   passait sur deux lignes. Corrigé par empilement : libellé sur sa propre ligne, commandes
   dessous, dans une zone légèrement teintée qui distingue le plat déjà commandé.

2. **La vignette elle-même était trop étroite.** Mesure : à 360 px de large, une grille à deux
   colonnes ne laisse que **158 px** par vignette — alors que la pilule de commandes demande
   **192 px** (trois boutons de 44 px). Elle débordait donc de la carte : invisible sur un grand
   téléphone, systématique sur les Android d'entrée de gamme. Aucune réduction de taille n'aurait
   suffi sans descendre sous les 44 px fixés par le design system : **la grille passe à une seule
   colonne sous 480 px**, deux au-delà, trois à partir de 640 px. `.vignettes` ne sert qu'au menu
   d'une fiche restaurant — le catalogue de découverte n'est pas touché.

**Au passage :** les glyphes `−`, `+` et `✕` sont remplacés par des icônes SVG de la famille du
design system (grille 24, tracé 2, extrémités arrondies) — même argument que pour les flèches :
un caractère de police dépend de l'appareil et n'a pas le poids optique du reste.

**Vérifié par mesure** à 360 et 390 px : libellé sur **une ligne** (17 px de haut, pleine largeur),
**trois boutons de 44 px**, trois icônes SVG, bloc de 99 px, **aucun débordement**.

**Élargissement (même jour).** Le bloc se contentait de sa largeur naturelle : la pilule
n'occupait que la moitié de la carte et les boutons restaient à l'étroit. Les commandes passent
en **pleine largeur**, en deux groupes distincts — le pas à pas à gauche, le retrait détaché à
droite, pour qu'ils ne se touchent pas. Mesuré à 360 px : bornes de **82 px** de large et 44 px
de haut, retrait 44 × 44, aucun débordement ; à 390 px, bornes de **97 px**.

**Dette CSS corrigée au passage.** Les règles de la vignette ciblaient `div[style*="inline-flex"]` :
elles dépendaient donc des styles en ligne du composant, et masquaient le bouton de retrait dans
un cas seulement. Remplacées par des classes explicites (`panier-article-*`, `vignette-ajouter`).

## 9. Suites possibles

Rien n'a été corrigé dans cet audit. Les points 1, 3, 4, 5 et 6 sont des correctifs courts
(quelques lignes de CSS chacun) et vérifiables par la même instrumentation. Le point 2 demande une
décision : rendre la découverte côté serveur, ou afficher un squelette de cartes pendant le
chargement.
