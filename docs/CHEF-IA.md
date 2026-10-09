# « Chef IA » : photographier son menu (9 octobre 2026)

Fonctionnalité 1 des trois propositions IA. Le restaurateur photographie son menu
(ardoise, feuille imprimée, carte de vitrine) ; l'assistant en tire une liste de
plats, qu'il relit et corrige avant tout enregistrement. Aucun changement de schéma
de base : les plats créés sont des lignes `menu_items` ordinaires.

## Le principe qui gouverne tout

**Rien n'est écrit sans que le restaurateur l'ait vu.** Un modèle vision se trompe de
virgule (`25 000` lu `250`), confond un prix et une mention, saute une ligne. Écrire sa
sortie directement en base reviendrait à publier un menu faux au nom du
restaurateur. D'où trois étapes, aucune fusionnable :

1. **Photo** → le modèle propose des plats.
2. **Relecture** → chaque nom, prix et section est modifiable, chaque ligne décochable.
3. **Ajout** → les lignes cochées sont insérées, après revalidation complète côté serveur.

## Chaîne technique

| Étape | Fichier | Rôle |
|---|---|---|
| Consigne, nettoyage, validation | `src/lib/menu/chefMenu.ts` | **Pure**, sans réseau ni base : c'est ici que vivent les règles testables |
| Appel du modèle | `src/lib/menu/chefIaModele.ts` | Binding `AI` du Worker, modèle `@cf/meta/llama-3.2-11b-vision-instruct` |
| Étapes serveur | `src/lib/menu/actions.ts` | `analyserMenuPhotoAction`, `importerPlatsChefIaAction` |
| Interface | `src/app/restaurant/(console)/menu/ChefIA.tsx` | Réduction de l'image, table de relecture |

Le découpage est délibéré : parler à Cloudflare et décider de ce qu'on garde sont deux
choses testables séparément. `analyserReponseModele` ne connaît que du texte et se
teste sans mocker quoi que ce soit.

## Décisions

- **Modèle** : `llama-4-scout-17b-16e-instruct`, multimodal sans porte de
  licence, dans le quota gratuit du projet (10 000 neurons/jour). La liste des
  modèles essayés, avec le statut de chacun, est en fin de document.
- **La photo n'est pas conservée.** Elle est analysée puis jetée : ni stockage, ni base.
  Seule la liste de plats circule, le temps de la relecture. C'est ce qui rend la promesse « la photo n'est pas conservée » exacte,
  sans réserve.
- **Réduction à 1 600 px dans le navigateur.** Le modèle est facturé au pixel ; une
  photo de téléphone brute (12 Mpx) coûterait plusieurs fois plus pour le même résultat.
- **Prix illisible → refus, jamais deviné.** La consigne l'interdit au modèle, et
  `lirePrix` renvoie `null` plutôt que d'inventer : la ligne est écartée et **sa raison
  est affichée**. Idem pour un prix hors limites et un doublon.
- **Aucune section créée par l'IA.** Le libellé écrit par le modèle est rapproché des
  sections existantes ; s'il ne correspond à rien, le plat reste sans section et le
  restaurateur est prévenu. Créer des sections à son insu réorganiserait son menu.
- **Limiteur par restaurant** (20 analyses/h) : le quota Workers AI est partagé par le
  *projet*, pas par le restaurant. Un budget commun se protège comme les téléversements.
- **Import relu comme un formulaire.** Les plats reviennent du navigateur, donc chaque
  champ est revalidé avec les mêmes règles que `creerPlatAction`, et la `section_id` est
  revérifiée comme appartenant au restaurant.

## Vérifié

- 30 tests purs (`scripts/tests/chefia.test.mts`, runner : `npm run test:unit`) : les
  dix écritures de prix (`25 000`, `25 000 GNF`, `40000F`, `25.000`, `25.5`, `0`,
  `null`…), l'extraction du JSON noyé dans du texte **et sous forme de tableau**,
  le rapprochement des sections (accents, ligature « œ »), le refus motivé, les
  doublons, le plafond de 30 plats.
- Trois de ces tests ont d'abord **échoué** et révélé trois vrais bugs : `parseInt`
  tronquant « 25.000 » à 25, le décimal non arrondi, et la ligature « œ » que NFD ne
  décompose pas (« Bœuf » et « Boeuf » ne se reconnaissaient pas comme le même plat).
## Vérifié en production (9 octobre 2026)

Parcours complet sur le site déployé, restaurant de test, carte de 10 lignes
photographiée (prix écrits en `12 000 GNF`, `40000`, `30.000`, `5000`, une ligne
sans prix, et un doublon planté exprès) :

- 8 plats proposés sur 10, **tous les prix justes** (`30.000` bien lu `30000`),
  la description au dos d'une ligne recopiée pour « Riz sauce feuille », le
  doublon présent une seule fois.
- La ligne sans prix **refusée**, pas devinée, et listée sous « 1 ligne non
  reprise » avec sa raison.
- `PLATS` rapproché de la section existante « Plats » ; `ENTREES` et `BOISSONS`
  signalés comme sections inconnues, plats laissés sans section.
- Relecture : prix corrigé à la main (5000 → 6000), ligne décochée ; seule la
  correction est partie dans l'import (7 plats).
- Après import : 7 lignes en base, prix corrigé respecté, 3 plats dans la
  section, 4 sans section. Données de test supprimées ensuite (0 plat,
  0 section).

### Trois photos de papier testées le 9 octobre 2026

Au-delà de la carte imprimée nette, trois menus « de terrain » ont été fabriqués
et passés dans le pipeline réel :

| Photo | Difficulté | Résultat |
|---|---|---|
| Papier 1 | Feuille penchée 4°, éclairage dégradé, police cursive | — (essai après correctifs) |
| Papier 2 | Penchée 3°, **image assombrie** (luminosité 0,62, contraste 0,72), ombre portée sur la moitié gauche, prix en `15 000 F` | **5 plats sur 6, tous les prix justes** ; « Poisson grille — sur place » écarté |
| Papier 3 | Penchée 7°, estompée | **5 plats sur 5, tous les prix justes** (10 000, 20 000, 25 000, 25 000, 30 000) |

Sur la photo la plus difficile — assombrie, penchée, à l'ombre — le modèle a
lu correctement cinq plats sur six, dont les prix écrits `15 000 F`. C'est
l'ordre de grandeur attendu du cas d'usage réel.

### Les défauts que ces photos ont sortis

1. **Le modèle ne répond pas toujours dans la langue de la consigne.** Sur la
   photo 3, il a parfaitement lu la carte mais répondu en `name` / `price`. Le
   prix n'étant lu que sous la clé `prix`, chaque ligne partait au compteur
   « refusées » et l'écran affichait « aucun plat lisible sur cette photo » —
   **un message qui accusait la photo alors que la faute était chez nous**.
   Corrigé : les deux écritures sont lues pour le nom, le prix, la description et
   la section, avec un test sur la réponse réellement observée.
2. **Le message d'échec mentait sur la cause.** « Aucun plat lisible » ne
   distingue pas « le modèle n'a rien trouvé » de « nous n'avons pas compris sa
   réponse ». Un restaurateur faced à un message qui accuse sa photo recommence,
   puis abandonne. L'analyse renvoie désormais un état (`plats` / `vide` /
   `indetermine`) et l'écran dit la vérité : « L'assistant a répondu sans que
   nous puissions le lire. Recommencez… ».

### Ce que la vérification a corrigé par ailleurs

Trois autres défauts réels, tous invisibles aux tests ou à la compilation :

1. **Le modèle renvoie un tableau JSON**, `[{"nom":…}]`, et non l'objet
   `{"plats":[…]}` demandé. L'extracteur ne cherchait qu'une accolade ouvrante :
   aucune dans la réponse, extraction vide, et l'écran affichait « aucun plat
   lisible » — un message qui **affirmait que le modèle n'avait rien lu**. Les
   tests existants ne couvraient que la forme objet ; c'est la vérification
   dans le navigateur, pas un coup de chance, qui l'a sorti.
2. **Un remplacement de texte par PowerShell** a cassé les accents de deux
   fichiers déjà commités, sans que `tsc`, ESLint ou les tests ne le voient.
3. **Le catalogue Workers AI est plus instable qu'il n'y paraît** : au sondage,
   `moondream3.1-9B-A2B` répondait sans erreur mais renvoyait un objet vide, et
   `llava`, `qwen*-vl` et `gemma-3` n'existaient plus.

### Modèles retenus

| Modèle | Statut constaté |
|---|---|
| `llama-4-scout-17b-16e-instruct` | **Retenu.** Multimodal, sans licence, bon sur une vraie carte |
| `mistralai/mistral-small-3.1-24b-instruct` | Répond, mais refuse `input_text` : non retenu |
| `meta/llama-3.2-11b-vision-instruct` | Erreur 5016 (licence Meta), gardé en repli |
| `moondream/moondream3.1-9B-A2B` | Objet vide, même sans image |

Ces deux API sont de type OpenAI : les parties d'un message sont `input_text`
et `input_image`, cette dernière exigeant un champ `detail` explicite — sans
quoi l'appel est refusé sur une erreur de validation. Le banc d'essai utilisé
pour ces measurements (`.sdd/essai-ai`, supprimé) permit d'itérer en secondes
au lieu de redéployer l'application à chaque essai.

### Non vérifié

- Le délai de réponse sur les photos les plus lourdes (≈ 9,5 s sur une carte de
  187 Ko, ≈ 4,2 s sur une image plus légère).
- Le quota effectif en neurones consommés : à mesurer sur plusieurs analyses
  réelles avant d'ajuster la limite de 20/h par restaurant.
- L'écriture à la **craie** (mainlevée) : les photos testées simulaient une
  écriture cursive imprimée, pas une vraie ardoise. C'est le dernier écart connu
  avec le cas d'usage réel.

## Suite

Les deux autres propositions IA (panier intelligent, Conquistadorio) restent à cadrer.