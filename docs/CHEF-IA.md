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

- **Modèle** : `llama-3.2-11b-vision-instruct`, le plus gros multimodal compatible avec
  le quota gratuit du projet (10 000 neurons/jour, soit environ 178 analyses de carte
  de 30 plats par jour pour une base de 8 restaurants).
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

- 27 tests purs (`scripts/tests/chefia.test.mts`, runner : `npm run test:unit`) : les
  dix écritures de prix (`25 000`, `25 000 GNF`, `40000F`, `25.000`, `25.5`, `0`,
  `null`…), l'extraction du JSON noyé dans du texte, le rapprochement des sections
  (accents, ligature « œ »), le refus motivé, les doublons, le plafond de 30 plats.
- Trois de ces tests ont d'abord **échoué** et révélé trois vrais bugs : `parseInt`
  tronquant « 25.000 » à 25, le décimal non arrondi, et la ligature « œ » que NFD ne
  décompose pas (« Bœuf » et « Boeuf » ne se reconnaissaient pas comme le même plat).
- `tsc --noEmit` et ESLint propres.
- Parcours réel en production avec la photo d'une carte de restaurant (ardoise
  simulée) : envoi, analyse Workers AI, relecture affichée, sections inconnues signalées.
- **Non vérifié** : le comportement du modèle sur une vraie photo d'ardoise en
  conditions réelles (éclairage faible, écriture manuscrite, prix à la craie), et le
  délai de réponse sur les photos les plus lourdes.

## Suite

Les deux autres propositions IA (panier intelligent, Conquistadorio) restent à cadrer.