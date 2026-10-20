# Paiement en ligne : architecture technique

**Version :** 0.1, 21 octobre 2026 · **Statut : conception ; implémentation par lots (voir §10).** Complète `docs/STRATEGIE-PAIEMENT.md` (vision, décisions, économie) et `docs/CADRE-JURIDIQUE-LIVREURS.md` (droit). **Rien de ce qui suit n'est actif en production tant que l'interrupteur `paiement_en_ligne_actif` est éteint** (il l'est par défaut) et que le fournisseur est `simulation`.

## 1. Décision d'architecture qui change un principe du projet

`src/lib/paiement/regles.ts` pose aujourd'hui : *« Speedfood ne reçoit, ne détient ni ne vérifie jamais d'argent »* (paiement par code marchand du restaurant, déclaré par le client, confirmé par le restaurateur). Cela **reste vrai** pour les modes existants (`especes`, `orange_money`, `mtn_momo` par code marchand). Un **nouveau mode** `speedfood` (paiement en ligne via une passerelle) fait que **Speedfood encaisse, chez un prestataire agréé, puis verse**. Il est **optionnel**, **recommandé**, **éteint par défaut**, et **cohabite** avec les modes existants. Il n'en supprime aucun.

## 2. Principes non négociables

1. **Speedfood ne détient jamais de solde.** L'argent du client arrive chez le prestataire (compte marchand) ; Speedfood **ordonne** des versements directs au compte mobile money du restaurant et du livreur (décision A de Malika). Aucune table ne représente un « solde » retirable.
2. **Confirmation d'un paiement : uniquement par le prestataire** (notification signée ou interrogation de son API), **jamais** par une déclaration du client, une capture d'écran ou un SMS.
3. **Tout mouvement d'argent est un fait enregistré** dans un **livre de comptes en écriture double, en ajout seul**, équilibré, en GNF entiers.
4. **Idempotence partout** : une notification reçue deux fois, un versement demandé deux fois, une libération déclenchée deux fois ne produisent **qu'un seul effet** (contraintes d'unicité en base, pas seulement du code).
5. **Les écritures passent par le serveur** (clé de service) ; aucune policy d'insertion, de modification ni de suppression pour `anon` ou `authenticated`. Les lectures sont cloisonnées (RLS) : un restaurant ne voit que ses paiements, un livreur que ses versements.
6. **Aucun secret dans le dépôt** (le dépôt GitHub est **public**) : clés d'API, clé de signature, numéros de comptes marchands ne vivent que dans les variables d'environnement.
7. **Le fournisseur est derrière une interface unique.** Changer de prestataire, ou en ajouter un, ne touche ni les états, ni le livre de comptes, ni l'interface.
8. **Tout est réglable et éteint par défaut** : interrupteur général, fournisseur actif, frais, délais, plafonds ; valeurs initiales = **valeurs de simulation** (bandeau tant que Malika ne les a pas validées).

## 3. Modules (`src/lib/paiement/en-ligne/`)

| Fichier | Rôle | Pur ? |
|---|---|---|
| `types.ts` | Types communs : états, événements, opérateurs, montants | oui |
| `machine.ts` | Machine à états du paiement : transitions autorisées, idempotence, événements tardifs | oui |
| `repartition.ts` | Calcul de la répartition (restaurant, livreur, Speedfood, frais mobile) en GNF entiers, avec invariant « la somme égale le total » | oui |
| `ecritures.ts` | Génère les lignes du livre de comptes pour chaque événement (encaissement, frais, libération, versement, remboursement) ; vérifie l'équilibre | oui |
| `litiges.ts` | Moteur de décision automatique des litiges (règles du §7 de la stratégie) avec porte de sortie vers un humain | oui |
| `signature.ts` | Calcul et vérification HMAC-SHA256 en temps constant | oui (Node) |
| `fournisseur.ts` | Interface `PasserelleDePaiement` : encaisser, lire le statut, vérifier une notification, verser, rembourser | types |
| `simulation.ts` | Fournisseur de **simulation** (sans réseau) : produit références et notifications signées | oui |
| `chapchap.ts` | Adaptateur **Chap Chap Pay** : squelette, **non branché** (la référence API est manquante, voir §9) | non |
| `service.ts` (serveur) | Orchestration avec la base : ouvrir un paiement, appliquer une notification, libérer, verser, rembourser, litiges | non |

La route `POST /api/paiement/notification/[fournisseur]` reçoit les notifications : corps **brut**, signature vérifiée **avant** tout traitement, réponse rapide (le guide de Chap Chap annonce 20 secondes).

## 4. Machine à états du paiement

États : `cree` → `en_attente` → `confirme` → `libere`, plus `echoue`, `expire`, `annule`, `rembourse`, `en_litige`.

| De | Événement | Vers |
|---|---|---|
| `cree` | `demander` | `en_attente` |
| `cree` | `annuler` | `annule` |
| `en_attente` | `notification_succes` | `confirme` |
| `en_attente` | `notification_echec` | `echoue` |
| `en_attente` | `notification_annulation`, `annuler` | `annule` |
| `en_attente` | `expiration` | `expire` |
| `confirme` | `liberer` | `libere` |
| `confirme` | `remboursement_total` | `rembourse` |
| `confirme`, `libere` | `ouvrir_litige` | `en_litige` |
| `en_litige` | `clore_litige_liberer` | `libere` |
| `en_litige` | `clore_litige_rembourser` | `rembourse` |
| `expire`, `annule` | `notification_succes` | `confirme` |

La dernière ligne est volontaire : si l'argent arrive **après** une expiration ou une annulation, il **ne doit jamais être perdu de vue** ; il passe à `confirme` et le service décide (remboursement automatique si la commande n'est plus valable). Un événement répété qui ne change rien est un **no-op** (idempotence). Toute autre transition est **refusée** et journalisée.

## 5. Répartition (GNF entiers, arrondis au GNF supérieur pour les frais)

- `total client` = repas + frais de livraison.
- `frais mobile` = plafond de (total × taux ‰ / 1000) ; **supporté par Speedfood** (décision).
- **Restaurant** reçoit : repas − frais fixe Speedfood (+ frais de livraison si la livraison est assurée par le restaurant).
- **Livreur indépendant** reçoit : frais de livraison (100 % au pilote).
- **Speedfood brut** = frais fixe par commande ; **net** = brut − frais mobile − frais de versement. Un net négatif est signalé (**déficit**), pas masqué.
- Invariant testé : restaurant + livreur + Speedfood brut = total client, pour toute entrée.

## 6. Livre de comptes (écriture double, ajout seul)

Comptes : `fonds_operateur` (argent chez le prestataire), `fonds_a_liberer`, `a_verser_restaurant`, `a_verser_livreur`, `produit_speedfood`, `charge_frais_mobile`, `a_rembourser_client`. Chaque **groupe d'écritures** est équilibré (débits = crédits), vérifié par le code **et** par une contrainte déclenchée à la validation de la transaction. Cycle complet : à la fin, `fonds_operateur` = net de Speedfood.

## 7. Libération et événements déclencheurs

Les fonds se libèrent sur un **fait enregistré**, jamais sur une déclaration : livraison → **code de remise** saisi par le livreur (existant) ; retrait → **code de retrait** (à créer) ; à table → commande servie **et** absence de contestation dans une fenêtre réglable. Annulation ou refus après paiement → **remboursement automatique** du client. La libération appelle une fonction idempotente ; un versement par bénéficiaire (`unique (paiement, bénéficiaire)`).

## 8. Sécurité

- Table `paiement_evenements` : journal des notifications reçues avec **clé d'unicité** `(fournisseur, identifiant d'événement)` : un rejeu est ignoré.
- Comptes de versement (numéro mobile money) : lisibles par le **serveur** et le **super administrateur** seulement ; masqués ailleurs ; **vérifiés avant le premier versement** (titulaire cohérent).
- Montants : entiers positifs, plafonds réglables (par paiement, par jour).
- Rapprochement quotidien (lot ultérieur) : paiements confirmés, versements, écritures ; alerte sur tout écart.
- Journalisation de chaque transition d'argent (acteur, règle, preuves).

## 9. Ce que cette architecture ne sait PAS encore (dépend de Chap Chap Pay)

Endpoint de création d'un paiement (PULL), chaîne exacte à signer, format des notifications, API de versement (PUSH), remboursement, sandbox, délais de règlement, frais, codes d'erreur. **Aucun de ces éléments n'est deviné** : l'adaptateur `chapchap.ts` refuse de fonctionner (erreur explicite « référence API requise ») tant qu'ils ne sont pas fournis. Seul est utilisé ce que le guide public confirme : URL de base, en-têtes `CCP-Api-Key` et `CCP-HMAC-Signature`, algorithme HMAC-SHA256, statuts de notification, besoin d'idempotence.

## 10. Lots

| Lot | Contenu | Argent réel ? |
|---|---|---|
| **P1** | Modules purs + tests : états, répartition, écritures, litiges, signature, simulation | Non |
| **P2** | Migration : tables, contraintes d'unicité, équilibre du livre, RLS ; tests de cloisonnement ; contrôle de sécurité de la base | Non |
| **P3** *(fait, 21 octobre 2026)* | `service.ts` (orchestration derrière deux ports : `DepotPaiement`, `PasserelleDePaiement`), `depot-supabase.ts`, `fabrique.ts`, route `POST /api/paiement/notification/[fournisseur]`, branchement dans `apres-commande.ts` (commande terminée → libération ; refusée ou annulée → remboursement). Testé de bout en bout avec un dépôt en mémoire (`paiement-service.test.mts`). **Pas encore appelé par l'interface** : aucun écran ne crée de paiement (P4) | Non |
| **P4** | Écran client (choix recommandé du paiement en ligne), écran restaurant (statut), écran d'administration (paiements, versements en échec, litiges), réglages | Non |
| **P5** | Adaptateur Chap Chap Pay réel : **après réception de la Référence API, de clés de test et d'un accord écrit** | Test d'abord |
| **P6** | Rapprochement quotidien, plafonds, surveillance, bascule en production : **après avis juridique et validation de Malika** | Oui |

**Règle :** aucun lot n'active le paiement en production ; seul P6, décidé par Malika, le fera.

## 11. Lot P3 : ce qui existe, ce qui reste volontairement fermé

**Existe.** `ouvrirPaiement` (montants lus en base, jamais du navigateur ; idempotent), `appliquerNotification` (signature, journal d'idempotence, montant attendu, succès tardif remboursé), `libererPaiement` (livre, un versement par bénéficiaire, versement « pris » par compare-and-set avant l'appel au prestataire, reprise possible), `rembourserTotal` (avant libération seulement), `ouvrirLitige` (deux décisions automatiques, tout le reste à un humain, paiement gelé), `surCommandeTerminee`, `surCommandeAnnulee`, `expirerSiBesoin`.

**Reste fermé volontairement.**
- Aucune interface ne crée de paiement : sans écran (P4) et sans interrupteur allumé, rien de ceci ne s'exécute. Le branchement de `apres-commande.ts` ne fait qu'une lecture légère par transition terminale et ne fait rien tant qu'il n'existe pas de ligne dans `paiements`.
- Un paiement échoué, expiré ou annulé ne se relance pas (une commande = un paiement ; contrainte d'unicité). Le client choisira un autre mode ; la reprise sera décidée en P4.
- Remboursement partiel et remboursement après libération : `a_humain` (aucun retrait automatique chez un tiers).
- Expiration : la fonction existe, aucune tâche planifiée ne l'appelle encore (P4/P6).
- Rapprochement avec le prestataire, versement resté « envoyé » après une panne : lot P6.
- Simulation : la notification est forgée par `fabriquerNotification` ; en ligne, elle exige `PAIEMENT_SIMULATION_CLE` (secret du Worker), sans valeur par défaut.
