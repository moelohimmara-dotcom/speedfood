# Décisions du modèle Speedfood, alignées sur la posture « intermédiaire » (21 octobre 2026)

Malika a demandé que les décisions d'argent et d'exploitation **s'alignent sur la cinquième décision** (posture « intermédiaire qui encaisse et livre », celle de `REFONTE-SPEEDFOOD.md` §1). Ce document les tranche **de façon cohérente avec cette posture**. Malika les a **relues et modifiées le 21 octobre** (commission de départ 5 %, versements quotidiens aux restaurants et aux livreurs) : ses valeurs font foi. Elles restent modifiables à tout moment, et chacune est soumise à l'avis juridique avant le lancement.

## Le principe qui commande tout
Sous la posture intermédiaire, **le restaurant reste le vendeur de ses plats** ; Speedfood **organise la commande, encaisse pour le compte du restaurant, livre, et se rémunère par des frais clairement affichés**. Conséquence : Speedfood **ne fixe pas** son propre prix de vente et **ne détient jamais de marchandise**. Les options « majoration cachée » ou « prix Speedfood libre » (A et C du premier cadrage) sont **écartées** : elles feraient de Speedfood le vendeur.

## Les cinq décisions
| # | Décision | Alignée sur la posture intermédiaire | Pourquoi |
|---|---|---|---|
| 5 | **Posture** | **Intermédiaire qui encaisse et livre.** *Décidée par Malika.* | Garde le contrôle du client, de l'argent et de la livraison sans porter la responsabilité du plat |
| 1 | **Prix** | **Le client paie le prix du restaurant (parité avec le prix sur place)**, plus trois lignes visibles : **frais de livraison**, **frais de service** et, pour le restaurant, une **commission retenue** sur ses ventes (modèle B). Commission **publiée en paliers** ; valeur de départ à tester : **5 %** (décision de Malika), à confirmer par les mesures du premier restaurant-test | Madifood masque sa commission ; la publier est un avantage. Aucune majoration cachée sur les plats |
| 2 | **Argent du restaurant** | **Règlement différé** : Speedfood encaisse, retient sa commission, **reverse le solde à chaque opération, donc chaque jour** (versement quotidien). Aucune avance au ramassage. Les espèces encaissées par le livreur sont **remises chaque jour** à Speedfood ; elles appartiennent en partie au restaurant et sont suivies dans le registre | Cohérent avec « encaisser pour compte de tiers » ; un restaurant payé chaque jour avance moins de marchandise. Le registre à double écriture existe déjà. **Contrainte :** voir « Ce que le versement quotidien exige » |
| 3 | **Livraison** | **Livreurs indépendants de Speedfood**, **payés à la livraison, avec un virement journalier** sur mobile money, **commande envoyée au livreur le plus proche** ; démarrage dans **une ou deux communes denses** ; ajout de salariés en période de pointe plus tard. Les restaurants du mode « autonome » gardent leurs propres livreurs | Reprend ce qui marche (Madifood, Chowdeck) ; densité avant étendue ; module livreur et dispatch déjà construits |
| 4 | **Société** | **Fait à établir, pas une décision d'ingénieur.** Il faut dire quelle entité existe, avec quelle immatriculation et quelle licence ; à défaut, la lancer avant toute vente. À examiner avec le juriste : **séparer l'exploitation du service et l'édition de l'application**, comme le fait Madifood (deux entités) | Une plateforme qui encaisse pour des tiers doit exister légalement ; l'ingénieur ne peut pas l'inventer |

## Ce que cela fixe dans le produit
- **Réglage par restaurant** `mode_vente` : **`autonome`** (comme aujourd'hui : le restaurant tient sa page, ses prix, sa livraison) ou **`speedfood`** (l'équipe tient le catalogue, Speedfood encaisse et livre). Les restaurants du pilote restent `autonome` ; tout nouveau restaurant inscrit par l'équipe passe en `speedfood`.
- **Le panier** affiche : plats (prix du restaurant), livraison, service, total. **Jamais de ligne cachée.** Le prix des plats est le prix du restaurant, recalculé côté serveur.
- **La commission** n'apparaît pas dans le panier du client : elle est retenue sur le versement au restaurant, qui la voit détaillée sur son relevé.
- **Le registre comptable** sépare trois comptes : *argent dû au restaurant*, *recette Speedfood* (commission, service, livraison), *argent du livreur*. Les remboursements passent par ce registre.
- **Les remboursements** se font d'abord par **avoir** (bon d'achat), non par un portefeuille de monnaie électronique, tant que le juriste n'a pas confirmé que cela ne relève pas d'une réglementation de monnaie électronique ; le remboursement sur le moyen de paiement d'origine reste possible en cas de litige.
- **Les textes publics** (conditions, À propos, Restaurateurs, Installer) ne changent **qu'au lancement**, avec le texte validé : conditions générales de vente pour le client, conditions du partenariat avec le restaurant.

## Ce que le versement quotidien exige (à ne pas sous-estimer)
- **Des versements automatisables.** Chap Chap n'a pas encore activé les envois d'argent (PUSH / Payout) sur le compte Speedfood : aujourd'hui les versements sont **manuels** (fonction « confirmer le versement manuel »). Payer chaque jour chaque restaurant et chaque livreur à la main ne tiendra pas au-delà de quelques partenaires. **Prérequis du passage à l'échelle :** obtenir l'activation des envois, ou un autre prestataire.
- **Des frais de virement** à chaque versement (un virement par partenaire et par jour) : ils entrent dans la simulation (valeur supposée 500 GNF le virement, à mesurer).
- **Un seuil de versement** possible (par exemple verser dès que le solde dépasse un montant, sinon le lendemain) pour ne pas payer des frais sur de très petits montants : à décider avec les mesures.
- **Un relevé quotidien** pour chaque restaurant (ventes, commission retenue, solde versé) et pour chaque livreur (livraisons, gains, espèces à remettre).

## Conséquence de la commission à 5 % (simulation, hypothèses)
Avec une commission de 5 %, une livraison facturée 8 000 GNF et un livreur payé 6 000 GNF, la marge par commande tombe à **environ −900 GNF** (la simulation `scripts/simulation-economie-revente.mjs` dit : commission 15 % → +5 200 GNF). Pour que 5 % tienne, **les frais de livraison et de service doivent porter la marge** : par exemple livraison facturée 11 000 GNF (marge +2 100) ou frais de service portés à 4 000 GNF (marge +1 100), ou commission à 10 % (+2 100). Aucune de ces valeurs n'est mesurée : c'est le premier restaurant-test qui tranchera. **Règle de prudence : 5 % est une valeur de départ pour attirer les premiers restaurants ; ne pas la publier comme définitive avant d'avoir mesuré le coût réel d'une livraison.**

## Ce qui reste ouvert (et à qui revient la réponse)
1. **L'existence légale de la société** (point 4) : à Malika.
2. **Les valeurs des paliers de commission** : 5 % est la valeur de départ décidée par Malika ; les paliers suivants (par exemple selon le volume ou le niveau de visibilité) se fixent après les premières mesures, en tenant compte de la conséquence chiffrée ci-dessus.
3. **Le plafond d'espèces pour les nouveaux comptes** et le **panier minimum** : à décider avec les premières données d'échecs de livraison.
4. **L'avis juridique** sur l'encaissement pour compte de tiers, les avoirs et le statut des livreurs : à un juriste guinéen.
