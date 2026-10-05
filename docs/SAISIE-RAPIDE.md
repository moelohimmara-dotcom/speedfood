# Saisie rapide du menu (5 octobre 2026)

Proposition 2 de la liste « innover tout en restant accessible » : ajouter des plats sans clavier ou presque. Aucun changement
de base de données, aucun service externe payant.

## Ce qui a été ajouté (page « Mon menu »)

- **Prendre une photo** : bouton qui ouvre l'appareil photo du téléphone (`capture="environment"`). Aperçu immédiat.
- **Réduction automatique des photos** (`src/lib/menu/reduireImage.ts`) : une photo d'appareil fait souvent 4 à 10 Mo, au-dessus de
  la limite de 5 Mo, et l'envoi échouait avec « L'image ne peut pas dépasser 5 Mo ». Elle est ramenée à 1 600 px, en JPEG
  (environ 200 à 700 Ko), avant l'envoi. Valable aussi pour une photo choisie dans la galerie. Test : 28 Mo → 706 Ko, acceptée.
- **Dicter le nom et le prix** (seulement si le navigateur sait faire de la reconnaissance vocale) : « Attiéké poisson, vingt-cinq
  mille » remplit le nom et le prix (`interpreterDictee`, nombres en lettres jusqu'à 999 999, monnaie finale ignorée). Un message
  invite à vérifier avant d'ajouter. La reconnaissance vocale est celle du navigateur (Chrome, Edge, Safari) : l'audio passe par
  le service de son éditeur, ce que le texte du formulaire indique. Sans micro, sans connexion ou sur Firefox, le bouton est absent
  ou renvoie un message, et la saisie au clavier reste possible.
- **Prix en boutons** : 5 000, 10 000, 15 000, 20 000, 25 000, 30 000, 40 000, 50 000 (44 px de haut).
- **Ajouter plusieurs plats d'un coup** (`AjoutEnLot`, `creerPlatsEnLotAction`) : on colle une liste (une ligne par plat, prix à la
  fin : « Riz sauce feuille 25000 », « Poulet braisé - 40 000 GNF », « 2. Jus 9.000 », « Brochettes 5k »). Un aperçu montre ce qui
  sera créé et les lignes ignorées avec la raison. 30 plats au plus par envoi, dans la section choisie.

## Sécurité

Le serveur **relit le texte brut** de la liste avec les mêmes règles que le formulaire d'un plat (nom de 120 caractères au plus, prix
entier entre 0 et le plafond réglé par l'équipe, section appartenant au restaurant de la session). Le navigateur ne fournit jamais de
plats « déjà validés ». Les contraintes de base (longueur, prix borné) s'appliquent en dernier ressort.

## Vérifié

- 27 tests purs (`scripts/tests/saisie.test.mts`) : nombres en lettres, dictée, lecture de liste, limites.
- Parcours réel en local sur un écran de 390 px avec un restaurateur de test : boutons de prix, dictée simulée, photo de 28 Mo
  réduite puis envoyée et servie par le stockage, liste de 5 lignes (4 plats créés, 1 ligne signalée). Données et fichier de test supprimés.
- **Non vérifié** : la reconnaissance vocale réelle (micro, accent guinéen), l'appareil photo d'un vrai téléphone.
