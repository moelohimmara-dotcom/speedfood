# Design system — Speedfood

**Version :** 0.2 — réconcilié avec le code (3 octobre 2026)  
**Produit :** portail client, PWA, console restaurant et CMS système  
**Statut des décisions :** palette, typographie et icônes retenues. Les **tokens et règles de la section 0 sont verrouillés** : ils sont déjà implémentés dans `src/app/globals.css` et `src/app/components.css` et ne se redéfinissent pas ailleurs. Le reste (composants, formes) est une direction proposée à éprouver ; en cas d'écart avec le code, **le code et la section 0 font foi** tant que le propriétaire n'a pas validé un changement.

## 0. Règles verrouillées et déjà implémentées (priment sur le reste du document)

- **Texte secondaire : `--secondaire` = `#75695F`** (4,99:1 sur fond crème). L'ancienne valeur `#80736C` donnait 4,29:1, sous la norme AA de 4,5:1 : **ne pas y revenir**. Dans le tableau de la section 2, `muted` désigne ce même jeton.
- **Un seul dégradé** : `--gradient-marque` (`linear-gradient(135deg, #FF7A1A 0%, #D9362B 60%)`), réservé exclusivement à l'action principale d'un écran (bouton principal, barre de panier flottante). Toute autre surface (logos, avatars, cartes, accents de marque d'un restaurant) est un aplat.
- **Couleurs par catégorie de restaurant** (aplats) : Riz & sauces → `--rouge`; Grillades → `--orange`; Fast-food → `--mangue`; Petit-déjeuner → `--encre`.
- **Formes** : `--radius-pill` (999 px) est utilisé pour les boutons, chips et barres d'onglets, jamais pour un conteneur dont le contenu peut passer à la ligne. Cartes en `--radius-md`/`--radius-lg`. Le bouton secondaire est blanc à bordure fine (la section 6 propose un secondaire orange : non retenu à ce jour).
- **Accessibilité (acquis à ne pas perdre)** : contraste AA vérifié ; focus clavier visible partout (`--shadow-focus`) ; `aria-pressed` sur les bascules à deux états ; cibles tactiles ≥ 44 px sur les actions fréquentes ; `prefers-reduced-motion` respecté ; aucun statut porté par la couleur seule.
- **Polices** : Barlow Condensed et Manrope, chargées par `next/font` (auto-hébergées au build, sans requête vers un fournisseur à l'exécution).

## 1. Direction visuelle

### « Énergique, chaleureux et net »

Speedfood doit avoir de l’énergie grâce au rouge et à l’orange, rappeler la cuisine grâce au fond crème, et rester facile à lire dans les tâches répétitives du restaurant et du CMS. Le style proposé est franc et éditorial, avec des surfaces simples, des photos de plats généreuses, des titres compacts et des actions très visibles.

À éviter : une interface entièrement saturée, des dégradés décoratifs partout, des ombres lourdes, des cartes en forme de pilule et des illustrations emoji pour les contrôles. Les accents de marque attirent l’œil vers les actions; ils ne remplacent pas la hiérarchie, le texte ou les états.

## 2. Couleurs retenues

| Jeton | Valeur | Usage |
|---|---|---|
| `brand-red` | `#D9362B` | Marque, navigation active, actions principales |
| `brand-orange` | `#FF7A1A` | Accent visible, promotion, mise en évidence, action secondaire |
| `brand-mango` | `#FFC247` | Petit accent, nouveauté, élément éditorial |
| `page` | `#FFF6ED` | Fond global clair |
| `surface` | `#FFFEFC` | Cartes, panneaux, formulaires |
| `ink` | `#2B211D` | Texte principal et texte sur fond orange |
| `muted` (`--secondaire`) | `#75695F` | Texte secondaire, métadonnées (AA vérifié — voir section 0) |
| `border` | `#E9DCD2` | Séparateurs et contours discrets |

### Règles d’usage

- Réserver les grands aplats rouges aux actions principales, à la navigation active et aux moments de marque.
- Utiliser l’orange pour attirer l’attention; privilégier un texte brun foncé sur l’orange. Ne pas utiliser du texte blanc sur orange vif pour les petites tailles.
- Garder la majorité du CMS sur fond crème/blanc, avec rouge pour l’action principale et orange pour les accents. Le CMS doit rester calme même si la marque est vive.
- Les couleurs d’état sont distinctes de la palette de marque : succès vert, avertissement ambre, erreur rouge foncé, information bleu. Chaque état inclut toujours un libellé ou une icône; jamais la couleur seule.
- Vérifier contraste du texte, focus visible et distinction des états dans les implémentations; les références de couleur ne remplacent pas une vérification d’accessibilité.

## 3. Typographie retenue

### Barlow Condensed + Manrope

- **Barlow Condensed 700/800** : logotype Speedfood, grands titres de page, chiffres promotionnels et accroches courtes. Éviter pour les paragraphes et les textes de formulaire.
- **Manrope 400** : paragraphes, descriptions de plats, texte d’aide.
- **Manrope 500/600** : navigation, libellés, prix, badges et éléments secondaires importants.
- **Manrope 700** : boutons principaux, titres de carte courts et indicateurs clés.
- Activer les chiffres tabulaires pour prix, heures et tableaux quand pris en charge.
- Interface courante : corps 15–16 px; légendes et métadonnées ne descendent pas sous 12 px; CMS préfère 14–16 px pour le texte de travail.
- Titres : Barlow Condensed avec interlignage serré; limiter les capitales aux titres très courts et ne pas convertir les libellés d’action en majuscules.
- Prévoir le sous-ensemble Latin étendu pour les accents français et une pile de secours sans empattement.

Spécimens : [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) et [Manrope](https://fonts.google.com/specimen/Manrope). Les fichiers de polices et leur stratégie de chargement seront choisis pendant le bloc de développement frontend; ne pas faire dépendre l’interface d’une connexion à un fournisseur de polices.

## 4. Icônes — choix retenu

### Trait linéaire arrondi, régulier et accompagné de libellés

**Choix validé :** système d’icônes au trait arrondi.

Utiliser une famille unique d’icônes SVG au trait, sur une grille 24 × 24, épaisseur visuelle autour de 1,75–2 px, terminaisons arrondies et formes simples. Taille standard 20 px pour les contrôles, 24 px pour la navigation; 16 px seulement pour les métadonnées secondaires. Les icônes de navigation et de statut ont un libellé visible ou une alternative accessible.

- **Portail client :** recherche, localisation, filtres, panier, horaires, téléphone, retrait/livraison, favoris.
- **Console restaurant :** accueil, commandes, menu, disponibilité, horaires, établissement, aide.
- **CMS système :** établissements, contenu, taxonomie, commandes/support, audit, comptes/accès, recherche et filtres.
- Les icônes décoratives peuvent recevoir l’accent rouge/orange; les pictogrammes fonctionnels restent généralement monochromes pour la cohérence.
- Ne pas utiliser emoji, caractères unicode ou icônes improvisées comme icônes de contrôle en production.
- Les photos et illustrations de plats sont des médias de contenu, pas une partie du système d’icônes.

## 5. Formes, espacements et surfaces

- Grille d’espacement de base : multiples de 4 px, avec 8 px comme pas courant.
- Champs, boutons et cartes : rayon 8–12 px. Grandes zones : 12–16 px. Éviter le rayon maximal sauf pour les filtres/chips.
- Contours fins et ombres très légères; la structure vient d’abord des espacements, de la couleur de surface et de la typographie.
- Cible tactile minimale de 44 × 44 px pour les commandes fréquentes; espacement suffisant entre actions accepter/refuser.
- Mise en page mobile-first et contrôles restaurateur utilisables d’une main.

## 6. Composants

### Boutons

| Variante | Aspect | Usage |
|---|---|---|
| Principal | Rouge piment, texte blanc, icône optionnelle | Commander, confirmer, publier |
| Secondaire | Orange mandarine, texte brun foncé | Découvrir, action mise en avant non destructive |
| Neutre | Fond blanc/crème, bordure fine, texte encre | Annuler, retour, réglage secondaire |
| Destructif | Rouge plus sombre, libellé explicite, confirmation si irréversible | Refuser/annuler, suspendre |

Chaque bouton a repos, hover, focus clavier, actif, chargement et désactivé. Une action ne se présente jamais comme réussie avant le retour du serveur.

### Champs et formulaires

- Label visible au-dessus du champ; placeholder uniquement comme exemple, jamais comme seul label.
- Erreur placée près du champ, formulée comme correction à faire; conserver les valeurs valides déjà saisies.
- Grouper les formulaires de menu en petits blocs : nom/prix, description, disponibilité.
- Pas de validation qui efface un formulaire entier; afficher les limites et le format attendu.

### Cartes restaurant et plat

- Surface blanche chaude, image/photo en haut, rayon modéré et contour discret.
- Présenter nom, cuisine, zone et état ouvert/fermé dans un ordre stable; prix sans concurrence visuelle avec le nom.
- Badge utilise icône et texte. Favoris est un bouton accessible nommé.
- Les visuels de plats doivent être réels et autorisés avant lancement; pas de faux avis ou de contenu fictif présenté comme réel.

### États de commande

- File restaurant organisée par urgence : **À traiter**, **En préparation**, **Terminées**.
- Une commande en attente de décision client affiche un badge dédié **Accord du client requis** et bloque l’action « Préparer ».
- Accepter/refuser sont visuellement séparés et expliquent leur effet; proposer une révision ouvre un formulaire expliquant total, frais, délai, zone et échéance.
- La page de suivi client compare côte à côte **Votre demande** / **Nouvelle proposition** et offre les boutons distincts **Accepter la proposition** / **Refuser et annuler**.

### CMS et tableaux

- Fond calme et navigation latérale sur grand écran; navigation compacte sur petit écran.
- Tableaux avec recherche, filtres, en-têtes stables, cellules bien espacées et actions regroupées par ligne.
- Publication, suspension et attribution de rôle sont des actions confirmables avec motif lorsqu’exigé.
- Données personnelles masquées par défaut dans les outils support.

## 7. Déclinaison par espace

- **Portail client :** plus chaleureux et éditorial; rouge/orange visibles dans la découverte, les catégories et l’action de commande; photographie de repas dominante.
- **Console restaurant :** ultra claire et utilitaire; file de commandes d’abord; actions courantes accessibles depuis l’accueil; Barlow réservé aux titres; Manrope domine l’interface.
- **CMS système :** même identité, mais faible surface saturée; navigation par rôle; listes et outils efficaces; états de publication très explicites.

## 8. Points à valider avant de figer les maquettes

1. Les photos réelles sont-elles disponibles pour l’onboarding pilote; qui les fournit et les modère ?
2. Le CMS est-il surtout utilisé sur ordinateur, ou faut-il optimiser toutes les tâches système pour mobile ?
3. Les rayons, tailles de boutons, densité des cartes et organisation du tableau restaurant conviennent-ils lors d’une revue de maquette ?

Palette, typographie et icônes sont les choix confirmés. Les composants ci-dessus constituent la direction de départ; ajuster leurs détails lors d’une revue visuelle avec le portail client, la console restaurant et le CMS.

## Addendum direction artistique — Speedfood découverte (3 octobre 2026)

La palette, les polices et les icônes validées restent inchangées. `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` fixe leur application : portail client de type magazine gourmand local, photos authentiques compressées, recherche et filtres en capsules, statut « Disponible maintenant » très lisible; page restaurant comme mini-vitrine partageable; console restaurant calme et actionnelle; CMS dense, professionnel et distinct.

Rouge/orange sont réservés aux actions, accents et états où leur signification est définie; fonds principaux crème/blanc chaud. Les statuts ne reposent jamais uniquement sur la couleur. Pas de notes, compteurs de popularité ou badges non justifiés. Les alternatives « exact », « équivalent » et « suggestion » ont des libellés visuels distincts. Animation courte et réduite selon préférence système; pas de vidéo lourde ni de photo bloquant le contenu.

## Addendum — notifications et iconographie gourmande (3 octobre 2026)

Le jeu fonctionnel reste un trait arrondi régulier; Lucide SVG est candidat pour recherche, panier, localisation, horloge, partage, cœur et cloche. Pour donner à Speedfood une signature plus gourmande, créer en complément une petite famille de 8–12 icônes/illustrations SVG originales (marmite, bol, brochette, bissap, plantain, piment, jus, menu du jour), avec mêmes proportions et accents rouge/orange/mangue. Ce ne sont pas des substituts aux photos réelles. Les boutons conservent libellé texte; aucune signification ne dépend de l’emoji ou de la couleur seule.

Distinguer toast de succès/erreur, dialogue de confirmation, centre in-app et Web Push système. Les règles de style, accessibilité, fréquence et événements autorisés sont dans `NOTIFICATIONS-ICONES-OUTILS.md`. La démo actuelle a déjà un toast HTML à améliorer; ne pas ajouter une dépendance React tant que le dépôt n’a pas migré vers React.
