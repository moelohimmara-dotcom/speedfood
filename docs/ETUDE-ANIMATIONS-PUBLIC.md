# Étude de faisabilité : animations en boucle et micro-animations du site public

5 octobre 2026. Demande : des variations animées « en boucle infinie » aux endroits stratégiques (accroche d'accueil avec un mot qui change, comme dans les captures fournies), et des micro-animations pour les actions.

## Ce que disent les sources (consultées le 5 octobre 2026)

- **Performance** : seules la transformation (`transform`) et l'opacité sont animées par le compositeur ; le reste (largeur, marges, ombres) déclenche mise en page ou peinture et saccade sur les téléphones modestes. Source : [web.dev, compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count).
- **Accessibilité** : tout mouvement automatique de plus de 5 secondes, présenté avec d'autres contenus, doit pouvoir être mis en pause, arrêté ou masqué ([WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)). Et `prefers-reduced-motion` doit être respecté.
- **Usage** : le mouvement est le plus utile comme retour discret (200 à 500 ms), pas comme décor permanent ; une boucle sans but détourne l'attention ([Nielsen Norman Group](https://www.nngroup.com/articles/animation-purpose-ux/)).
- **Plateformes à succès** : Airbnb a créé Lottie ; Duolingo utilise Rive pour ses personnages ([Rive](https://rive.app/blog/rive-as-a-lottie-alternative)). Ce sont des produits où un personnage animé est l'identité. Ici, l'identité est la rapidité et la confiance (« l'heure le dit »).
- **Poids** : `canvas-confetti` ≈ 8 ko gzip ; `Motion` mini 2,3 ko, hybride 17 ko ; `lottie-web` ≈ 75 ko gzip ([confetti](https://learnwithhasan.com/js-libraries/canvas-confetti/), [Motion](https://motion.dev/docs/react-reduce-bundle-size), [lottie-web](https://depscope.dev/pkg/npm/lottie-web)).

## Contraintes propres à Speedfood

Clients à Conakry sur téléphones d'entrée de gamme, connexions lentes et données coûteuses. Donc : peu de JavaScript, aucune image d'animation à télécharger, rien qui consomme la batterie hors écran.

## Décision

| Besoin | Outil | Poids | Justification |
|---|---|---|---|
| Boucles continues (flottement, halo, pulsation) | CSS pur, `transform`/`opacity` | 0 ko | compositeur, aucune dépendance |
| Mot qui change dans l'accroche | petit composant React + transitions CSS | ~1 ko | texte réel (lisible, indexable), pas une image |
| Pause des boucles (WCAG 2.2.2) | bouton « Animations » + attribut `data-calme` mémorisé | ~1 ko | exigence d'accessibilité |
| Économie de batterie et de données | pause hors écran (IntersectionObserver), onglet caché, `saveData` | ~1 ko | téléphones modestes |
| Micro-retours (ajout, quantité, copie) | CSS + API d'animation du navigateur | 0 ko | 200 à 500 ms, utiles |
| Commande envoyée (pic émotionnel) | `canvas-confetti`, chargé à la demande | ~8 ko, uniquement sur cette page | un seul moment de joie, sobre, une seule fois par commande |

**Écartés** : Lottie et Rive (poids du lecteur + illustrations à faire dessiner, utiles pour une mascotte, pas ici), GSAP (poids, licence, aucun besoin), Motion complet (le CSS suffit pour ces effets ; à reconsidérer pour des gestes ou ressorts physiques).

## Garde-fous

1. Transformation et opacité uniquement ; jamais de largeur/marge en boucle (seule exception : la largeur du mot qui change, sur un élément minuscule).
2. Boucles en pause hors écran, onglet caché, économie de données, ou si le visiteur les a coupées.
3. Aucune boucle sur les pages de saisie (commande, connexion) : l'attention doit rester sur le formulaire.
4. Le texte lu par les lecteurs d'écran reste stable (une phrase complète, pas de mots qui défilent annoncés).
5. Mesure sur processeur ralenti avant déploiement.

## Mise en œuvre (même jour)

- **Socle** : `PilotageAnimations` (pause hors écran, onglet masqué, économie de données, interrupteur « Mettre les animations en pause » dans le pied de page, choix mémorisé).
- **Accueil** : accroche « Une envie de [mot] ? Speedfood s'en occupe. » avec le mot qui change (`MotRoulant`), deux taches de couleur qui dérivent, halo et flèche sur « Je commande », macaron qui flotte. Phrase stable pour les lecteurs d'écran. Le kicker devient « Commande de quartier à Conakry » : la capture disait « Livraison de quartier », mais Speedfood ne livre pas et ne promet aucun délai de livraison (la livraison est celle des restaurants, voir l'aide). Les textes restent modifiables dans les paramètres.
- **Ailleurs** : point vert « ouvert » qui respire, macaron « Promo » qui se balance, frise de suivi dont l'étape en cours bat, chiffre de quantité qui roule, compteur qui apparaît en rebond, pastille de section en rebond.
- **Commande envoyée** : coche, frise et confettis (`canvas-confetti`, chargé à la demande sur cette seule page, une fois par commande).
- Mesure : accueil animé avec processeur 4 fois plus lent : 1 image sur 238 dépasse 50 ms, ≈ 58 images/s.

## Grandes illustrations vectorielles (5 octobre 2026, suite)

Trois illustrations originales en SVG pur (aucune image, aucune licence tierce, couleurs = jetons du design system, style de la direction B) :
`VecteurRestaurateur` (Devenir partenaire : devanture, marmite qui fume, store, téléphone qui reçoit une commande), `VecteurQuartiers` (Quartiers : rue, façades aux couleurs des cartes, repère qui rebondit),
`VecteurParcours` (Comment ça marche : du téléphone à l'assiette, route pointillée, trois étapes qui s'allument tour à tour).
Décoratives (`aria-hidden`), boucles en `transform`/`opacity`, figées hors écran, onglet masqué, économie de données ou interrupteur, coupées en mouvement réduit. Mesure : 60 images/s avec un processeur 4 fois plus lent.
Styles : `src/app/vecteurs.css` ; composants : `src/components/site/vecteurs/`.
