# Textes du site : éditeur (`/system/contenu/textes`)

Version 0.2 — 18 octobre 2026 (Lot 1 : éditer en voyant). Permission `contenu.editer` ; l'enregistrement demande en plus le palier de publication (Studio, palier 2) ; en dessous, l'écran est en lecture seule.

## 1. Ce que fait l'écran

Chaque texte de la page d'accueil est un **emplacement** (clé `page.zone.nom`) avec un texte d'origine dans le code (`src/lib/cms/emplacements.ts`, 50 emplacements en 7 groupes). Une ligne de `contenu_emplacements` le remplace ; sans ligne, c'est le texte d'origine. Texte brut seulement. **Un texte enregistré est en ligne aussitôt** (pas de brouillon dans ce lot).

## 2. Lot 1 (18 octobre 2026)

| Besoin | Réponse |
|---|---|
| Éditer sans voir la page | **Aperçu en direct** : la VRAIE page d'accueil dans un cadre de même origine ; les textes en cours de saisie y remplacent les textes de la page à la frappe. Choix **Téléphone** (390 px) ou **Ordinateur** (1 100 px, mis à l'échelle). Rien n'est publié avant « Enregistrer ». Cliquer dans un champ **entoure le texte correspondant** dans l'aperçu et y fait défiler la page. Sur petit écran, l'aperçu se déplie à la demande |
| Longue page sans repères | **Recherche** (libellé, texte saisi, texte d'origine, clé ; sans accents ni casse), filtres **Tous / Personnalisés / Non enregistrés**, **sommaire** de sections avec le nombre de textes à enregistrer ou personnalisés |
| Enregistrement par panneau, oublis | **Barre d'enregistrement unique** : « N modifications non enregistrées », **Enregistrer (N)**, **Annuler les modifications**, raccourci **Ctrl/Cmd + S**, **confirmation avant de fermer l'onglet** s'il reste des modifications ; champs non enregistrés marqués « Non enregistré » |
| Texte d'origine toujours affiché | Replié dans « Texte d'origine » ; « Remettre le texte d'origine » (appliqué à l'enregistrement) ; « Annuler ma modification » par champ |
| Compteur invisible avant dépassement | Compteur toujours affiché, **gris puis ambre à 90 % puis rouge** au-delà de la limite |

## 3. Comment marche l'aperçu (sans rien dupliquer)

- Aucune réécriture des sections de l'accueil : l'éditeur affiche `/?apercu_textes=1`.
- Sur cette adresse, la page monte `ApercuTextesPont` **uniquement si** le serveur confirme que la personne peut éditer les contenus (`peutVoirApercu`) ; pour tout autre visiteur le paramètre n'a aucun effet.
- Le pont inventorie les nœuds texte (et les attributs `placeholder`, `aria-label`, `title`, `alt`), puis, à chaque message de l'éditeur, recalcule chaque nœud depuis son texte d'origine avec la table « texte en ligne → texte saisi ». Il bloque les clics sur liens et formulaires du cadre.
- Messages (`src/lib/cms/apercu-textes.ts`, module pur testé) : même origine seulement, forme et tailles contrôlées (200 remplacements, 1 000 caractères), rien d'autre n'est interprété.
- **Limites** : un texte est reconnu par sa valeur en ligne ; deux emplacements au texte strictement identique bougent ensemble dans l'aperçu (sans effet sur l'enregistrement). Les textes qui tournent (mot roulant, carrousel) ou qui dépendent d'une zone choisie ne sont pas tous rejoués. L'aperçu montre l'accueil d'origine (le repli), pas la version en blocs.

## 4. Enregistrement

Un appel serveur par section touchée (`enregistrerGroupeAction`, inchangé : validation complète avant la première écriture, détection de conflit avec le texte vu à l'ouverture, audit `contenu.emplacement_modification`, invalidation du cache). Un texte refusé garde sa saisie et son message ; une section refusée n'empêche pas l'enregistrement des autres. Après succès, la page se resynchronise : un champ non modifié suit la nouvelle valeur du serveur, un champ en cours de modification garde la saisie.

## 5. Vérifications du 18 octobre 2026

Tests purs (`apercu-textes.test.mts`) : remplacements, espaces conservés, propriétés héritées ignorées, validation des messages, recherche, filtres, résumés, compteur. Essai dans le navigateur avec des données factices (pages temporaires supprimées) : suivi des modifications et sommaire, recherche et trois filtres, aperçu qui suit la frappe (texte, `placeholder`, `aria-label`, titre à plusieurs nœuds), annulation d'une modification répercutée dans l'aperçu, surlignage au focus, liens bloqués dans le cadre, enregistrement refusé sans session (message affiché, modifications conservées).
**Non essayé** : l'enregistrement réel et l'aperçu de la vraie page d'accueil (connexion d'éditeur nécessaire).

## 6. Suite possible (Lots 2 et 3)

Historique et retour en arrière par texte, brouillon puis publication (et programmation), espaces insécables automatiques avant `: ? ! ;`, emplacements pour les autres pages (aide au choix, suivi, commande sur place, avis, pied de page), variantes de langue.
