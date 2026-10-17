# Fondations des consoles (refonte, phase 1)

Créées le 15 octobre 2026. Briques communes à la console d'administration (`/system`) et à celle du restaurateur (`/restaurant`).

## Règles
- Classes `sx-*` uniquement, dans `src/app/console-sx.css` : aucune dépendance aux règles globales de `.ad-app` (qui restyle `.btn`, `.card`, `.field`, les cases à cocher à 22 px).
- Jetons de `globals.css` seulement, cibles de 44 px, focus rouge foncé, rien porté par la couleur seule.
- Un `<dialog>` perd son centrage avec `* { margin: 0 }` : `margin: auto` est posé explicitement.
- La logique pure vit dans `src/lib/console/` et est testée (`scripts/tests/console.test.mts`).

## Briques (`src/components/console/`)
- `ConsoleProviders` : monté dans `system/layout.tsx` et `restaurant/(console)/layout.tsx`.
  - `useConfirmation()` : `await confirmer({ titre, message?, libelleAction, danger?, niveau?, libelleMotif?, phrase? })` → `{ confirme, motif? }`.
    Niveaux : `simple` ; `motif` (5 à 300 caractères) ; `saisie` (recopier une phrase). Le focus initial est sur « Annuler », Échap = refus, une seule demande à la fois. Confort d'interface : le serveur revalide toujours.
  - `useNotification()` : `notifier("succes" | "erreur" | "info", message)`. 3 au maximum, une erreur reste plus longtemps et est annoncée (`role="alert"`).
- `Tiroir` : panneau latéral (`<dialog>`), plein écran sur téléphone.
- `FilAriane` : fil d'Ariane (`aria-current="page"` sur le dernier élément).

## Premiers usages
- Taxonomie : suppression avec confirmation nommée + notification ; recherche et lots de 30.
- Éditeur de design : « Tout rétablir » en niveau `saisie` (phrase `RÉTABLIR`).

## Montage et usage (phase 2, 16 octobre 2026)
- `ConsoleProviders` est monté **à la racine** (`src/app/layout.tsx`) : consoles et site public (panier, suivi). Ne pas le remonter dans une console.
- Plus aucun `confirm()` natif. Pour un formulaire (`<form action>`), intercepter l'envoi, demander, puis rejouer avec `requestSubmit()` (un drapeau `useRef`
  laisse passer le second envoi) : voir `FormulaireSuppressionContact.tsx` et `ActionsZoneAttente.tsx`.
- `notifier("succes", …)` après une action réussie ; l'enregistrement d'une ligne de la Géographie utilise `useConfirmationEnregistrement`.

## Recherche rapide et mode service (phase 3)
- `PaletteRecherche` + `BoutonRecherche` (`src/components/console/`), logique pure `src/lib/console/recherche.ts` (sans accents, classement : début de libellé,
  mot du libellé, libellé, famille). Entrées construites côté serveur depuis `groupesNavPourRole` : jamais une page que le menu ne montre pas. Ctrl+K est libre
  dans l'éditeur de pages (`.studio-editeur`), le bouton reste disponible.
- Mode service du restaurateur : `src/components/restaurant/ModeService.tsx`, texte d'état dans `src/lib/alertes/mode-service.ts` (11 contrôles). Règle : ne jamais
  afficher « actif » si la garde d'écran n'est pas réellement accordée, ni sans réseau.
- Listes lourdes : afficher par fenêtres (`ListesGeo.tsx`, historique des commandes avec `limiteHistorique`), jamais toutes les lignes d'un coup.

## Hub « Mon restaurant » (16 octobre 2026)
- `/restaurant/profil` est le **sommaire** des réglages du restaurateur (cinq cartes). Les formulaires sont dans `/restaurant/profil/page-publique` (photo, logo,
  horaires, consignes, paiement, illustrations) et `/restaurant/profil/zones` (quartier, zones de livraison). `/restaurant/affiche`, `/restaurant/documents` et
  `/compte/securite` gardent leurs adresses. Les anciens liens vers `/restaurant/profil` mènent au hub : rien n'est cassé.
- État de chaque carte : `src/lib/restaurant/hub.ts` (pur, 18 contrôles). Une carte n'affiche un état que s'il est calculable (la sécurité n'en a pas et ne compte
  pas dans les tampons). Présentation : `src/components/restaurant/HubVitrine.tsx`, styles `hub-*` dans `console-resto.css` (jetons du design system seulement).
- **Piège** : les actions serveur du profil appelaient `revalidatePath("/restaurant/profil")`, qui ne rafraîchit pas les sous-pages. Elles utilisent maintenant
  `revalidatePath("/restaurant/profil", "layout")`. Toute nouvelle sous-page du profil doit être servie par une action qui revalide l'arbre.
- Le fil d'Ariane (`FilAriane`) est utilisé pour la première fois sur les deux sous-pages. L'entrée « Mon restaurant » du menu reste allumée sur affiche, tables et documents.

## Bloc « Décision » de la fiche restaurant (17 octobre 2026)
- Logique pure et testée : `src/lib/system-admin/decision-restaurant.ts` (`decision()`, 21 contrôles). Elle dit seulement quoi AFFICHER ; le serveur revérifie droits et conditions à chaque action.
- Principe : une seule action principale selon l'état (régler le point qui bloque, approuver, réactiver) ; jamais un bouton grisé sans solution ; « Demander une correction » seulement
  s'il y a un propriétaire à qui écrire ; la suspension reste dans « Plus d'actions ». Chaque point bloquant a son moyen de le régler (`cibleBlocage` : ancres `#equipe`,
  `#administration-restaurant`, `#dossier`).
- Sous 1200 px la décision passe sous le dossier et `BarreDecisionMobile` (barre fixe, masquée quand le bloc est à l'écran, absente quand rien n'est à décider) y mène.
- Piège : `console-b.css` donne le style « carte » (bordure épaisse, ombre) à une liste de classes ; une classe de contenu rangée dans un panneau (`.ad-decision`, `.ad-fiche-synthese`)
  ne doit PAS y figurer, sinon on obtient une carte dans une carte sans remplissage.
- La file « À traiter » du tableau de bord exclut les restaurants `donnees_demo` et sépare les éléments de test (`repartirEnAttente`).

## Page Taxonomie et onglets de sous-sections (17 octobre 2026)
- **Onglets** (`SousNav`, `.ad-onglet`) : `console-b.css` leur imposait bordure épaisse et fond noir (boutons carrés, avec le trait rouge de l'onglet actif resté dessous). Le style souligné d'`admin.css`
  est rétabli pour tous les groupes (Catalogue, Contenu, Accès). Sous 900 px ils se rangent en grille de colonnes égales (2 lignes à 375 px au lieu de 3).
- **Taxonomie** : titre « Taxonomie » (l'ancien « Catalogue » ne disait pas où l'on était), fil d'Ariane, colonnes 1/3 (catégories) et 2/3 (quartiers) dès 1100 px, lignes à plat (nom en gras,
  « Modifier » compact, « Supprimer » en texte rouge), position d'affichage renommée « Position » et plus montrée dans la liste, lien « Géographie » souligné, aucun `style={{…}}` : classes `tx-*` dans `admin.css`.
- **Piège** : `console-b.css` (chargée après `admin.css`) donne à tout `.btn` bordure, ombre et 48 px. Pour alléger un bouton dans une liste, il faut un sélecteur plus précis (`.ad-app .tx-actions .btn.tx-supprimer`),
  et les règles mobiles doivent venir APRÈS les règles de base (à spécificité égale, la dernière gagne).
