# Refonte design Speedfood — audit et proposition (9 novembre 2026)

## Statut de ce document
**Direction validée par Malika le 9 novembre 2026, avec un amendement : intégrer des animations variées dans tout Speedfood (site, application, consoles), selon la charte de la section 5. Aucun code produit n'est modifié par ce document.** Il ne remplace pas [le design system verrouillé](cadrage/DESIGN-SYSTEM.md) : tant que la direction ci-dessous n'est pas validée, la section 0 de ce document et le code actuel font foi. Méthode : audit délégué à trois subagents en lecture seule (modèle, web, mobile), synthèse par l'orchestrateur. Le modèle a été lu par requêtes HTTP (page et CSS), sans capture navigateur : les faits sont mesurés dans le code source du modèle, le rendu en pixels reste à confirmer visuellement en phase 1.

## 1. Le modèle : ce que Huzzah fait, mesuré
Source : [Huzzah Studio](https://huzzah-studio.modulify.website/) (accueil 200, CSS principale 82 Ko).

- **Fond crème clair** `#FFF8E8` (theme-color), texte prune très foncé `#3C0D25`, carte `#FFFDF7`, bordure `#E6D3BF`.
- **Accents pastel multiples** : jaune beurre `#FFDF6E`, menthe `#BDEFC5`, lavande `#CEC8FF`, pêche `#FFCBA4`, rose `#F8B4CB`, ciel `#BEE1FF`, corail `#FF6A4D`.
- **Typographies** : titres Anton (condensée, majuscules), texte DM Sans, mono Geist Mono (déclarée, peu utilisée sur l'accueil).
- **Signature** : ombres dures décalées sans flou (3 à 10 px, couleur prune), bordures pleines de 2 px, boutons en pilule, cartes à rayon ~2 rem, badges inclinés, séparateurs en vagues, micro-interactions au survol (ombre qui grandit, bouton qui se déplace).
- **Rythme** : sections de 96 à 128 px de haut, conteneur de 72 rem, alternance crème / dégradé pastel / prune foncé, animation de défilement (marquee).

## 2. Ce qu'on reprend, ce qu'on ne copie pas
Repris comme **langage**, reparamétré aux couleurs Speedfood : le rythme éditorial (grandes sections alternées), les ombres franches décalées, les bordures pleines, les cartes généreuses, les badges inclinés avec parcimonie, les micro-interactions sobres des boutons, le duo typographique « titre condensé / texte humaniste ».

Non copiés : le nom, le logo et ses textes ; les images ; la palette nommée du studio (prune/pastel) comme identité ; ses contenus. Les polices Anton et DM Sans ne sont pas adoptées : Speedfood a déjà son duo (Bricolage Grotesque sur le site public, Barlow Condensed, Manrope), proche dans l'esprit et déjà chargé.

## 3. Point de départ Speedfood, mesuré
- **Web** : tokens verrouillés dans `apps/web/src/app/globals.css` — rouge `#D9362B`, rouge foncé `#B82A20`, orange `#FF7A1A`, mangue `#FFC247`, crème `#FFF6ED`, surface `#FFFEFC`, encre `#2B211D`, secondaire `#75695F` (4,99:1 sur crème), bordure `#E9DCD2`, un seul dégradé réservé à l'action principale, rayons 8/14/20/24/999, espacements 4 à 32, focus visible 3 px, cibles ≥ 44 px, mouvement réduit respecté. Le site public autorise déjà, derrière `.theme-public`, les ombres décalées et contours épais (direction B « Marché ») : c'est le point de convergence naturel avec le langage du modèle.
- **Mobile** : mêmes couleurs de base dans `apps/mobile/src/design/tokens.ts`, polices Bricolage et Manrope embarquées. Écarts relevés : pas de tokens d'espacement/rayon/ombre (valeurs en dur par écran), couleur `danger` et dégradé absents, trois composants bouton distincts aux styles proches, aucun respect du mouvement réduit, Barlow absent.
- **Divergences doc/code à corriger un jour** : la section 0 cite `--shadow-focus` alors que le code utilise un contour 3 px ; Manrope 800 chargé mais non documenté ; noms anglais dans la doc contre variables françaises dans le code.

## 4. Direction proposée
Garder l'ADN Speedfood (crème chaud, encre brune, rouge/orange/mangue) et lui donner le **rythme et la franchise du modèle** :

1. **Sections éditoriales** sur le site public : alternance crème / surface / encre foncée, grandes respirations (64 à 96 px), titres Bricolage courts et très hiérarchisés.
2. **Ombres franches généralisées avec discipline** : ombre décalée dure réservée aux cartes mises en avant et aux boutons principaux du site public (déjà autorisé par `.theme-public`), jamais sur les consoles de travail.
3. **Cartes plus généreuses** : rayon 20-24 px sur la découverte, bordure pleine 1,5-2 px encre à faible opacité, photos de plats dominantes.
4. **Badges inclinés** uniquement éditoriaux (nouveauté, catégorie), jamais porteurs d'un statut seul.
5. **Mobile aligné** : mêmes espacements (4-32), rayons et états que le web ; un seul composant bouton ; mouvement réduit respecté ; `danger` ajouté.
6. **Animations partout, chacune avec un rôle** : voir la charte section 5 — variées selon la surface (éditoriale sur le public, fonctionnelle dans l'application, minimale dans les consoles), jamais décoratives en boucle sur un écran de travail.
7. **Inchangés (verrouillés)** : `--secondaire #75695F`, dégradé unique pour l'action principale, focus 3 px, AA, aucun statut par la couleur seule, cibles ≥ 44 px, thème clair unique pour le pilote.

## 5. Animations — charte transverse (amendement validé)

### Principes non négociables
- **Un rôle par animation** : guider l'œil, confirmer une action, expliquer un changement d'état, ou donner le ton éditorial. Aucune animation « pour remplir ».
- **Courtes** : 120 à 300 ms pour l'interface, 450 à 600 ms maximum pour l'éditorial. Aucune animation ne retarde une tâche ni ne bloque une saisie.
- **Mouvement réduit partout** : `prefers-reduced-motion` sur le web (déjà acquis, à étendre aux nouvelles animations) et équivalent natif dans l'application (à ajouter, absent aujourd'hui). En mouvement réduit : apparition instantanée ou fondu simple, aucun défilement animé, aucun défilement automatique.
- **Technique sobre** : transformations et opacité uniquement (pas de propriété qui force un recalcul de mise en page), 60 images/s visées, animations hors écran en pause. Aucune signification portée par le seul mouvement : un statut garde toujours son libellé ou son icône.
- **Pas de boucles sur les écrans de travail** : les mouvements continus (défilement de bande, flottement) sont réservés aux surfaces éditoriales publiques, avec pause au survol et arrêt en mouvement réduit.

### Catalogue par surface
| Surface | Animations retenues | Exclues |
|---|---|---|
| Site public | Entrée éditoriale du hero (titre, visuel, appels à l'action en cascade courte) ; révélation des sections au défilement, une seule fois ; bande défilante des catégories ou zones (marquee lent, pausable) ; survol des cartes (ombre franche qui grandit, léger déplacement) ; accordéons FAQ en hauteur animée ; transitions entre pages sobres | Apparition répétée à chaque défilement, parallaxe lourde, boucles sur les formulaires |
| Application cliente | Transitions d'écrans et de modales cohérentes (glissement/fondu) ; ajout au panier confirmé (pastille qui pulse une fois, badge quantité qui rebondit légèrement) ; squelettes de chargement animés en opacité ; succès de commande (coche dessinée une fois) ; offre livreur qui arrive (carte qui glisse, un seul signal) | Éléments qui flottent en permanence, rebonds élastiques sur les listes de travail |
| Espace restaurateur | Nouvelle commande signalée une fois (badge qui pulse, puis stable) ; transitions d'onglets et de file en fondu court ; retour visuel immédiat des actions accepter/prête/terminée | Marquee, révélation au défilement, tout mouvement continu |
| Espace livreur | Carte d'offre qui glisse à l'arrivée ; bascule de disponibilité confirmée par transition d'état | Pulse répété tant que l'offre attend, compte à rebours animé en continu (l'échéance reste un texte) |
| CMS / système | Fondu court des tableaux et panneaux, surbrillance brève d'une ligne mise à jour | Tout le reste : surface de travail dense |
| Partout | États des boutons (appui, chargement, succès bref), champs en erreur (apparition du message, pas de secousse), focus visible inchangé | Secousse d'erreur, tremblement, clignotement |

### Mise en œuvre par plateforme
- **Web** : animations CSS (déjà la base du dépôt, durées 120/200 ms existantes) et observation d'intersection pour les révélations ; pas de nouvelle bibliothèque sans justification mesurée. Lottie réservé, le cas échéant, à un seul moment éditorial (succès de commande), en fichier local léger — pas d'appel réseau nouveau.
- **Mobile** : transitions React Native existantes harmonisées (modales `slide`/`fade` rendues cohérentes et conditionnées au mouvement réduit), micro-interactions en transformations/opacité ; pas de minuteur d'animation en tâche de fond pendant les courses.
- **Vérification** : chaque phase rejoue ses écrans avec le mouvement réduit activé et sur l'émulateur ; une animation qui gêne une relecture d'écran de contrôle est retirée, pas négociée.

## 6. Illustrations — ensemble par sujet (revu le 9 novembre)

### Existant conservé
- **Web** : bibliothèque de 52 motifs alimentaires (plats, boissons, desserts) et 4 motifs d'étapes dans `apps/web/src/lib/illustrations/`, dessins tiers sous licence MIT figés dans le dépôt, composés par `Illustration.tsx` (pastille, assiette, affiche, monogramme). Ne pas y toucher : un test garde l'identité entre la liste des motifs et les dessins.
- **Mobile** : `IllustrationPlat` (bol, grillade, jus) et 14 icônes fonctionnelles au trait dans `Icone.tsx`.
- **Images** : logo Speedfood (webp et png) et icônes d'application ; `next.svg`/`vercel.svg` dans `apps/web/public` sont des restes du gabarit initial, à retirer lors d'un ménage séparé.

### Manques créés (originaux, conformes à la charte)
Même langage des deux côtés : trait encre épais aux extrémités rondes, aplats aux couleurs verrouillées, fond crème, aucune image externe, aucun emoji, aucun sujet porté par la seule image (libellé toujours présent).

- **Sujets parcours, états et métier** — liste fermée identique web et mobile (`panier`, `sac`, `horloge`, `moto`, `retrait`, `especes`, `compte`, `cloche`, `coeur`, `loupe`, `position`, `telephone`, `etoile`, `toque`, `indisponible`) : `apps/web/src/components/illustrations/sujets.tsx` (SVG serveur) et `apps/mobile/src/design/IllustrationSujet.tsx`.
- **Plats mobiles étendus** : `IllustrationPlat` gagne `poisson`, `salade`, `dessert`, `cafe`, en plus de `bol`, `grillade`, `jus`.

### Règles pour la suite
Tout nouveau sujet entre dans la liste fermée des deux plateformes en même temps, dessiné dans ce langage, avec un nom accessible. Les photos réelles de plats restent la norme dès qu'elles existent ; l'illustration signale alors un visuel de démonstration, comme aujourd'hui. La relecture en pixels des nouveaux sujets se fera avec les captures des phases 1 et 2 (site et banc natif) ; à ce stade, seuls les types sont vérifiés (web et mobile, code 0).

## 7. Tokens proposés (à figer après validation)
Les couleurs de marque, surfaces, états et espacements actuels sont conservés tels quels. Ajouts proposés : une échelle neutre chaude complète (exigée pour les fonds et bordures intermédiaires), dérivée de l'encre :

<!-- STITCH_TOKENS_START -->
```json
{
  "colors": {
    "primary": "#D9362B",
    "primary-deep": "#B82A20",
    "accent": "#FF7A1A",
    "mango": "#FFC247",
    "background": "#FFF6ED",
    "surface": "#FFFEFC",
    "surface-alt": "#FFFAF3",
    "ink": "#2B211D",
    "muted": "#75695F",
    "border": "#E9DCD2",
    "success": "#2E7D32",
    "danger": "#C62828",
    "warning-text": "#8A4B00",
    "neutral": {
      "50": "#FAF4ED", "100": "#F3E8DB", "200": "#E9DCD2", "300": "#DCC6B3",
      "400": "#B99F88", "500": "#75695F", "600": "#5D5049", "700": "#4A4039",
      "800": "#38291F", "900": "#2B211D"
    }
  },
  "typography": {
    "display-public": "Bricolage Grotesque 700/800",
    "display": "Barlow Condensed 700/800",
    "text": "Manrope 400/500/600/700/800",
    "body-min-px": 15,
    "caption-min-px": 12
  },
  "spacing": [4, 8, 12, 16, 20, 24, 32],
  "radius": { "sm": 8, "md": 14, "lg": 20, "xl": 24, "pill": 999 },
  "motion": { "fast-ms": 120, "base-ms": 200, "ui-max-ms": 300, "editorial-max-ms": 600, "easing": "cubic-bezier(0.2, 0.7, 0.3, 1)", "properties": ["transform", "opacity"], "reduced-motion": "respecte partout, web et mobile" }
}
```
<!-- STITCH_TOKENS_END -->

## 8. Plan par phases
- **Phase 0 — validation** : direction validée le 9 novembre avec la charte animations (section 5). Restent possibles : relecture visuelle du modèle ensemble, amendements de détail.
- **Phase 1 — site public : faite le 9 novembre 2026 (locale, non déployée).** Échelle neutre chaude ajoutée à `globals.css` (les textes restent sur `--encre`/`--secondaire` verrouillés ; `--neutre-400` à 2,35:1 est décoratif seulement) et plafond `--duration-editoriale: 600ms`. Dans `public-mouvement.css` : révélations ramenées de 0,7 s au plafond de la charte, entrée du hero en cascade courte, survol des cartes restaurants (soulèvement + ombre franche `--pub-ombre`), bandeau défilant pausable au survol, le tout neutralisé en mouvement réduit. Constats au passage : l'essentiel du langage (ombres franches, marquee, révélations, ticket animé, squelettes) existait déjà dans la direction B ; cette phase l'aligne et le complète, elle ne le remplace pas. Contrastes recalculés par exécution : encre/crème 14,69:1, secondaire/crème 4,99:1, blanc sur le dégradé 4,56 à 6,19:1, encre/mangue 9,76:1 — AA confirmés. Captures relues (accueil avec données réelles, état final et mouvement réduit) hors dépôt : `C:/Users/moelo/dev/refonte-phase1-20261109/`. Portes : typecheck racine et cloisonnement (489) code 0 ; page d'accueil servie en 200 par le serveur de développement.
- **Phase 2 — application : première tranche faite le 9 novembre 2026 (locale).** `tokens.ts` mobile aligné sur le site (espacements 4-32, rayons 8-999, durées 120/200/300/600, `danger` et désactivé ajoutés, couleurs verrouillées inchangées) avec `dureeMouvement` testé (554 tests mobiles, types 0) ; mouvement réduit natif lu par `useMouvementReduit` (réglage système, absent auparavant) ; carte d'offre du livreur entrant par un glissement unique de 300 ms, posé d'emblée en mouvement réduit. Restent dans cette phase : bouton unique (trois composants coexistent), squelettes et confirmations panier/succès, relecture au banc natif.
- **Phase 3 — consoles** : restaurateur et système gardent leur calme utilitaire ; alignement des tokens, des états et des seules animations fonctionnelles de la charte, pas d'effets éditoriaux.

## 9. Limites de cet audit
Le modèle n'a pas été observé en pixels (lecture HTTP seule) ; les ratios de contraste cités pour Speedfood sont ceux documentés, à recalculer en phase 1 ; les graisses réelles des polices embarquées mobiles n'ont pas été inspectées au-delà de leur présence. Aucune de ces limites ne bloque la validation de la direction ; elles bornent ce qui pourra être affirmé ensuite.
