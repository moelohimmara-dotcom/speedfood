# Console d'administration : refonte du design (4 octobre 2026)

Décisions de Malika : refonte complète (architecture et design), identité Speedfood en version « pro » (rouge, crème, encre, aucune couleur nouvelle). Les tokens de `DESIGN-SYSTEM.md` restent la seule source de couleurs et d'espacements.

## Ce qui a changé

| Avant | Après |
|---|---|
| Barre de sections horizontale qui déborde sur téléphone, titre « Administration Speedfood » | **Barre latérale sombre** (encre) sur bureau avec icônes, tableau de bord en premier, rôle en pastille ; **en-tête fixe et tiroir** (`<dialog>` natif) sur téléphone et tablette |
| Un grand paragraphe d'introduction et un bloc « séparation des surfaces » en tête de chaque page | En-tête de page court (`PageHeader`), la note d'architecture passe dans le pied de page, repliée |
| Listes de cartes identiques, très hautes | **Tableaux** sur bureau (ligne entière cliquable), **cartes empilées** sur téléphone (mêmes données, mêmes liens) |
| Tableau de bord : pile de cartes, page de plus de 3 000 px | File « À traiter » et accès rapides côte à côte, tuiles de chiffres en 2 à 4 colonnes, activité récente, rôle replié |
| Sous-navigation en pastilles | Onglets soulignés |
| Paramètres : une longue colonne | Cinq sections nommées avec ancres, aide sous chaque champ, barre d'enregistrement collée en bas |
| Titre de page identique partout | Un titre par page (« Restaurants (administration) », etc.) |

## Grammaire commune (`src/components/admin/`, `src/app/admin.css`)

- `PageHeader` (titre, description, actions, lien retour), `Panneau` (groupe avec titre et compteur), `Tuile` (un chiffre cliquable avec sa définition écrite, règle des indicateurs du TDR §7), `EtatVide` (message utile quand une liste est vide), `Pastille` (état toujours en texte, jamais la couleur seule).
- Tableaux : `.ad-table-cadre > table.ad-table` avec `data-label` sur chaque cellule (utilisé en cartes sur téléphone) et `ad-cellule-principale` pour le lien de ligne (lien étendu : un seul lien pour le clavier et les lecteurs d'écran).
- Formulaires : `.ad-formulaire`, `.ad-aide-champ`, `.barre-enregistrement.ad-barre-enregistrement`.
- Tout est préfixé `ad-` : la console restaurateur et le site client ne sont pas touchés (ADR-010).

## Vérifications faites (local, compte super admin de test supprimé ensuite)

- 14 écrans rendus sans erreur, **un seul `h1` et un seul `main` par page**, titres uniques.
- Aucun défilement horizontal à 320 px sur les écrans mesurés ; bureau à 1280 px : barre latérale de 264 px, tableaux de 935 px, tuiles en 4 colonnes.
- En-tête mobile fixe (`overflow-x: clip` sur html et body, limité aux pages d'administration : `hidden` cassait le positionnement collant).
- Tiroir mobile : ouverture, liste des sept entrées, fermeture.

## Limites connues

- **Non vérifié** : le rendu bureau à l'œil (le panneau de prévisualisation est trop étroit), la navigation au clavier de bout en bout, un lecteur d'écran, un vrai téléphone.
- Les formulaires intérieurs (création de page, de bannière, de mise en avant, modération, équipe, suppression de compte) gardent leur structure ; seul leur cadre est refait.
- Pas de recherche globale ni de compteurs dans la barre latérale (idées possibles : badge « à valider » sur Catalogue, recherche par référence de commande).
- Le tableau de bord signale 8 restaurants « en attente » : 5 sont les restaurants `[DEV]` dépubliés le 4 octobre et 3 sont des comptes de test. À nettoyer (suspension avec motif, ou suppression) : décision de Malika.

## Retouches du 4 octobre 2026 (après les captures de Malika sur la version en ligne)

| Anomalie vue sur les captures | Retouche | Où d'autre elle existait |
|---|---|---|
| Gros bouton « Supprimer ce compte » répété sur chaque ligne (lignes de 155 px) | Action discrète (corbeille, texte rouge) ; le style d'alerte fort est réservé à la **fenêtre de confirmation** (`<dialog>`), qui nomme le compte | Retirer un rôle, retirer une mise en avant, retirer un membre d'équipe, supprimer une catégorie ou une bannière |
| Interligne énorme dans une phrase contenant un lien | `.lien-texte` ne grossit plus la ligne (zone de 44 px par remplissage compensé par une marge négative) | Toute l'application : connexion, inscription, commande, fiche restaurant, aide, tableau de bord restaurateur. **La phrase de consentement de la commande** avait le même défaut (`.consentement a`) |
| Barre de défilement parasite à droite des onglets | `overflow-y: hidden` sur la rangée d'onglets | Seul endroit concerné (les autres défilements horizontaux masquent leur barre) |
| Barre latérale coupée en bas (« Se déconnecter » invisible) | Entrées de 40 px à la souris, 38 px quand l'écran est bas ; mesuré : aucun défilement à 800 px de haut | |
| Identifiants techniques affichés (`super_admin`, `content_editor`) | Libellés lisibles ; description sous chaque rôle ; **actions du journal d'audit** traduites (« Restaurant suspendu » au lieu de `restaurant.suspension`) | Journal d'audit, activité récente du tableau de bord, filtre du journal |
| Colonne « Accès » : pastille « 1 restaurant » + puce qui répète la même chose | Une ligne par fait : « Propriétaire de barbie » | |
| Compte propre affiché avec « — » | Pastille « Vous » ; « Retirez d'abord son rôle » pour un autre super administrateur | |
| Comptes de test noyés dans la liste | Filtre **« Comptes de test »** (adresses `@example.com`, mots « test » ou « essai », préfixes `bloc8b-…`) et **suppression groupée** : cases, barre « N comptes sélectionnés », confirmation par motif + mot SUPPRIMER, 50 comptes au plus, garde-fous de la base compte par compte, restaurants avec commandes conservés, trace d'audit par compte | |

Défauts trouvés en testant, corrigés : après une erreur de confirmation, React **vidait le motif saisi** et **décochait les cases de sélection** liées au formulaire (le compteur affichait encore « 2 »). Les champs sont maintenant contrôlés et l'envoi se fait sans réinitialisation du formulaire.

Vérifié en local avec un compte super admin de test (supprimé) : filtre, sélection, refus d'une mauvaise confirmation (sélection et motif conservés), suppression réelle de 2 comptes jetables (« 2 comptes supprimés définitivement »), 8 nouveaux tests purs (52 au total pour ce fichier).
