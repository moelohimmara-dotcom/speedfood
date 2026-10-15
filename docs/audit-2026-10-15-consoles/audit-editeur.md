# Audit de l'éditeur de pages à blocs, 15 octobre 2026

Éditeur visuel de `/system/contenu/pages/[id]/blocs` (composants dans `src/components/studio/editeur/`, basé sur Puck). Complète `audit-visuel.md`.

## Méthode et limites

- **Aucune page n'existe encore en production** (la liste `/system/contenu/pages` est vide) : en créer une aurait été une écriture sur ton site. J'ai donc **monté l'éditeur en local avec un document fictif** (titre, paragraphe, bouton, espace, colonnes, citation, FAQ) sur une page d'essai temporaire, **supprimée ensuite et jamais commitée**. Sans session sur `localhost`, aucune action serveur n'aboutit : rien n'a été écrit dans ta base.
- Rendu fidèle de l'interface (même code, même CSS que la production) ; **non testés** : enregistrement et publication réels, restauration d'une version, ajout d'un bloc depuis le panneau, glisser-déposer, image de la médiathèque, clavier complet, lecteur d'écran.
- Mon document fictif contient un `Titre` de niveau 1 que l'éditeur juge invalide : c'est un défaut de mon jeu d'essai, pas de l'éditeur. Il m'a toutefois permis d'observer la gestion d'erreur.
- Captures : `captures/10` à `14`. Largeurs testées : 1280, 768 et 375 px.

## Ce qui fonctionne bien (testé)

- **Mise en page claire à trois colonnes** : liste des blocs numérotés (à gauche), aperçu au centre, réglages à droite. En-tête complet : retour, titre et statut (« Brouillon »), Annuler / Rétablir avec leurs raccourcis (Ctrl+Z, Ctrl+Maj+Z), choix d'écran (Mobile 390, Tablette 768, Bureau 1280), Voir l'aperçu, Historique, Enregistrer le brouillon, Publier.
- **Retour d'information immédiat** : après une frappe, le badge « Modifications non enregistrées » apparaît, « Enregistrer le brouillon » s'active, l'aperçu se met à jour en direct. **Annuler** restaure l'état d'origine et désactive de nouveau l'enregistrement.
- **Garde de navigation** : « Retour à la liste » avec des modifications ouvre « Quitter sans enregistrer ? Des modifications de cette page ne sont pas enregistrées : si vous quittez maintenant, elles seront perdues. », avec le **focus sur « Rester »** (choix sûr par défaut).
- **Publier** : boîte explicite (« Le brouillon remplace la version en ligne : les visiteurs le verront aussitôt »), motif facultatif limité à 200 caractères avec compteur.
- **Accessibilité de base** : les 75 contrôles visibles ont un nom accessible (« Monter le bloc 1, Titre », « Supprimer le bloc 1… »), aucun débordement horizontal à 1280 px.
- **Validation visible** : un bloc invalide est signalé dans l'aperçu (« Titre incomplet ou invalide : corrigez ses réglages (l'enregistrement sera refusé tant qu'il n'est pas corrigé) »).
- **Téléphone (375 px)** : l'éditeur n'est pas chargé ; un message clair (« L'éditeur de pages demande un écran plus large : tablette ou ordinateur ») et un lien de retour. Choix assumé et expliqué dans le code (glisser-déposer tactile non validé).

## Constats

### Graves

**ED-1. Les boîtes de dialogue s'ouvrent collées en haut à gauche de l'écran, dans toute la console.** Mesuré : la boîte « Historique des publications » est à la position (0, 0) de la fenêtre (largeur 560 px), au lieu d'être centrée ; les boîtes « Publier » et « Quitter sans enregistrer » sont à (11, 21) et (11, 18). Cause (vérifiée en production) : la règle globale `* { margin: 0 }` (`globals.css`) supprime le centrage natif des `<dialog>` ouverts en modal ; `.ad-dialogue` (`admin.css:1091`) ne rétablit pas `margin: auto`. **Toutes les boîtes `.ad-dialogue` de la console sont concernées** : suppression de compte, suppression groupée, correction et suspension d'un restaurant, et les trois de l'éditeur. Correctif probable : une ligne (`margin: auto` sur `.ad-dialogue`). Voir `captures/13`.

### Moyens

**ED-2. L'éditeur est inutilisable à 768 px (tablette portrait).** Les trois colonnes se partagent trop peu de place : l'aperçu central ne mesure que **288 px de large** alors qu'il simule un écran de 390 px, donc **le contenu est coupé à droite** (texte, boutons de la FAQ) avec une barre de défilement horizontale ; le panneau de réglages est étroit ; l'en-tête passe sur **deux rangées**. Or le seuil d'ouverture est fixé à 768 px (`EditeurDiffere.tsx`). Soit relever le seuil (environ 1024 px), soit replier une colonne sous 1024 px. Voir `captures/14`.

**ED-3. L'aperçu « Bureau » est une vignette illisible** (échelle d'environ un tiers dans la colonne du milieu), sans zoom ni mode plein écran pour juger du rendu. `captures/12`.

**ED-4. Cibles tactiles trop petites** : 46 contrôles sous 40 px sur ordinateur, dont les boutons d'en-tête (36 px de haut) et **les quatre icônes d'action de chaque bloc (32 × 32 px)** : monter, descendre, dupliquer, supprimer, répétées sur chaque bloc. « Supprimer » est collé aux trois autres actions, sans confirmation visible (l'annulation Ctrl+Z existe, à vérifier qu'elle couvre la suppression d'un bloc).

**ED-5. Erreur de validation sans indication du champ fautif.** Le message « Titre incomplet ou invalide : corrigez ses réglages » est affiché dans l'aperçu, mais en sélectionnant le bloc, **aucun champ n'est marqué en erreur** (aucun `aria-invalid`, aucun texte sous le champ « Importance » dont aucune option n'est choisie). L'utilisateur doit deviner quel réglage corriger.

### Mineurs

- **Fil d'Ariane du panneau de droite collé** : « Réglages de la pageParagraphe » (aucun séparateur ni espace entre les deux éléments quand un bloc est sélectionné ; un chevron apparaît à d'autres moments). `captures/11`.
- **Barre d'outils du bloc qui recouvre le contenu** : la barre flottante (nom du bloc, dupliquer, supprimer) masque une partie du texte du bloc voisin (message d'erreur du Titre), `captures/11`.
- **Texte d'aide du champ** en petit corps (« Gras : **mot**… ») et syntaxe Markdown exposée à une personne non technique.
- **Un seul niveau de brouillon sans nom** : l'« Historique des publications » liste les versions publiées, rien pour les brouillons.

## Conséquences pour le plan

- **Phase 0** : ajouter **ED-1** (une ligne, bénéfice sur toutes les boîtes de la console).
- **Phase 2/3 (refonte)** : ED-2 à ED-5 sont de vrais chantiers d'ergonomie (disposition tablette, zoom d'aperçu, cibles de 44 px, erreurs liées aux champs).
- À garder tels quels : le suivi de modification, la garde de navigation, la boîte de publication, le repli téléphone.

## Autre éditeur

L'éditeur de design (`/system/design`, jetons de couleurs, typographie, espacements) a été **mesuré** dans `audit-visuel.md` (35 cibles de moins de 40 px, onglets de groupe à 25 px) mais **pas manipulé** : ses boutons agissent directement sur le design du site public. Je peux le tester de la même façon en local si tu le souhaites.
