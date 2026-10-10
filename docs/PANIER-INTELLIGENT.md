# Panier : propositions d'accompagnement (10 octobre 2026)

Deuxième proposition IA. Le client qui a choisi des plats voit ce qui
l'accompagne : une boisson, une entrée à partager.

## Ce que ce n'est pas

Ce n'est pas de l'intelligence artificielle, et le code le dit explicitement.

L'idée était d'apprendre les associations sur les commandes réelles (« riz se
commande avec poulet »). **Impossible aujourd'hui : le projet totalise trois
commandes.** Un modèle de co-occurrence appris sur trois commandes n'est pas un
modèle, c'est du bruit avec des coefficients — il proposerait n'importe quoi avec
une assurance trompeuse, ce qui est pire que de ne rien proposer.

Ce qui est livré est donc : **trois règles déterministes, testées, et
explicables à l'écran.**

| Le panier contient | Proposition | Raison affichée |
|---|---|---|
| un plat, pas de boisson | la boisson la moins chère | « Pour accompagner votre plat » |
| une entrée, pas de plat | la boisson, puis le plat le moins cher | « Pour compléter votre entrée » |
| un plat, pas d'entrée | une entrée | « À partager avant le plat » |

Quand aucune règle ne s'applique, **rien ne s'affiche**. Proposer un plat au
hasard se lirait comme une recommandation ; un bloc vide ressemblerait à une
promesse non tenue.

## Pourquoi les règles plutôt qu'un modèle

Chaque proposition **dit pourquoi elle est faite**. Un restaurateur peut lire
la règle et la contester ; un client peut juger. C'est vérifiable aujourd'hui et
remplaçable plus tard : le jour où le volume le permettra, seules les règles
changeront, pas l'interface.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/panier/complements.ts` | Module **pur** : classification et règles, aucun réseau, aucune base |
| `src/app/api/panier/complements/route.ts` | Route publique en lecture : plats publiés du restaurant, disponibilité comprise |
| `src/components/panier/ComplementsPanier.tsx` | Le bloc sur `/panier`, ajout en un geste |
| `scripts/tests/complements.test.mts` | 19 tests |

## Vérifié en production

Sur `Café des Ambassades` (plat + entrée + boisson), panier contenant une
omelette : le bloc propose « Thé vert à la menthe — pour accompagner votre plat —
8 000 GNF — disponibilité à confirmer ». Le bouton ajoute l'article (sous-total
poussé à 26 000 GNF) et le bloc disparaît, aucune règle ne s'appliquant plus.

## Deux pièges rencontrés et corrigés

1. **Une règle plus stricte que le site.** La route ne proposait que les plats
   confirmés récemment, alors que la fiche restaurant autorise l'ajout de tout
   plat marqué disponible (la fraîcheur ne change que l'étiquette). Résultat :
   le bloc n'aurait rien proposé nulle part, aucun plat du catalogue n'ayant
   jamais été confirmé. Les deux exigent désormais la même chose, et la
   fraîcheur est **restituée au client** (« disponibilité à confirmer ») au lieu
   de servir à faire disparaître le plat — cacher l'information serait un bloc
   qui ment par omission.
2. **La classification par mots a des trous**, visibles : « Beignets » et
   « Bouillie de mil » n'étaient pas reconnus comme entrées sur un menu de café.
   Liste élargie, tests ajoutés. Un plat dont le nom ne dit rien de sa nature
   restera classé « plat » : c'est le prix de l'approche, et c'est **visible**
   (le bloc propose moins), jamais silencieux.

## Limites assumées

- Classification par mots : fiable sur les noms usuels de la restauration
  guinéenne, aveugle sur les noms°.
- Aucune commande réelle n'a encore permis de mesurer le gain : le bloc
  augmente-t-il réellement le panier moyen ? Sans donnée, on ne sait pas.
- La suggestion ne tient pas compte de la Quantity : ajouter deux plats
  identiques ne change rien, ce qui est voulu.

## Suite

Appliquer le même principe aux deux autres surfaces : propositions sur la fiche
restaurant (« Autres plats de la maison »), et rappel d'un plat laissé au
panier d'une visite précédente.