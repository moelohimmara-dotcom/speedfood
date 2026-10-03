# Audit visuel de l'application : 3 octobre 2026

**Méthode :** parcours réel de l'application dans un navigateur, en largeur mobile (375 × 812 px) pour les écrans publics et les consoles, avec captures d'écran, plus des mesures par script (taille des cibles tactiles, tailles de texte, contraste). Écrans publics vus **en production** ; consoles vues **en local** (compte de test supprimé ensuite). Grille de lecture : hiérarchie visuelle, lisibilité, accessibilité (contraste, cibles tactiles), cohérence, états, adaptation mobile.

**Ce que cet audit ne couvre pas (à ne pas oublier) :** vraie largeur de bureau (la fenêtre de test est trop étroite pour juger une mise en page 1280 px), tablette, mode sombre, navigation au clavier et focus, lecteur d'écran, appareils réels, et les écrans d'administration autres que l'en-tête. Environ douze écrans ont été vus. Les données de démonstration influencent l'impression (par exemple tous les plats « à confirmer »).

## 1. Ce qui fonctionne bien (à conserver)

- **Identité typographique forte** : titres en Barlow Condensed gras, texte en Manrope, hiérarchie lisible d'un coup d'œil.
- **Palette chaude cohérente** (fond crème, rouge et orange pour l'action, jamais pour décorer). Le dégradé est réservé au bouton d'action principal, conformément à `DESIGN-SYSTEM.md`.
- **Contraste du texte secondaire correct** : 4,99 contre 1 sur le fond crème (le seuil d'accessibilité AA est 4,5).
- **Aucun débordement horizontal** à 375 px sur les pages mesurées.
- **Cartes de restaurants appétissantes** : grande photo, pastille de catégorie, bordure d'accent, état ouvert/fermé visible.
- **Écran du panier clair** : peu d'éléments, action principale évidente, message honnête sur le règlement.

## 2. Défauts constatés

### Priorité haute (cassent l'usage ou la lisibilité)

| # | Écran | Constat | Origine |
|---|---|---|---|
| H1 | Fiche restaurant, lignes de menu (mobile) | La colonne de texte du plat est écrasée par la photo et le bloc prix + bouton : un mot par ligne, **le prix chevauche le titre** (« 22 000 GNF » par-dessus « arachide »). Pire quand le plat est dans le panier (contrôle de quantité plus large). | Existant, aggravé par le partage |
| H2 | Toutes les consoles | Le **rappel de double authentification s'affiche en trois colonnes étroites** (le texte, la phrase, le lien côte à côte) et occupe près de la moitié du premier écran sur téléphone, sur chaque page. | Ajouté aujourd'hui (défaut de ma part) |
| H3 | Fiche restaurant | Chaque plat porte maintenant **deux boutons de partage empilés**, en plus du badge et de « pas encore confirmé » : les lignes de menu deviennent très hautes et bruyantes. | Ajouté aujourd'hui (défaut de ma part) |
| H4 | Accueil de la console restaurateur | **Mauvaise priorité** : le QR code et le partage passent avant « Commandes à traiter » et l'état ouvert/en pause, alors que recevoir et traiter les commandes est la tâche principale. | Ajouté aujourd'hui (défaut de ma part) |
| H5 | Console, page Menu | Le formulaire « Ajouter un plat » est **avant la liste des plats** : le restaurateur fait défiler un formulaire avant de voir son menu. Le champ photo est le bouton de fichier brut du navigateur. | Existant |
| H6 | Administration, en-tête | Sur écran étroit, trois boutons pleine largeur empilés consomment tout le premier écran avant le contenu ; barres de défilement visibles sur la navigation. | Existant, aggravé par le bouton « Sécurité du compte » |

### Priorité moyenne

| # | Écran | Constat |
|---|---|---|
| M1 | Console, barre d'onglets | « Mon restaurant » est coupé (« Mon re… ») sans indice qu'on peut faire défiler. |
| M2 | Connexion et inscription | Les liens (« Inscrivez votre restaurant », « Administration ») ne ressemblent pas à des liens : même couleur que le texte, aucun soulignement, lignes serrées. **Pas de lien « mot de passe oublié »** (manque fonctionnel), pas d'affichage du mot de passe. |
| M3 | Formulaire de commande | Boutons radio et case à cocher natifs minuscules (environ 13 px) ; trois blocs d'explication successifs (règlement, consentement, information) avant le bouton ; bloc de consentement dense. |
| M4 | Général | Cibles tactiles sous 44 px : lien « Retour aux restaurants » (19 px de haut), boutons « Copier le lien » (40 px). Badges à 11,5 px. |
| M5 | Fiche restaurant | « À confirmer » répété sur chaque plat dès qu'aucune confirmation n'existe : bruit qui noie l'information. Un message au niveau du restaurant serait plus lisible. |
| M6 | Page d'alternatives, plat inconnu | Message « Ce restaurant n'existe pas, ou n'est plus publié » alors que c'est le plat qui est introuvable. |
| M7 | Accueil | Deux publics (clients et restaurateurs) se partagent une seule page longue ; l'exemple de console utilise un prénom réel (« Malika T. ») au lieu d'un nom fictif. |

## 3. Constats mesurés

- Texte secondaire : 4,99 : 1 (conforme AA).
- Cibles tactiles sous 44 px : 7 sur la fiche d'un restaurant (retour, trois « Copier le lien », contrôles de quantité à 34 px de large).
- Textes sous 12 px : badges d'état (11,5 px).
- Défilement horizontal : aucun à 375 px.

## 4. Lecture d'ensemble

L'application a **une bonne base d'identité** (couleurs, typographie, cartes), mais elle n'est **pas encore unifiée** : l'accueil, le catalogue, les consoles et l'administration ont chacun leur style de composants. Les défauts les plus visibles viennent de la **mise en page mobile des lignes de menu** et de **blocs d'information ajoutés sans arbitrage de priorité** (rappel de sécurité, partage, QR code). Les écrans clés pour un pilote sont, dans l'ordre : fiche restaurant, commande, console restaurateur (commandes), puis le reste.

## 5. Corrections déjà faites (3 octobre 2026, vérifiées en mobile)

Corrigées sans toucher au design system, vérifiées dans le navigateur à 375 px :

- **H1** lignes de menu : le texte garde au moins 220 px de large, le bloc prix et quantité passe **sous** le texte quand la place manque ; plus de chevauchement ni de texte d'un mot par ligne.
- **H2** rappel de double authentification : cause trouvée dans la règle commune des alertes (`.alerte` était une rangée de colonnes) ; elle est maintenant un bloc de texte, ce qui corrige aussi les autres alertes à plusieurs morceaux (réglages de conservation, suppression de compte, sécurité du compte). Texte du rappel raccourci.
- **H3** un seul lien discret « Partager ce plat » par plat (le bouton « Copier le lien » reste au niveau du restaurant).
- **H4** console, accueil : commandes à traiter, puis état du restaurant, puis lien et QR code.
- **H5** console, page Menu : la liste des plats vient avant « Sections du menu » et « Ajouter un plat » ; le bouton de choix de fichier reprend le style des boutons.
- **M2 (partie visuelle)** liens de connexion et d'inscription : couleur d'action foncée (contraste 5,8 : 1), soulignés, zone tactile de 44 px.

**Mise à jour (3 octobre 2026, soir)** : H6 (en-tête d'administration compact, déployé mais **non vérifié visuellement**), M1 (navigation basse de la console, déployée ; la sous-navigation de l'administration reste à contrôler), M2 (« mot de passe oublié » fait ; affichage du mot de passe non fait), M3 (cartes de choix, déployé), M4 (« Retour » et « Copier le lien » à 44 px, badges à 12 px), M5 (un message au niveau du restaurant quand aucun plat n'est confirmé), M6 (plat introuvable : retour à la fiche du restaurant), M7 (nom fictif « Client exemple ») sont traités. **Reste** : vérification réelle de l'administration à 375 px, affichage du mot de passe, revue visuelle indépendante.

## 6. Suite proposée

1. **Présenter deux ou trois directions** sur les écrans clés (accueil, liste, fiche restaurant, commande, console des commandes) pour que Malika choisisse.
2. **Appliquer la direction retenue** écran par écran, avec vérification mobile et contrôle d'accessibilité (contraste, cibles de 44 px, focus clavier) à chaque lot.
3. **Compléter l'audit** avec une vraie largeur de bureau, la navigation au clavier et un appareil réel avant de figer les choix.

Les décisions de design (couleurs, typographie, icônes) restent verrouillées par `cadrage/DESIGN-SYSTEM.md` tant que Malika ne les rouvre pas.
