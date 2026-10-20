# Paiement par Speedfood : vision, décisions et feuille de route par étapes

**Date :** 20 octobre 2026 · **Statut :** vision et décisions de Malika ; **rien n'est implémenté**. Ce n'est pas un avis juridique (voir `docs/CADRE-JURIDIQUE-LIVREURS.md`). Les chiffres de ce document sont des **valeurs de simulation** ou des estimations non confirmées, signalées comme telles.

## 1. Vision

Que le paiement passe par Speedfood, comme sur les grandes plateformes : le client paie la plateforme, l'argent est sécurisé, puis le restaurant et le livreur sont crédités **dès que l'opération est réussie** (repas livré ou remis). Le paiement **n'est pas obligatoire** : il est **recommandé**, et le client choisit parmi les modes prédéfinis dans l'application.

## 2. Décisions de Malika (20 octobre 2026)

| Sujet | Décision |
|---|---|
| Adhésion du client | **Optionnelle et recommandée** : le client choisit parmi des modes prédéfinis (espèces à la livraison, paiement au restaurant, paiement en ligne via Speedfood) ; le paiement en ligne est présenté comme le choix recommandé |
| Frais de paiement mobile | **Supportés par Speedfood** (ni le client, ni le restaurant, ni le livreur) |
| Trésorerie des restaurants et livreurs | **Crédités dès qu'une opération est réussie**, sans attente d'un cycle hebdomadaire |
| Fraude et litiges | **Traités par le système** (règles automatiques, avec une porte de sortie humaine, voir §7) |
| Façon de créditer | **A : versement direct** sur le compte mobile money du restaurant et du livreur à chaque opération réussie ; **aucun solde détenu par Speedfood** (décision du 20 octobre 2026) |

## 3. Ce que dit le droit guinéen (lu dans le recueil de la BCRG)

Voir `CADRE-JURIDIQUE-LIVREURS.md` §2.2 pour la décision D/2015/003/CAM. Rappel de ce qui compte ici :

- **Détenir de l'argent de clients contre une valeur stockée, acceptée par d'autres, est de la monnaie électronique** : réservée aux établissements agréés (société anonyme, conseil d'administration, agrément du Comité des agréments), banques et institutions de microfinance.
- **Capital minimum d'un établissement de monnaie électronique : 2 milliards de GNF** (décision D/2015/008/CAM de 2015 ; **à vérifier**, il a pu être révisé).
- Les fonds reçus sont **le gage exclusif des porteurs**, placés dans un **compte fiduciaire** au nom des clients (art. 21), non saisissables et non utilisables à d'autres fins.
- Identification des clients, déclaration des opérations suspectes à la CENTIF, traitement des plaintes des clients sous 30 jours (art. 46, qui vise les établissements agréés).
- Un **accepteur** (entreprise qui reçoit des règlements en monnaie électronique d'un établissement agréé, par contrat) est une catégorie prévue par la décision (art. 1). **C'est le statut que Speedfood peut raisonnablement viser, avec un partenaire agréé.**

**Ce que je n'ai pas pu établir :** si un encaissement **pour le compte de tiers** (le restaurant, le livreur) avec libération différée fait de Speedfood un prestataire de paiement. **À poser à un avocat et à l'opérateur.**

## 3 bis. Fournisseur retenu : Chap Chap Pay (21 octobre 2026)

Malika a choisi de passer par **Chap Chap**. Ce que j'ai pu établir **sur leur site public** (chapchappay.com, pages d'accueil, guide et contact lues le 20 octobre 2026) :

- **Société :** Chap Chap Pay SARL, Conakry. Se présente comme « agréée par la Banque Centrale de la République de Guinée » : **aucun numéro ni date d'agrément n'est affiché ; à vérifier auprès de la BCRG** (qui indique 11 établissements de monnaie électronique agréés fin 2025, sans les nommer dans les textes que j'ai lus).
- **Services annoncés :** paiement marchand et e-commerce, **QR code**, **API « PULL »** (encaissement à la demande ou récurrent), **API « PUSH »** (envoi d'argent vers wallets, comptes bancaires, cartes prépayées). Partenaires de paiement : PayCard, Orange Money, MTN MoMo, Visa/MasterCard, Kulu, Soutra Money, Akiba.
- **Technique, dans le guide public :** URL de base unique `https://chapchappay.com/api` ; en-tête de clé `CCP-Api-Key` (clé **Test** et clé **Production**, le mode dépend de la clé) ; signature **HMAC-SHA256** en-tête `CCP-HMAC-Signature` pour PULL et PUSH ; **webhooks** avec réessais, réponse attendue sous 20 secondes, statuts `success`, `failed`, `canceled`, `expired`, `error`, notifications **possiblement multiples** donc à traiter de façon idempotente ; un endpoint documenté : `POST /api/ecommerce/operation` (exemple en GNF).
- **Contact :** contact@, support@ et sales@ chapchappay.com ; téléphone +224 613 13 60 60 (lundi au vendredi, 8 h à 18 h).
- **Ce que le guide public ne donne PAS** (renvoi à une « Référence API » que je n'ai pas pu lire) : endpoint et paramètres de PULL, vérification de statut, **chaîne exacte à signer**, format du webhook, détails de PUSH, **remboursement**, **sandbox** (URL et comportement), **délais de règlement**, **frais** (« tarification transparente » sans grille), codes d'erreur, limites.
- **« Chap Chap Money » :** le site public ne mentionne que Chap Chap Pay. **À confirmer par Malika** qu'il s'agit bien du même service (sinon, de quel produit parle-t-on).

**Conséquence :** ces informations **ne remplacent pas** les questions du §9 : les frais, le délai de règlement, le remboursement et les conditions de PUSH restent à obtenir **auprès de Chap Chap**. L'architecture (voir `docs/PAIEMENT-ARCHITECTURE.md`) est construite **sans dépendre** de ces réponses : une couche d'adaptation isole le fournisseur, et un fournisseur de **simulation** permet de tout tester sans argent.

## 4. Étapes

| Étape | Ce que fait Speedfood | Détient-il l'argent ? | Prérequis |
|---|---|---|---|
| **0. Aujourd'hui** | Paiement « déclaré » par le client, confirmé par le restaurant dans sa console | Non | Rien (existant) |
| **1. Paiement vérifié** | Le client paie le restaurant par Orange Money ou MTN MoMo avec une référence unique ; la confirmation vient de l'**opérateur** (jamais d'une capture ou d'un SMS du client) | Non | Contrat marchand côté restaurant, intégration |
| **2. Encaissement chez un partenaire agréé** | Speedfood est **accepteur** : l'argent arrive dans son compte marchand chez l'opérateur ; à la livraison confirmée, Speedfood **verse** au restaurant et au livreur par l'API de versement de l'opérateur | **Chez le partenaire**, pas chez Speedfood | Accord avec l'opérateur, **avis juridique** sur l'encaissement pour compte de tiers, trésorerie de roulement (§6) |
| **3. Portefeuille en marque blanche** | Un établissement agréé fait tourner le portefeuille sous la marque Speedfood | Non (c'est le partenaire) | Partenariat commercial |
| **4. Établissement propre** | Speedfood est l'émetteur | Oui | Capital de 2 milliards de GNF ou plus, agrément, conformité : seulement à grande échelle |

La décision de Malika (optionnel, recommandé, versement immédiat) est **compatible avec les étapes 1 à 3**. Elle **n'impose pas** l'étape 4.

## 5. Quand l'argent est « libéré » : événements déclencheurs

Le déclencheur est un **fait enregistré par le système**, pas une déclaration d'une partie :

| Cas | Événement qui libère les fonds |
|---|---|
| Livraison | Le livreur saisit le **code de remise** à 4 chiffres, donné au seul client (existant) |
| Retrait au restaurant | Le client donne un **code de retrait** au restaurant, ou scanne le QR du comptoir (**à créer**, même principe que le code de remise) |
| À table | Le restaurant marque la commande servie **et** le client ne conteste pas dans une courte fenêtre (**règle à fixer**) |
| Annulation par le restaurant ou refus | Remboursement automatique du client (§7) |

Répartition à la libération : part du restaurant (repas), part du livreur (frais de livraison, 100 % pour le pilote), part de Speedfood (frais par commande, voir §6), **moins** les frais de paiement mobile, que **Speedfood supporte** (décision).

## 6. Économie : ce que coûtent vos décisions

**Frais de paiement mobile.** Estimation **non confirmée** (un blog, 2026) : environ **1,5 % (Orange Money) à 1,7 % (MTN MoMo)** du montant. Speedfood les supporte. Exemples avec des **valeurs de simulation** (repas de 25 000 GNF, frais de livraison de 5 000 GNF, frais fixe de Speedfood de 1 000 GNF par commande) :

| Cas | Frais de paiement mobile | Ce qui reste du frais fixe de 1 000 GNF |
|---|---|---|
| Retrait, repas de 25 000 GNF | 375 à 425 GNF | 575 à 625 GNF |
| Livraison, repas 25 000 + frais 5 000 | 450 à 510 GNF | 490 à 550 GNF |

**Constat : le frais de paiement mobile absorbe environ 40 à 50 % de votre frais fixe par commande payée en ligne.** Trois leviers, à décider plus tard : relever le frais fixe, le moduler selon le mode de paiement, ou ne le facturer qu'à une partie des commandes. Une commande payée en espèces ne coûte rien en frais de paiement : c'est une raison de plus pour que le paiement en ligne reste **optionnel** et pas imposé.

**Versement immédiat à chaque opération réussie.** Trois coûts à connaître, **inconnus à ce stade** (à demander aux opérateurs) :
1. **Frais de versement** : chaque versement au restaurant et au livreur peut coûter un frais de transfert, deux fois par commande livrée.
2. **Délai de règlement** : l'argent du client n'est peut-être pas disponible immédiatement dans le compte marchand de Speedfood. Verser avant d'être réglé exige une **trésorerie de roulement** (de l'ordre d'une journée de commandes en ligne).
3. **Annulations après versement** : récupérer de l'argent déjà versé à un restaurant ou à un livreur est difficile. D'où la règle : on ne verse que sur un **événement déclencheur** (§5).

**Deux façons de « créditer »** (décision en attente, voir la question en §10) :
- **A. Versement direct** sur le compte mobile money du restaurant et du livreur à chaque opération réussie : **aucun solde n'est détenu** par Speedfood. Compatible avec l'étape 2.
- **B. Solde interne** dans l'application, que chacun retire quand il veut : plus pratique, mais **c'est de la détention de fonds de tiers, donc de la monnaie électronique** : étape 3 ou 4 seulement.

## 7. Fraude et litiges gérés par le système

Principe : le système décide **par règles objectives**, avec des **preuves horodatées**, et **toute décision peut être contestée devant un humain** (porte de sortie obligatoire : la protection des clients vue en §3 s'applique aux établissements agréés, et il serait imprudent qu'aucun humain ne puisse corriger une erreur d'argent).

### Fraude (à éviter d'abord)
- **Confirmation de paiement uniquement par l'opérateur** (webhook ou interrogation de l'API), jamais par SMS ou capture envoyés par le client ; vérification du **montant**, de la **référence** et du **compte** ; traitement **idempotent** (un même paiement ne libère rien deux fois).
- Rapprochement quotidien des paiements reçus et des versements effectués ; alerte sur tout écart.
- Plafonds par client et par jour, ralentissement des comptes neufs, détection de motifs anormaux (même appareil, même numéro, remboursements répétés).
- Le livreur ne reçoit jamais d'argent hors de la plateforme pour une commande payée en ligne.

### Litiges : règles automatiques (valeurs de simulation, réglables)
| Situation | Décision automatique | Preuves utilisées |
|---|---|---|
| Restaurant refuse ou annule après paiement | Remboursement intégral du client, aucun versement | Statut de la commande |
| Livreur ne livre pas (aucun code saisi dans le délai) | Remboursement du client ; le restaurant reste payé si la commande a été prête et remise au livreur | Horodatages, position du livreur, remise du colis |
| Client injoignable à la livraison | Restaurant payé, frais de livraison dus, pas de remboursement | Tentatives d'appel, position, code non saisi |
| Plat manquant ou erroné signalé par le client | Remboursement partiel plafonné **ou** envoi à un humain selon le montant | Signalement avec photo |
| Contestation du client après libération | **Envoi à un humain** | Journal complet |

Chaque décision est **journalisée** (qui, quand, règle appliquée, preuves) et visible des parties. Le système doit aussi pouvoir dire « je ne sais pas » et passer la main.

## 8. Contraintes de conception (pour l'architecture, dès maintenant)

1. **Aucune logique de paiement dans l'interface** : le paiement passe par une **interface unique** (fournisseur de paiement), de façon à brancher l'étape 1 puis 2 sans refonte. Un mode « simulation » (déjà dans la philosophie du projet pour les livreurs) permet de tout tester sans argent réel.
2. **Machine à états du paiement** séparée de celle de la commande : `non_demande` → `en_attente` → `confirme_par_operateur` → `libere` / `rembourse` / `en_litige`. Les états existants (`declare`, `especes`, `recu`…) restent valables pour l'étape 0.
3. **Toutes les écritures par le serveur** (clé de service), jamais par le navigateur ; **aucun secret** dans le code, les migrations ni les tests ; les identifiants de comptes marchands et clés d'API des opérateurs vivent uniquement dans les variables d'environnement (le dépôt est public).
4. **Montants en GNF entiers** (règle du projet), arrondis documentés ; un registre d'écritures (**livre de comptes**) par opération : encaissement, frais, part restaurant, part livreur, part Speedfood, versements.
5. **Journalisation immuable** de chaque transition d'argent.

## 9. Ce qu'il faut demander, et à qui

**À Orange Money et à MTN MoMo Guinée :**
1. Un **contrat marchand** pour une plateforme est-il possible ? Conditions, documents, délai, frais exacts ?
2. Existe-t-il une **API** d'encaissement avec confirmation automatique, et une API de **versement** à des tiers (restaurants, livreurs) ?
3. **Délai de règlement** des sommes encaissées vers le compte marchand ?
4. **Frais de versement** par transfert, plafonds par jour et par bénéficiaire ?
5. Existe-t-il une fonction de **séquestre** ou de libération conditionnelle ?
6. **Remboursement** d'un paiement : possible, frais, délai ?

**À un avocat guinéen (à ajouter à la liste de `CADRE-JURIDIQUE-LIVREURS.md` §6) :**
7. Speedfood, **accepteur** d'un établissement agréé, peut-il encaisser pour le compte de restaurants et de livreurs et leur verser ensuite, sans être lui-même prestataire de paiement agréé ?
8. Un **mandat d'encaissement** donné par chaque restaurateur à Speedfood change-t-il l'analyse ?
9. Le **versement immédiat** vers le compte mobile du livreur et du restaurant pose-t-il un problème ?

## 10. Décision prise : comment créditer

**A (versement direct)**, décidée par Malika le 20 octobre 2026 : Speedfood verse sur le compte mobile money du restaurant et du livreur à chaque opération réussie, sans détenir de solde. La variante B (solde interne retirable) est écartée tant qu'aucun partenaire agréé ne fait tourner un portefeuille. **Conséquences à traiter :** frais de versement à chiffrer (question 4 du §9), trésorerie de roulement (§6), chaque restaurant et chaque livreur doit renseigner un compte mobile money valide et à son nom (à vérifier avant le premier versement).

## 11. Risques à ne pas oublier

- **Adoption** : le liquide domine (la BCRG évoque une crise du cash et indique que 94 % des billets restent hors du circuit bancaire, communiqué du 26 août 2025). Un paiement en ligne **optionnel** réduit ce risque.
- **Marge** : les frais de paiement mobile (§6) peuvent consommer près de la moitié du frais fixe.
- **Confiance** : une plateforme jeune qui reçoit de l'argent doit montrer des règles claires, des reçus et une assistance joignable.
- **Volume** : 9 commandes réelles en trois semaines (20 octobre 2026) : ce chantier n'est utile qu'avec une densité de restaurants et de clients.
