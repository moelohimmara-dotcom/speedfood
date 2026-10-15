# Inventaire de la console super admin (`/system`)

Lecture seule. Aucun fichier du dépôt modifié. Périmètre : `src/app/system/`, `src/components/admin/`, `src/lib/system-admin/permissions.ts`, `src/app/admin.css`, `src/app/console.css`, `src/app/console-b.css`, `src/app/fantaisie.css` (règles `.ad-app`).

## 1. Carte des routes

27 fichiers `page.tsx`. « Garde » = fonction appelée dans la page. `exigerPermissionPage` renvoie 404 si refus ; `obtenirContexteSysteme` ne vérifie que la présence d'un rôle système.

| Route | Titre (metadata) | Garde | Lignes | Composants client du même dossier |
|---|---|---|---|---|
| `/system` | Tableau de bord | `obtenirContexteSysteme` (tout rôle) | 607 | SousNav (racine) |
| `/system/acces` | redirection vers `/system/acces/comptes` | aucune | 6 | — |
| `/system/acces/comptes` | Comptes (administration) | `compte.consulter` | 233 | SelectionGroupee, SuppressionCompte |
| `/system/acces/paliers` | Habilitations (administration) | `systeme.roles` | 200 | FormulaireAttributionPalier, RetraitPalier |
| `/system/acces/roles` | Rôles système (administration) | `systeme.roles` | 66 | FormulaireAttributionRole, RoleItem |
| `/system/audit` | Journal d'audit (administration) | `systeme.audit` | 110 | FiltresJournal |
| `/system/catalogue` | redirection vers `/restaurants` | aucune | 6 | — |
| `/system/catalogue/couverture` | Couverture (administration) | `taxonomie.editer` | 137 | — |
| `/system/catalogue/geographie` | Géographie (administration) | `taxonomie.editer` | 136 | Formulaires, LienElement, ListesGeo, OutilsGeo (+ PanneauQualite serveur) |
| `/system/catalogue/liste-attente` | Liste d'attente (administration) | `attente.gerer` | 82 | ActionsZoneAttente, FormulaireSuppressionContact |
| `/system/catalogue/mises-en-avant` | Mises en avant (administration) | `contenu.mettre_en_avant` | 67 | FormulaireNouvelleMiseEnAvant, MiseEnAvantItem |
| `/system/catalogue/restaurants` | Restaurants (administration) | `restaurant.moderer` | 137 | GenererIllustrations |
| `/system/catalogue/restaurants/[id]` | Fiche restaurant (administration) | `restaurant.moderer` | 417 | ActionsModeration, EditeurHoraires, EditeurProfilRestaurant, EditeurQuartierRestaurant, GestionEquipe |
| `/system/catalogue/taxonomie` | Taxonomie (administration) | `taxonomie.editer` | 33 | ListeTaxonomie |
| `/system/commandes` | Support commandes (administration) | `commande.consulter` | 178 | — |
| `/system/commandes/[id]` | Commande (administration) | `commande.consulter` | 171 | ActionSupportStatut, RevelerCoordonnees |
| `/system/contenu` | redirection vers `/bannieres` | aucune | 6 | — |
| `/system/contenu/bannieres` | Bannières (administration) | `contenu.editer` | 82 | BanniereItem, FormulaireNouvelleBanniere |
| `/system/contenu/medias` | Médias (administration) | `contenu.editer` | 62 | — |
| `/system/contenu/pages` | Pages (administration) | `contenu.editer` | 148 | CreerAccueilBlocs, FormulaireNouvellePageBlocs, SupprimerPage |
| `/system/contenu/pages/[id]` | Édition d'une page (administration) | `contenu.editer` | 86 | BasculerPublicationPage, EditeurPage |
| `/system/contenu/pages/[id]/blocs` | Éditeur de page (administration), noindex | `contenu.editer` | 37 | — (composant rendu hors dossier : à vérifier) |
| `/system/contenu/textes` | Textes du site (administration) | `contenu.editer` | 69 | GroupeTextes |
| `/system/design` | Design (administration) | `parametres.editer` | 80 | EditeurJetons, PanneauHistorique (+ design.css) |
| `/system/mises-a-jour` | Mises à jour (administration) | `parametres.editer` | 88 | InterrupteurFonctionnalite |
| `/system/parametres` | Paramètres (administration) | `parametres.editer` | 43 | FormulaireParametres |
| `/system/parametres/reinitialisation` | Réinitialisation de l'application | `parametres.editer` | 55 | FormulaireReinitialisation |

Bilan des gardes : 23 pages avec `exigerPermissionPage`, 1 avec `obtenirContexteSysteme` seul (tableau de bord), 3 redirections sans garde. Les deux routes `route.ts` d'export (`catalogue/geographie/export`, `catalogue/liste-attente/export`) contrôlent `roleAPermission` (taxonomie.editer, attente.gerer) et renvoient 404 si refus.

Le layout (`src/app/system/layout.tsx`, 103 lignes) appelle `obtenirContexteSysteme` à chaque rendu.

## 2. Navigation

Source : `GROUPES_SYSTEME` (permissions.ts) et `AdminNav` (composant client en tiroirs). Icône de famille = segment de l'adresse de la première entrée. Le lien « Tableau de bord » est codé en dur dans `AdminNav`, sans permission.

| Famille (icône) | Entrée | Permission | Page |
|---|---|---|---|
| Tableau de bord (tableau) | `/system` | aucune (tout rôle) | oui |
| Catalogue (catalogue) | Restaurants | restaurant.moderer | oui |
| | Taxonomie | taxonomie.editer | oui |
| | Géographie | taxonomie.editer | oui |
| | Couverture | taxonomie.editer | oui |
| | Liste d'attente | attente.gerer | oui |
| | Mises en avant | contenu.mettre_en_avant | oui |
| Contenu (contenu) | Pages | contenu.editer | oui |
| | Bannières | contenu.editer | oui |
| | Médias | contenu.editer | oui |
| | Textes du site | contenu.editer | oui |
| Commandes (commandes) | Support commandes | commande.consulter | oui |
| Accès (acces) | Comptes utilisateurs | compte.consulter | oui |
| | Rôles système | systeme.roles | oui |
| | Habilitations | systeme.roles | oui |
| Paramètres (parametres) | Paramètres | parametres.editer | oui |
| | Design | parametres.editer | oui |
| | Mises à jour | parametres.editer | oui |
| Audit (audit) | Journal d'audit | systeme.audit | oui |

Total : 18 entrées de famille plus le tableau de bord (19 liens). Toutes les entrées ont une page. Les icônes présentes existent toutes dans `icones.tsx` (tableau, catalogue, contenu, commandes, acces, parametres, audit).

**Sous-navigation `SousNav`** (onglets, masquée si moins de 2 entrées visibles) :
- Catalogue : 6 entrées, présente sur les 6 pages du groupe (couverture, geographie, liste-attente, mises-en-avant, restaurants, taxonomie). Les pages `restaurants/[id]` n'en ont pas.
- Contenu : 4 entrées, présente sur bannieres, medias, pages, textes.
- Accès : 3 entrées, présente sur comptes, paliers, roles.
- Paramètres : 3 entrées, présente sur design, mises-a-jour, parametres.
- Commandes et Audit : une seule entrée, pas de `SousNav`.

**Pages sans entrée de navigation** :
- `/system/catalogue/restaurants/[id]`, `/system/commandes/[id]`, `/system/contenu/pages/[id]`, `/system/contenu/pages/[id]/blocs` : pages dynamiques, atteintes par liens.
- `/system/parametres/reinitialisation` : atteinte par un lien depuis `/system/parametres`, absente de `GROUPES_SYSTEME`.
- `/system/acces`, `/system/catalogue`, `/system/contenu` : redirections, sans entrée.

**Entrées sans page** : aucune.

## 3. Sections visibles par rôle

Calculé à partir de la matrice `PERMISSIONS_PAR_ROLE` et de `GROUPES_SYSTEME`. Le tableau de bord est visible par les quatre rôles.

| Rôle | Catalogue | Contenu | Commandes | Accès | Paramètres | Audit | Total entrées |
|---|---|---|---|---|---|---|---|
| super_admin | les 6 | les 4 | Support commandes | les 3 | les 3 | Journal | 18 |
| operations | Restaurants, Liste d'attente, Mises en avant | aucune (groupe masqué) | aucune | Comptes utilisateurs | aucune (groupe masqué) | Journal | 5 |
| content_editor | Taxonomie, Géographie, Couverture | les 4 | aucune | aucune (groupe masqué) | aucune (groupe masqué) | Journal | 8 |
| support | aucune (groupe masqué) | aucune (groupe masqué) | Support commandes | aucune (groupe masqué) | aucune (groupe masqué) | Journal | 2 |

Pour `operations`, la SousNav « Catalogue » affiche 3 onglets. Pour `content_editor`, « Catalogue » en affiche 3 et « Contenu » en affiche 4.

## 4. Composants partagés (`src/components/admin/` et blocs de `src/app/system/`)

Décompte : fichiers qui importent le composant. « Pages » = `page.tsx`, « comp. » = composants client ou serveur d'un dossier.

| Composant | Fichier | Rôle | Utilisation |
|---|---|---|---|
| PageHeader | blocs.tsx | En-tête de page (titre et description) | 23 pages |
| Panneau | blocs.tsx | Groupe encadré de contenu | 18 pages, 4 comp. |
| EtatVide | blocs.tsx | Message d'état vide | 11 pages, 1 comp. |
| Pastille | blocs.tsx | Pastille d'état textuelle | 13 pages, 5 comp. |
| Volet | blocs.tsx | Tiroir repliable (natif `details`) | 3 pages |
| Tuile | blocs.tsx | Tuile de chiffre clé | 4 pages |
| CarteChiffre | blocs.tsx | Grande carte de chiffre clé | 3 pages |
| SousNav | src/app/system/SousNav.tsx (client) | Onglets de sous-sections filtrés | 16 pages |
| AdminNav | components/admin/AdminNav.tsx (client) | Navigation latérale en tiroirs | 1 (layout) |
| AdminMenuMobile | components/admin/AdminMenuMobile.tsx (client) | Tiroir de navigation mobile (`dialog`) | 1 (layout) |
| BarreEnregistrement, useSuiviModifications | components/admin/BarreEnregistrement.tsx (client) | Barre d'enregistrement collante et suivi des modifications | 1 (FormulaireParametres) |
| IconeAdmin | components/admin/icones.tsx | Icône décorative (16 clés) | 2 pages (layout, tableau de bord), 4 comp. |
| CarteCouverture | components/admin/CarteCouverture.tsx | Carte à points par commune | 1 (couverture) |
| graphiques (GraphiqueBarresJours, GraphiqueHeures, Anneau, Tendance, Variation, Legende, BarresHorizontales) | components/admin/graphiques.tsx | Graphiques SVG/HTML du tableau de bord | 1 (tableau de bord) |

Note : `blocs.tsx` n'exporte que des composants d'affichage (PageHeader, Panneau, Tuile, EtatVide, Pastille, Volet, CarteChiffre).

## 5. Blocs par page

x = présent dans `page.tsx` ou dans un composant du même dossier. « .ad-table » est détecté par la sous-chaîne `ad-table` (inclut `ad-table-cadre` : à vérifier au cas par cas). Pour le tableau de bord, le formulaire vient du layout (déconnexion), pas de la page.

| Page | PageHeader | SousNav | Panneau | Volet | .ad-table | Formulaire | Dialogue | EtatVide |
|---|---|---|---|---|---|---|---|---|
| /system (tableau de bord) | x | | x | x | | (layout) | | x |
| /system/acces | | | | | | | | |
| /system/acces/comptes | x | x | | | x | x | x | x |
| /system/acces/paliers | x | x | x | | x | x | | x |
| /system/acces/roles | x | x | x | | x | x | | x |
| /system/audit | x | | | | x | x | | x |
| /system/catalogue | | | | | | | | |
| /system/catalogue/couverture | x | x | x | | | | | x |
| /system/catalogue/geographie | x | x | x | x | | x | | |
| /system/catalogue/liste-attente | x | x | x | | x | x | | x |
| /system/catalogue/mises-en-avant | x | x | x | | x | x | | x |
| /system/catalogue/restaurants | x | x | | | x | x | | x |
| /system/catalogue/restaurants/[id] | x | | x | x | | x | x | |
| /system/catalogue/taxonomie | x | x | x | | | x | | |
| /system/commandes | x | | | | x | x | | x |
| /system/commandes/[id] | x | | x | | | x | | |
| /system/contenu | | | | | | | | |
| /system/contenu/bannieres | x | x | x | | | x | | |
| /system/contenu/medias | x | x | | | | | | |
| /system/contenu/pages | x | x | x | | x | x | | x |
| /system/contenu/pages/[id] | x | | x | | | x | | |
| /system/contenu/pages/[id]/blocs | | | | | | | | | 
| /system/contenu/textes | x | x | x | | | x | | |
| /system/design | x | x | x | | | x | | |
| /system/mises-a-jour | x | x | x | | | x | | |
| /system/parametres | x | x | x | | | x | | |
| /system/parametres/reinitialisation | x | | x | | | x | | |

Dialogues : `comptes` (SelectionGroupee, SuppressionCompte, `dialog.ad-dialogue`) et `restaurants/[id]` (ActionsModeration). `AdminMenuMobile` utilise aussi un `dialog` (layout).

Pages dont les blocs n'ont pas été vérifiés (à vérifier) : `contenu/pages/[id]/blocs` (37 lignes, aucun composant local détecté).

## 6. Feuilles CSS

| Fichier | Lignes | Lignes commençant par `.ad-` (approx.) | Classes `.ad-` distinctes | Lignes avec `.ad-app` |
|---|---|---|---|---|
| src/app/admin.css | 2598 | ~352 | 202 | 14 |
| src/app/console.css | 845 | 0 | 0 | 0 |
| src/app/console-b.css | 342 | ~114 | 53 | 115 |
| src/app/fantaisie.css | 440 | ~22 | 11 | 45 |

`console.css` ne contient aucune règle `.ad-`. Il sert au cadre `.console-cadre` (à vérifier son usage exact hors périmètre).

### Règles globales qui s'appliquent à `.ad-app` (risque de conflit avec de nouveaux composants)

Ces règles portent sur des éléments HTML ou des noms de classe génériques, pas seulement sur `.ad-*`.

| Fichier : lignes | Sélecteur (simplifié) | Effet | Risque |
|---|---|---|---|
| fantaisie.css : 248-252 | `:is(.theme-public, .ad-app) input[type=checkbox/radio]` | Cases et boutons radio 22 × 22 px, couleur d'accentuation | Toute case de l'application, y compris dans un nouveau formulaire |
| fantaisie.css : 254-260 | `label:has(> input[checkbox/radio]):not(.option-supplement, .choix-carte)` | Libellé en flex, hauteur minimale 44 px, espace 10 px | Tout libellé qui enveloppe une case ; seules deux classes sont exclues |
| fantaisie.css : 289-291 | `input[checkbox/radio]:checked` | Animation de rebond `coche-pop` | Faible |
| fantaisie.css : 327-340 | `details[open] > :not(summary)`, alertes `.alerte-danger[role=alert]`, `.alerte-succes`, `.alerte-info` | Animation d'apparition (tous les Volets et `details`) | Faible |
| fantaisie.css : 342-361 | `.ad-dialogue[open]`, `.ad-tiroir[open]` (et leurs `::backdrop`) | Animation et fond | Moyen si un nouveau `dialog` utilise d'autres classes |
| fantaisie.css : 148-232, 398 | `:is(.theme-public, .ad-app) input[type=file]` et `::file-selector-button` | Style complet des champs fichier | Le site public partage ce style |
| fantaisie.css : 277-280 | `.ad-app .ad-aide-champ` | Marge haute 8 px | Faible |
| fantaisie.css : 375-378 | `.rc-bas-item.actif::before`, `.ad-nav-lien.actif` | Animations de navigation | Faible |
| console-b.css : 10-17 | `.ad-app` (variables `--pub-*`, `--font-titre`) | Variables de cadre | Faible |
| console-b.css : 18-29 | `.ad-app :is(h1, h2, h3)` et `.ad-entete-page h1` | Police de titre, tailles | Tout titre de la console |
| console-b.css : 35-40 | `.ad-app :is(.ad-panneau, .ad-tuile, .ad-carte, .card, .ad-volet, .ad-fiche-synthese, .ad-table-cadre, .ad-decision, .ad-dialogue)` | Bordure 2,5 px, ombre décalée, fond surface | Un nouvel élément de classe `.card` ou `.ad-carte` hérite du cadre |
| console-b.css : 56-90 | `.ad-app .btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` | Bordure, ombre, graisse 800 | La classe `.btn` est générique |
| console-b.css : 92-96 | `.ad-app .field :is(input, select, textarea)` | Bordure 2 px, rayon 14 px, fond | **Sans exclusion** : une case dans un `.field` reçoit ce style (à vérifier visuellement) |
| console-b.css : 92-99 | `.ad-app :is(.field, .ad-formulaire, .ad-filtres, .ad-recherche) :is(input, select, textarea)` | Bordure et fond des champs | La première ligne exclut les cases, la seconde non |
| console-b.css : 98-100 | `... :is(input, select, textarea):focus` | `outline: none` et ombre décalée | **Sans exclusion de case** : une case dans `.ad-formulaire` peut perdre son anneau de focus (à vérifier, accessibilité) |
| console-b.css : 105-107 | `.ad-app :is(.badge, .ad-pastille, .rc-pastille)` | Bordure 2 px | Faible |
| console-b.css : 108-111 | `.ad-app .alerte`, `.ad-app .ad-bandeau` | Bordure et rayon | Faible |
| console-b.css : 113-121 | `.ad-app .ad-onglet` et état `actif`/`aria-current` | Bordure, fond encre à l'état actif | Faible |
| console-b.css : 123-125 | `.ad-app .ad-table thead th` | Filet inférieur | Faible |
| console-b.css : 194-207 | `.ad-app .ad-contenu > *` et grilles | Délais d'animation sur tous les enfants directs | Faible |
| console-b.css : 128-181 | `.ad-marque`, `.ad-nav-lien`, `.rc-bas` | Navigation, mise en page mobile | Faible |
| admin.css : 8, 318 | `.ad-app` (hauteur, flex, fond creme) | Structure du cadre | Faible |
| admin.css : 1036-1050 | `html:has(.ad-app)`, `body:has(.ad-app)` | `overflow-x: clip`, marges de défilement | Faible |
| admin.css : 2234-2257 | `.ad-app .geo-interrupteur input[type=checkbox]` | Surcharge des cases (commentaire explicite) | Déjà surchargé à la main |

Les classes `rc-*` (console restaurateur) sont aussi stylées à l'intérieur de `.ad-app`.

## 7. Chiffres

- Pages (`page.tsx`) sous `src/app/system` : **27** (23 gardées par `exigerPermissionPage`, 1 par `obtenirContexteSysteme`, 3 redirections).
- Composants `"use client"` : **38** sous `src/app/system` et **3** sous `src/components/admin` (soit 41).
- Actions serveur `"use server"` : **0** sous `src/app/system` ; **25** fichiers dans `src/lib/system-admin/`.
- Occurrences de `style={{` : **142** sous `src/app/system`, **2** sous `src/components/admin`.

## Points à vérifier ou anomalies relevées

1. `permissions.ts` (commentaire de `groupesNavPourRole`) cite un composant `SystemNav` qui n'existe pas : la navigation réelle est `AdminNav`. Simple dérive de documentation.
2. Le tableau de bord (`/system/page.tsx`, 607 lignes) n'a pas de garde par permission. Si ses blocs affichent des données commandes ou comptes, elles sont visibles par tout rôle système. Non vérifié bloc par bloc (à vérifier).
3. `console-b.css` 92-100 : règles de champs et de focus sans exclusion des cases à cocher (voir section 6).
4. `contenu/pages/[id]/blocs` : contenu de la page non identifié dans son dossier (à vérifier).
5. Les tableaux `.ad-table` ont été détectés par sous-chaîne (à vérifier).

**Résumé (5 lignes)**
- 27 pages sous `/system` : 23 gardées par permission, le tableau de bord par rôle seul, 3 redirections.
- Navigation : 18 entrées plus le tableau de bord, toutes avec une page ; 5 pages sans entrée (routes dynamiques et réinitialisation).
- Rôles : super_admin voit 18 entrées, operations 5, content_editor 8, support 2.
- Partagé : `PageHeader` (23 pages) et `SousNav` (16 pages) dominent ; 0 action serveur dans `src/app/system`, 25 dans `src/lib/system-admin`.
- CSS : `fantaisie.css` et `console-b.css` imposent des règles globales (cases 22 px, `label:has(checkbox)`, `.field`, `.btn`, `.card`) à tout `.ad-app` ; `console-b.css` 92-100 touche les cases sans exclusion, à vérifier.
