# Remboursements sur Speedfood : dossier d'analyse pour le conseil juridique

Version du 10 novembre 2026. Préparé à la demande de Malika. **Ce document n'est pas un avis juridique.** Il décrit ce que fait la plateforme aujourd'hui, ce qu'elle ne sait pas faire, et pose des questions. Il n'affirme aucune règle de droit.

## 1. Objet et mode d'emploi

1. **À quoi sert ce document.** Il rassemble les faits dont le conseil juridique a besoin pour arbitrer les remboursements entre le client, le restaurant, le livreur et Speedfood. Les faits sont tirés du code et des documents du projet. Quand un fait n'a pas pu être vérifié, c'est écrit « non vérifié ».
2. **Ce qu'il n'est pas.** Ni un avis juridique, ni une décision. Les règles automatiques de la plateforme (section 4) sont des **hypothèses de départ choisies par l'équipe**, réglables, « à titre indicatif ». Aucune n'est présentée comme une obligation.
3. **Deux situations à couvrir.** Malika demande que la solution prévoie le cas **avec Chap Chap Pay** et le cas **sans Chap Chap Pay**. Chaque situation est donc décrite selon le mode de paiement (section 2).
4. **Comment répondre.** La section 8 pose des questions numérotées. Le conseil peut répondre par le numéro (« Q12 : oui, dans tel cas... »). Une réponse, même partielle, suffit à faire avancer la mise en œuvre (section 9).
5. **Lecture rapide.** Pour un premier tour : sections 2, 5 puis 8. Les fiches détaillées (section 4) servent de référence.

**Règle produit en vigueur (Malika, 3 novembre 2026).** Speedfood ne manipule jamais d'espèces. À terme, tout paiement passera par Chap Chap Pay. En attendant son ouverture, les modes « code marchand » (Orange Money, MTN MoMo) restent provisoires.

## 2. Les acteurs et qui détient l'argent

### 2.1 Les acteurs

| Acteur | Rôle | Remarque |
|---|---|---|
| Client | Commande et paie. Reçoit un code à 4 chiffres à l'acceptation de sa commande en livraison (le « code de remise »). | Peut commander sans paiement en ligne. Ne peut annuler lui-même que tant que le restaurant n'a pas répondu. |
| Restaurant | Accepte ou refuse la commande, prépare, la déclare prête. | Un restaurant = un compte indépendant sur la plateforme. |
| Livreur du restaurant (mode « propre ») | Personnel du restaurant, qui livre avec le code du client. | Pas de répartition par la plateforme. Dans le paiement en ligne, les frais de livraison reviennent alors au restaurant. |
| Livreur Speedfood (mode « speedfood ») | Livreur du registre de la plateforme, approuvé par l'exploitation, qui reçoit des offres de course. | Le code l'appelle « livreur indépendant ». Son statut juridique réel est une question pour le conseil (Q3). |
| Speedfood | Met en relation, applique les règles, prend des frais fixes par commande. | Décision de Malika : les frais du prestataire de paiement sont supportés par Speedfood. |
| Prestataire de paiement | Chap Chap Pay (seul prestataire réel prévu). | Un prestataire de « simulation » existe pour la démonstration : aucun argent réel. |
| Exploitation Speedfood | Équipe d'assistance (rôle « support ») et propriétaire (rôle « super administrateur »). | Seuls à pouvoir trancher un litige et enregistrer un remboursement. |

### 2.2 Tableau A : paiement par « code marchand » (mode actuel, provisoire)

Le client paie **directement le restaurant** avec le code marchand du restaurant (Orange Money ou MTN MoMo). Il déclare son paiement dans l'application. Le restaurateur confirme (« reçu » ou « pas reçu »).

| Question | Réponse d'après le code et les documents |
|---|---|
| Qui reçoit l'argent ? | Le restaurant, sur son propre compte mobile money. |
| Speedfood détient-il l'argent ? | Non. Les documents disent : Speedfood « ne reçoit, ne détient et ne vérifie aucun argent ». |
| Qui confirme que le paiement a eu lieu ? | Le restaurateur. Le client ne fait qu'une déclaration (avec une référence de transaction facultative). Aucune vérification par un opérateur. |
| Que contient le total payé ? | Le repas, et en livraison les frais de livraison (ils sont dans le total de la commande). |
| Comment le livreur Speedfood est-il payé de ses frais de livraison dans ce mode ? | **Non établi.** Un document de conception (non implémenté, d'après la recherche faite dans le code) prévoyait un paiement en espèces au livreur à la porte, ce qui est contraire à la règle du 3 novembre. À clarifier (Q4). |
| La plateforme a-t-elle un moyen de rembourser le client ? | Non. Aucune fonction de remboursement n'existe pour ce mode. Le remboursement se règle entre le client et le restaurant, hors plateforme. |
| Que fait la plateforme en cas de problème ? | Elle indique au client d'appeler l'assistance. Les règles de litige automatiques (section 4) ne s'appliquent pas : elles ont besoin d'un « paiement en ligne » enregistré. |
| Traces dans le système | Mode choisi, référence déclarée, date de déclaration, date de réception confirmée par le restaurateur, statut du paiement sur la commande. |

### 2.3 Tableau B : paiement en ligne par Chap Chap Pay (mode cible, non allumé)

Le client paie une page hébergée par Chap Chap Pay. L'argent arrive sur le **compte marchand de Speedfood chez Chap Chap Pay**. Quand la commande est terminée, Speedfood **ordonne des versements** au restaurant et au livreur. Les frais du prestataire sont déduits chez Speedfood.

| Question | Réponse d'après le code et les documents |
|---|---|
| Qui reçoit l'argent d'abord ? | Le compte de Speedfood chez Chap Chap Pay. Un document d'architecture dit « Speedfood ne détient jamais de solde » (au sens d'un solde interne retirable). Une note d'intégration précise qu'en réalité le solde existe chez Chap Chap Pay, **au nom de Speedfood**, et que de l'argent de tiers y transite. Cette note la présente comme une question juridique à poser à l'avocat avant tout argent réel (Q1). |
| Quand l'argent est-il « libéré » ? | Quand la commande passe à « terminée » : livraison confirmée par le code de remise, ou commande marquée terminée par le restaurant (retrait, sur place). Il n'y a pas de fenêtre de contestation avant libération (la stratégie en prévoyait une « à fixer », non réalisée). |
| Comment l'argent est-il réparti ? | Total payé = repas + frais de livraison. Le restaurant reçoit le repas moins le frais fixe de Speedfood (plus les frais de livraison si c'est lui qui livre). Le livreur Speedfood reçoit 100 % des frais de livraison (valeur du pilote). Speedfood garde son frais fixe. La somme des parts égale toujours le total. |
| Exemple fictif | Repas 25 000 GNF, livraison 5 000 GNF, frais fixe Speedfood 1 500 GNF. Restaurant : 23 500. Livreur : 5 000. Speedfood brut : 1 500. Frais du prestataire mesurés en test (200 GNF + 2 % du total) : 800. Reste pour Speedfood : 700. |
| Que dit le prestataire sur le remboursement ? | **Aucun point d'accès de remboursement dans la documentation lue.** Voir la section 6. |
| Comment les versements sont-ils faits ? | Le service « envoyer de l'argent » (PUSH) de Chap Chap Pay n'est pas activé sur le compte de Speedfood. Les versements sont donc faits à la main par le propriétaire depuis le compte du prestataire, puis enregistrés avec la référence du transfert. |
| État d'avancement | Le code existe et a été essayé en mode test (1 000 à 10 000 GNF, comptes de test). Allumage refusé par l'écran des réglages. La vérification d'entreprise (KYC) de Speedfood chez Chap Chap Pay est à 0 %. L'état réel de l'interrupteur en production n'a pas été vérifié par cette analyse. |
| Traces dans le système | Voir la section 7. |

### 2.4 Tableau C : autres cas présents dans le code

| Cas | Ce que c'est | Qui détient l'argent |
|---|---|---|
| Prestataire de « simulation » | Mode de démonstration du paiement en ligne. Reproduit le parcours complet (y compris un remboursement automatique qui « réussit ») avec de faux paiements. Ne peut être allumé qu'avec une clé de démonstration. | Personne : aucun argent réel. |
| Paiement « espèces » (anciennes commandes) | Mode ancien, **retiré des choix proposés** aux clients. La base contient 0 commande en espèces au 9 novembre 2026. La lecture des anciennes lignes est conservée. | Le restaurant (ou le livreur). Hors règle produit. |
| Règlement d'une table sur place (ardoise) | Le personnel clôture la table en indiquant le mode de règlement. L'inventaire du 9 novembre a signalé que l'ancien choix « espèces » y subsiste (en cours de traitement par le lot M1 selon le plan). Speedfood n'encaisse rien. | Le restaurant. |
| Autre prestataire que Chap Chap Pay | **N'existe pas dans le code.** La base n'accepte que « simulation » et « chapchap » comme prestataires. En ajouter un demanderait un changement de la base. | Sans objet. |

## 3. Le parcours d'une commande et les moments où un remboursement se pose

Le parcours ci-dessous suit le code. Les mots entre guillemets sont les états réels des commandes.

1. **Commande envoyée (« en attente »).** Le client a envoyé sa commande. Rien n'est payé. Le code marchand n'est pas montré. Le client peut encore **annuler lui-même**.
2. **Réponse du restaurant.** Le restaurant **accepte** (« acceptée »), **refuse** (« refusée »), ou propose une **révision** du prix ou des conditions que le client doit accepter. Un refus est possible seulement à ce stade.
3. **Paiement.** Il s'ouvre **après l'acceptation**. Mode code marchand : le client voit le code, paie, déclare. Mode en ligne : une page de paiement est créée ; elle expire chez Speedfood au bout de 15 minutes (réglable), alors que le lien de Chap Chap Pay vit 72 heures.
4. **Préparation.** Le restaurant prépare. Il peut encore **annuler** la commande acceptée. Le client, lui, doit appeler l'assistance.
5. **Prête (« prête »).** Le restaurant déclare la commande prête.
6. **Remise au livreur.** Pour une livraison : le livreur se rend au restaurant et marque la commande « récupérée ». La plateforme enregistre l'heure.
7. **Livraison, retrait ou sur place.**
   - Livraison : le livreur donne la commande et saisit le code à 4 chiffres du client (5 essais maximum). La livraison passe à « livrée » et la commande à « terminée ».
   - À emporter : le restaurant marque la commande terminée. Il n'existe pas de code de retrait dans le code lu.
   - Sur place : le personnel marque la commande servie et clôture la table.
8. **Libération et versements (paiement en ligne seulement).** À « terminée », la plateforme libère l'argent et ordonne les versements au restaurant et au livreur.
9. **Après la remise.** Le client peut contester. Aucun écran du client, du restaurant ou du livreur ne permet d'ouvrir un litige aujourd'hui (voir la fiche S5 et la note ci-dessous).

**Moments où un remboursement se pose :**

- **Avant le paiement** : rien à rembourser.
- **Entre le paiement et la remise** : l'argent est chez Speedfood (Chap Chap Pay), ou chez le restaurant (code marchand).
- **Après la libération** : l'argent est parti chez les bénéficiaires (paiement en ligne), ou il est depuis le début chez le restaurant (code marchand).

**Note importante sur les litiges.** Le moteur de règles décrit à la section 4 existe et est testé. Mais, d'après la recherche faite dans le code, **aucun écran ni aucune route n'appelle l'ouverture d'un litige par le client, le restaurant ou le livreur**. Seuls deux déclencheurs existent : (a) le système ouvre lui-même un litige quand un remboursement automatique est impossible ; (b) l'exploitation tranche ensuite. Les cinq situations de litige sont donc aujourd'hui des **règles prêtes mais non branchées** à une demande d'utilisateur.

## 4. Catalogue des situations

Dans chaque fiche, « le système décide aujourd'hui » décrit **fidèlement le code**. Les montants de l'exemple (repas 25 000 GNF, livraison 5 000 GNF, total 30 000 GNF) sont fictifs. Les seuils (30 % et 50 000 GNF) sont des **valeurs de simulation**, réglables, non validées.

**Vocabulaire des suites possibles dans le système :**

- **Remboursement automatique** : la plateforme rend l'argent au client sans intervention.
- **Gel** : le paiement passe « en litige » ; plus rien ne peut être libéré ni versé sans décision.
- **À un humain** : le litige est confié à l'exploitation, qui choisit entre trois boutons : « Rembourser le client » (remboursement total par le prestataire), « Remboursé à la main » (total, hors plateforme, avec trace) ou « Libérer l'argent ». Un **motif écrit** est obligatoire.

### S1. Le restaurant refuse ou annule après le paiement en ligne

- **Ce qui s'est passé.** La commande a été acceptée et payée en ligne. Puis le restaurant l'annule (ou, plus rarement, la refuse si le paiement avait été ouvert avant sa réponse).
- **Responsabilité possible.** Restaurant. Le client n'a rien reçu.
- **Preuves dans le système.** Statut de la commande et historique des changements de statut avec **qui** (identifiant du membre du restaurant) et **quand**. Date de confirmation du paiement.
- **Ce que le système décide aujourd'hui.** Règle : **remboursement total** (repas + livraison), **personne n'est payé**, aucune perte pour Speedfood. Le déclenchement est **automatique** dès que la commande passe à « annulée » ou « refusée » : la plateforme tente de rembourser. Si le paiement n'était encore que demandé ou en attente, il est simplement annulé (aucun argent n'a bougé).
- **Ce qui part vers un humain.** Si le prestataire ne sait pas rembourser, ou est en panne : le paiement est **gelé** et un litige « à faire à la main » est créé pour l'exploitation.
- **Résultat par mode.**
  - Code marchand : aucun traitement par la plateforme. Le restaurant a reçu l'argent ; le remboursement relève du restaurant, hors système.
  - Chap Chap Pay aujourd'hui : gel, litige à la main, l'exploitation rend l'argent depuis le compte du prestataire et enregistre le remboursement.
  - Chap Chap Pay si un remboursement automatique devient disponible : le code d'appel au prestataire existe ; le remboursement serait automatique.

### S2. Le livreur ne livre pas

- **Ce qui s'est passé.** La commande est partie en livraison mais n'arrive jamais chez le client (livreur injoignable, abandon, panne, échec déclaré).
- **Responsabilité possible.** Livreur, éventuellement restaurant (si la commande était mal préparée), éventuellement client (adresse fausse). À qualifier.
- **Preuves dans le système.** Heures de chaque étape de la livraison (affectée, récupérée, livrée), statut « échec » avec une raison libre de 300 caractères maximum, nombre d'essais de code, dernière position connue du livreur avec son heure, points de départ et d'arrivée de la course. **Pas d'historique de trajet** dans ce qui a été lu (non vérifié exhaustivement). Un suivi d'incidents (retard, colis perdu, litige) existe pour l'exploitation, avec une résolution en texte (« relivraison », « avoir », « remboursement manuel », « aucune »), **sans lien avec l'argent**.
- **Ce que le système décide aujourd'hui.** La règle conclut toujours : **remboursement total au client**, le livreur n'est **pas payé**. Deux variantes :
  - Commande **pas encore récupérée** par le livreur : le restaurant n'est pas payé. Le code applique alors le remboursement automatiquement.
  - Commande **déjà récupérée** : la règle dit que le restaurant reste payé de son repas, **à la charge de Speedfood** (le client est remboursé). Le code **n'applique pas** cette variante tout seul : elle part à un humain, avec la recommandation enregistrée. Détail : le montant de la perte de Speedfood est calculé sur le repas entier, alors que le restaurant reçoit en réalité le repas moins le frais fixe de Speedfood (écart à confirmer).
- **Ce qui part vers un humain.** Le cas « déjà récupérée ». De plus, **aucune chaîne n'ouvre le litige** : la livraison déclarée en échec ne déclenche rien du côté du paiement, et le code ne contient pas de minuterie « aucun code saisi dans le délai » (la stratégie la mentionnait).
- **Limite d'exécution.** Les trois boutons de l'exploitation ne permettent pas « rembourser le client et payer quand même le restaurant ». Cette combinaison n'est exécutable qu'à la main hors plateforme.
- **Résultat par mode.**
  - Code marchand : le client a payé le restaurant. La plateforme ne rend rien ; le livreur n'a pas livré. Qui rembourse, et qui supporte la perte du repas : à trancher (Q7, Q9).
  - Chap Chap Pay aujourd'hui : avant récupération, gel puis remboursement à la main (le prestataire ne rembourse pas) ; après récupération, humain.
  - Chap Chap Pay avec remboursement : avant récupération, remboursement automatique ; après récupération, humain.

### S3. Le client est injoignable à la livraison

- **Ce qui s'est passé.** Le livreur arrive, le client ne répond pas ou n'ouvre pas, aucun code n'est saisi.
- **Responsabilité possible.** Client. À qualifier (adresse imprécise, téléphone éteint, etc.).
- **Preuves dans le système.** Heures de livraison, dernière position du livreur, coordonnées de destination, téléphone du client. **Aucun journal d'appels** ni de tentatives de contact n'est enregistré (la stratégie parlait de « tentatives d'appel » : non réalisé).
- **Ce que le système décide aujourd'hui.** Règle : **aucun remboursement**, le restaurant et le livreur sont payés, Speedfood garde son frais. Appliquée **automatiquement** (libération du paiement) tant que l'argent n'est pas déjà libéré.
- **Ce qui part vers un humain.** Rien dans la règle. Mais **personne ne peut ouvrir ce litige** aujourd'hui (voir la note de la section 3). Le paiement reste « confirmé » et la commande « prête » tant qu'un humain n'intervient pas.
- **Résultat par mode.**
  - Code marchand : le restaurant garde l'argent ; le livreur est payé selon un arrangement non établi (Q4).
  - Chap Chap Pay aujourd'hui : libération et versements (faits à la main pour l'instant).
  - Chap Chap Pay avec remboursement : identique ; la question ne se pose pas.

### S4. Plat manquant ou erroné

- **Ce qui s'est passé.** Le client a reçu la commande mais signale un plat manquant ou une erreur, et demande un montant.
- **Responsabilité possible.** Restaurant (préparation), parfois livreur (mauvais sac). À qualifier.
- **Preuves dans le système.** Le système sait seulement si une preuve a été **déclarée** (oui ou non). **Il ne conserve ni photo ni message** (non vérifié ailleurs que dans le moteur de litige et sa table). Il garde le montant demandé.
- **Ce que le système décide aujourd'hui.** Le moteur conclut à un **remboursement partiel automatique**, la part supportée par le restaurant, le livreur payé, si **toutes** les conditions sont réunies :
  1. montant demandé supérieur à zéro et au plus égal au repas ;
  2. au plus 50 000 GNF (valeur de simulation) ;
  3. au plus 30 % du repas (valeur de simulation) ;
  4. une preuve déclarée.
  Exemple : repas de 25 000 GNF, plafond 7 500 GNF. Une demande de 5 000 GNF avec preuve entre dans la règle. Sinon : **à un humain**, avec un motif (« preuve absente », « au-dessus du plafond », etc.).
- **Ce qui part vers un humain.** **Tous les cas, y compris ceux qui satisfont la règle** : le code n'applique que deux décisions automatiques (remboursement total avant libération, aucun remboursement avec libération). Le remboursement partiel est calculé mais **jamais exécuté**. Et l'exploitation n'a pas de bouton « remboursement partiel » : ses seuls choix sont total, total à la main, ou libérer. La stratégie annonçait pourtant un partiel automatique ou un humain.
- **Résultat par mode.**
  - Code marchand : à régler entre le client et le restaurant ; aucune règle de plateforme.
  - Chap Chap Pay aujourd'hui : gel, humain ; pas d'exécution possible d'un partiel dans le système.
  - Chap Chap Pay avec remboursement : le code d'appel du prestataire ne prévoit qu'un remboursement total (non vérifié pour un partiel).
- Après libération (cas habituel d'un plat signalé après livraison), **l'argent est déjà chez le restaurant** et rien ne le reprend automatiquement.

### S5. Contestation du client après libération de l'argent

- **Ce qui s'est passé.** La commande est terminée, l'argent a été libéré (ou le client a payé le restaurant directement). Le client conteste plus tard.
- **Responsabilité possible.** À qualifier selon le motif.
- **Preuves dans le système.** Historique des statuts, heures de livraison, code de remise correctement saisi (c'est la principale preuve de remise), journal d'audit de l'exploitation (conservé 12 mois par défaut).
- **Ce que le système décide aujourd'hui.** **Toujours un humain.** Le paiement passe « en litige ».
- **Limite d'exécution.** Une fois l'argent versé, **la plateforme refuse le remboursement** (message : à traiter à la main avec les bénéficiaires, hors de l'écran). Elle refuse aussi d'**enregistrer** un remboursement fait à la main dans ce cas. Il n'existe donc **aucune trace dans le système** d'un remboursement fait après libération. De plus, le seul bouton restant (« Libérer l'argent ») pourrait se comporter de façon inattendue sur un paiement déjà libéré (non vérifié).
- **Résultat par mode.**
  - Code marchand : entre le client et le restaurant, hors plateforme.
  - Chap Chap Pay aujourd'hui : humain, remboursement hors système, sans trace.
  - Chap Chap Pay avec remboursement : un remboursement par le prestataire nécessiterait que Speedfood récupère d'abord l'argent chez les bénéficiaires (ou l'avance).

### S6. Annulation par le client avant l'acceptation

- **Ce qui s'est passé.** Le client annule alors que le restaurant n'a pas encore répondu.
- **Responsabilité possible.** Aucune : rien n'est préparé.
- **Preuves.** Statut, heure, identifiant « client » dans l'historique.
- **Ce que le système décide aujourd'hui.** L'annulation est permise **seulement à ce stade**. Elle est immédiate, sans condition. Comme le paiement ne s'ouvre qu'après l'acceptation, **il n'y a normalement rien à rembourser**. Si un paiement en ligne avait été ouvert mais pas encore réglé, il est annulé.
- **Résultat par mode.** Code marchand : le code n'avait pas été montré, rien n'a été payé. Chap Chap Pay : paiement annulé, aucun argent n'a bougé. Pas de différence entre les modes.

### S7. Annulation après l'acceptation

- **Ce qui s'est passé.** La commande est acceptée (peut-être payée, préparée, la course affectée), puis annulée.
- **Qui peut annuler.** Le **restaurant** : oui, tant que la commande n'est pas « prête ». Le **client** : **non**, l'application lui dit d'appeler l'assistance. L'exploitation peut annuler une livraison.
- **Responsabilité possible.** Restaurant (s'il annule), client (s'il demande l'annulation à l'assistance), livreur (s'il a déjà roulé). À qualifier. La plateforme ne conserve pas le motif d'une annulation de commande (non vérifié ; elle conserve l'auteur et l'heure).
- **Ce que le système décide aujourd'hui.** Identique à S1 : remboursement total si le client a payé en ligne, aucun coût déclaré pour le travail déjà fait (préparation, déplacement du livreur). La livraison en cours est annulée.
- **Résultat par mode.** Voir S1. Une demande d'annulation faite par le client à l'assistance n'a **pas de règle écrite** : l'exploitation décide au cas par cas (Q8).

### S8. Commande refusée par le restaurant

- **Ce qui s'est passé.** Le restaurant refuse la commande en attente.
- **Ce que le système décide aujourd'hui.** Aucun argent n'a été demandé : le paiement ne s'ouvre qu'après acceptation. Si, exceptionnellement, un paiement en ligne avait été créé avant la réponse, il suit la règle de S1 (annulé s'il n'est pas payé, remboursé ou gelé s'il l'est).
- **Résultat par mode.** Sans effet financier dans le cas normal, pour les trois modes.

### S9. Double paiement ou paiement tardif après expiration

- **Ce qui s'est passé.** Le client paie, mais **après** l'expiration du paiement chez Speedfood (15 minutes), alors que le lien de Chap Chap Pay vit 72 heures. Ou : il paie deux fois, ou paie en ligne **et** par code marchand.
- **Ce que le système décide aujourd'hui (paiement en ligne).**
  - Un même événement du prestataire reçu deux fois n'a **qu'un seul effet** (garde en base).
  - Une commande ne peut avoir qu'**un seul paiement en ligne** (contrainte de la base).
  - **Argent arrivé après expiration ou annulation** : si la commande tient toujours (acceptée, prête ou terminée), n'a pas été réglée autrement et n'est pas marquée payée par code marchand, le paiement est **gardé** et la commande devient payée. **Sinon** (commande annulée, client passé à un autre mode, déjà payée à la main), l'argent est rendu ; si le prestataire ne sait pas rembourser, le paiement est **gelé** et confié à l'exploitation.
  - Tant qu'un paiement en ligne est ouvert, la déclaration manuelle par code marchand est refusée côté serveur.
- **Ce qui n'est pas couvert.** Un client qui paie le restaurant par code marchand **sans le déclarer** pendant qu'un paiement en ligne est ouvert : la plateforme ne peut pas le voir.
- **Résultat par mode.** Code marchand : aucun contrôle de double paiement hors la déclaration ; le remboursement d'un trop-perçu relève du restaurant. Chap Chap Pay : décrit ci-dessus, le remboursement d'un trop-perçu passe par l'exploitation, à la main.

### S10. Erreur de montant

- **Ce qui s'est passé.** Le montant payé diffère du montant de la commande, ou le prix a changé (proposition de révision du restaurant).
- **Ce que le système décide aujourd'hui.**
  - Les montants sont **calculés par le serveur** et figés à la création du paiement ; ils ne changent plus ensuite.
  - Un succès de paiement pour **un autre montant** que celui attendu n'est **jamais confirmé automatiquement** : la notification est enregistrée puis ignorée. **L'argent éventuellement arrivé chez le prestataire n'est pas traité automatiquement** par ce qui a été lu (non vérifié qu'une alerte soit émise).
  - Une révision de prix par le restaurant doit être **acceptée par le client** avant d'avoir effet. Le paiement ne s'ouvre qu'après cette étape.
  - Minimum de paiement en ligne : 3 000 GNF. Plafond par paiement : 500 000 GNF par défaut.
- **Résultat par mode.** Code marchand : aucun contrôle de montant par la plateforme (le restaurant confirme ce qu'il a reçu). Chap Chap Pay : montant contrôlé ; un écart est écarté et reste à traiter à la main.

### S11. Réservation de table non honorée

- **Ce qui s'est passé.** Le client a réservé une table et ne vient pas, ou le restaurant ne peut pas l'honorer.
- **Ce que la plateforme prévoit.** **La réservation n'a ni acompte ni paiement** dans la version actuelle. Il n'y a donc **aucun remboursement à décider**. Les états prévus sont : demandée, confirmée, refusée, annulée par le client, annulée par le restaurant, honorée, non honorée. Le restaurant doit **confirmer** (jamais de confirmation automatique). Le fichier de base de données est écrit et testé localement ; **il n'est pas appliqué en production** à la date de ce document.
- **Question ouverte.** Un acompte futur poserait exactement les questions de ce document (Q35).

### S12. Commande à emporter non retirée

- **Ce qui s'est passé.** Le client a commandé à emporter (et éventuellement payé) mais ne vient pas.
- **Ce que le système décide aujourd'hui.** Aucune règle spécifique. Il n'existe pas de code de retrait. C'est le restaurant qui marque la commande terminée ; l'argent est alors libéré (paiement en ligne). Si le restaurant n'agit pas, la commande reste ouverte.
- **Résultat par mode.** Code marchand : le restaurant a l'argent, aucune règle. Chap Chap Pay : l'argent reste gelé en « confirmé » tant que la commande n'est pas terminée ou annulée ; le cas n'est pas réglé par une règle.

### S13. Sur place : client parti sans payer ou qui conteste l'addition

- **Ce qui s'est passé.** Le client mange, puis part ou conteste.
- **Ce que le système décide aujourd'hui.** Aucune règle de remboursement. Le personnel clôture la table en indiquant le mode de règlement. Speedfood n'encaisse rien dans ce flux. Il n'existe pas de fenêtre de contestation (la stratégie la prévoyait « à fixer »).
- **Résultat par mode.** Code marchand : entre le client et le restaurant. Chap Chap Pay : le règlement sur place par Chap Chap Pay n'est pas encore construit (non vérifié dans le détail).

## 5. Matrice de synthèse

Légende : **Auto** : exécuté sans intervention. **Humain** : confié à l'exploitation. **Hors système** : aucune action de la plateforme. **Tranché ?** : règle choisie par l'équipe, à valider ou modifier par le conseil. Les trois colonnes de modes sont : (A) code marchand, c'est-à-dire **sans Chap Chap Pay** ; (B) Chap Chap Pay tel qu'il est aujourd'hui (pas de remboursement chez le prestataire) ; (C) Chap Chap Pay si un remboursement devient disponible.

| Situation | A. Code marchand | B. Chap Chap Pay aujourd'hui | C. Chap Chap Pay avec remboursement | À trancher par le conseil |
|---|---|---|---|---|
| S1 Restaurant refuse ou annule | Hors système : restaurant rembourse | Gel puis remboursement à la main (humain) | Auto : remboursement total | Oui : qui rend l'argent en A, coût du travail déjà fait |
| S2 Livreur ne livre pas, avant récupération | Hors système | Remboursement total tenté, sinon humain | Auto : remboursement total | Oui : responsabilité livreur / restaurant |
| S2 Livreur ne livre pas, après récupération | Hors système | Humain (restaurant payé aux frais de Speedfood : recommandation seulement) | Humain | Oui : qui supporte la perte du repas |
| S3 Client injoignable | Hors système | Libération et versements (règle « aucun remboursement ») | Idem | Oui : délai d'attente, preuves de tentative |
| S4 Plat manquant ou erroné | Hors système | Humain (partiel jamais exécuté) | Humain (partiel non prévu) | Oui : seuils, preuves, qui supporte |
| S5 Contestation après libération | Hors système | Humain ; remboursement impossible dans le système, sans trace | Humain ; récupération chez les bénéficiaires nécessaire | Oui : toute la règle |
| S6 Annulation client avant acceptation | Rien à rembourser | Paiement annulé, rien à rembourser | Idem | Non (cas simple), confirmer |
| S7 Annulation après acceptation | Hors système | Comme S1 | Comme S1 | Oui : annulation par le client via l'assistance |
| S8 Refus par le restaurant | Rien à rembourser | Rien à rembourser (cas normal) | Idem | Non, confirmer |
| S9 Paiement tardif ou double | Aucun contrôle hors déclaration | Gardé si commande valable, sinon gel puis humain | Gardé si valable, sinon remboursement auto | Oui : sort d'un trop-perçu |
| S10 Erreur de montant | Aucun contrôle plateforme | Montant écarté, argent à traiter à la main | Idem, remboursement possible | Oui : délai de restitution |
| S11 Réservation non honorée | Aucun paiement | Aucun paiement | Aucun paiement | Seulement si un acompte est créé |
| S12 À emporter non retiré | Aucune règle | Argent gelé jusqu'à clôture, pas de règle | Idem | Oui : délai et sort de l'argent |
| S13 Sur place : départ ou contestation | Hors système | Non construit | Non construit | Oui, avant ouverture du paiement sur place |

## 6. Moyens techniques de rembourser, avec et sans Chap Chap Pay

### 6.1 Ce que Chap Chap Pay documente, et ce qu'il ne documente pas

**Documenté (référence API lue le 21 octobre 2026) :**

- Encaissement par page hébergée, lecture du statut, notifications signées, frais déduits chez Speedfood.
- Règlements : demandes de retrait du **solde du compte marchand** vers une destination, avec le code PIN d'un agent.
- Envoi d'argent vers un client, un partenaire ou un employé (« PUSH ») : un modèle de données existe, avec un solde suffisant exigé. Il faut une activation chez Chap Chap Pay.
- Le numéro du payeur apparaît dans les informations de transaction lors d'un essai en mode test. Une autre ligne de la même note dit que ce champ est un « libellé ». **Les deux affirmations ne concordent pas ; une seule mesure en test**.

**Non documenté ou non obtenu :**

- **Aucun point d'accès de remboursement** dans la référence lue. Un remboursement automatique ne peut donc pas être garanti.
- Le service « envoyer de l'argent » n'est **pas activé** sur le compte de Speedfood (non vérifié depuis la dernière note).
- Frais de remboursement, délais de mise à disposition du solde, limites par transaction ou par jour : non publiés.
- Conditions de la vérification d'entreprise (KYC, actuellement à 0 %) et d'un éventuel agrément ou cantonnement du solde : non obtenues.
- Dans la référence consultée, les opérations d'encaissement à la demande (PULL) et d'envoi (PUSH) apparaissent sans détail pour ce compte.

### 6.2 Ce que la plateforme sait faire aujourd'hui

| Moyen | Disponible | Détail |
|---|---|---|
| Remboursement automatique par Chap Chap Pay | **Non** | Le prestataire est déclaré « sans remboursement » dans le code. |
| Remboursement automatique par la simulation | Oui (démonstration) | Aucun argent réel. |
| Gel du paiement et litige « à la main » | Oui | Le paiement ne peut plus rien libérer ni verser. |
| Enregistrement d'un remboursement fait à la main | Oui, **avant libération uniquement** | Orange Money ou MTN MoMo avec référence de la transaction obligatoire ; espèces possibles (voir 6.4). Le paiement passe à « remboursé » et les écritures comptables sont passées. |
| Remboursement partiel | **Non** | Ni automatique, ni à la main. |
| Remboursement après libération | **Non** (ni exécuté, ni enregistré) | Message : à traiter hors écran. |
| Piste PUSH vers le payeur | Non activée | Techniquement envisageable si le service est activé et si le numéro du payeur est exploitable (à confirmer). |
| Reprise d'argent chez le restaurant ou le livreur | **Non** | Principe du code : aucun retrait automatique chez un tiers. |

### 6.3 Les risques identifiés

1. **Rembourser de l'argent que Speedfood ne détient pas (code marchand).** L'argent est chez le restaurant. La plateforme n'a aucun moyen de le faire rendre et ne vérifie rien.
2. **Double remboursement.** Le code l'empêche pour le paiement en ligne (un seul remboursement par paiement, un état « remboursé » définitif). Mais un remboursement fait à la main **en dehors** de la plateforme peut s'ajouter à un remboursement automatique si un jour il existe.
3. **Preuve de remise.** Le seul fait fort est le **code de remise** saisi par le livreur. Pour une livraison par le restaurant lui-même, c'est aussi ce code. Pour le retrait et le sur place, il n'y a pas de preuve équivalente.
4. **Fraude côté client.** Déclarer un paiement non fait (code marchand) ; contester une commande reçue ; réclamer un plat manquant sans preuve conservée.
5. **Fraude côté restaurant ou livreur.** Confirmer à tort un paiement ; saisir le code de remise sans avoir livré (le code est à 4 chiffres, limité à 5 essais, mais le livreur peut le demander au client).
6. **Frais non récupérables.** Les frais du prestataire sont supportés par Speedfood. Chap Chap Pay a prélevé 260 GNF sur 3 000 GNF en test. Si un paiement est remboursé, ces frais peuvent ne pas être rendus (non vérifié).
7. **Trésorerie.** Rembourser avant que le solde du compte soit disponible peut être impossible (délai de mise à disposition non publié).
8. **Pas de trace d'un remboursement après libération** (voir S5).

### 6.4 Le dernier recours en espèces

- **Ce qui existe aujourd'hui.** Le propriétaire (super administrateur) peut enregistrer qu'il a remboursé un client **en espèces**, en dernier recours. Il faut le nom de la personne qui a reçu l'argent et un motif d'au moins 15 caractères expliquant pourquoi le mobile money était impossible. Le numéro d'un reçu signé est facultatif. L'assistance ne voit pas ce choix.
- **Avec quoi c'est contradictoire.** Avec la règle produit du 3 novembre (Speedfood ne manipule jamais d'espèces).
- **État prévu.** Le plan du 10 novembre prévoit de **le désactiver par défaut derrière un réglage** (lot R2) ; son maintien ou sa suppression dépend de l'avis. Aucun remboursement en espèces n'a été fait à ce jour (0 au 9 novembre 2026).
- **Question au conseil : Q26 à Q28.**

## 7. Données que le système conserve, et pour combien de temps

### 7.1 Ce que le dossier d'un litige contiendrait aujourd'hui

**Pour la commande (existe) :**

- Référence, restaurant, mode (livraison, à emporter, sur place), lignes de commande figées (nom, prix, quantité), total.
- Historique des statuts avec, pour chaque changement : statut précédent, nouveau statut, **auteur** (restaurant, client par référence, système), **heure**.
- Propositions de révision de prix : versions successives, dates, réponse du client.
- Nom, téléphone et adresse du client (voir 7.3 pour la durée).

**Pour la livraison (existe) :**

- Heures : affectation, récupération, livraison. Statut final et raison libre en cas d'échec ou d'annulation.
- Nombre d'essais de code de remise ; le code lui-même est conservé et lisible seulement par le client.
- Coordonnées de départ, d'arrivée et de destination. Dernière position du livreur et son heure (**pas de trajet complet**).
- Incidents de livraison saisis par l'exploitation : type, gravité, motif, résolution en texte.

**Pour le paiement (existe) :**

- Code marchand : mode, référence déclarée, date de déclaration, date de réception confirmée par le restaurant.
- Paiement en ligne : montants figés, répartition (restaurant, livreur, Speedfood, frais du prestataire), référence interne et référence du prestataire, dates de création, de confirmation et de libération.
- Journal des notifications du prestataire (identifiant, état, montant, résultat), **sans donnée personnelle**.
- Livre de comptes en écriture double, en ajout seul.
- Versements : bénéficiaire, montant, état, numéro masqué, tentatives, code d'erreur.
- Litige : situation, ouvert par (client, restaurant, livreur ou système), montant demandé, preuve déclarée oui/non, décision de la règle, règle appliquée, remboursement décidé, dates, motif de clôture (300 caractères).
- Remboursement fait à la main : moyen, montant, référence, nom du receveur (espèces), motif, auteur.
- Journal d'audit de l'exploitation : action, auteur, motif, heure.

### 7.2 Ce qui sera ajouté par le lot R2 (prévu, pas encore fait)

- La **référence de l'avis juridique** appliqué.
- La **décision humaine consignée** (qui, quand, pourquoi).
- Le **moyen de remboursement choisi**, avec ou sans Chap Chap Pay.
- Les espèces derrière un réglage de la plateforme.
- Un dossier lisible en un écran, transmissible au conseil.

### 7.3 Ce qui manque aujourd'hui

- **Conservation de la preuve** : photo ou message du client (seul un « oui/non » est gardé).
- **Journal d'appels** et de tentatives de contact avec le client injoignable.
- **Motif d'annulation** d'une commande.
- **Remboursement partiel** (décision et trace).
- **Remboursement après libération** (trace).
- **Ouverture d'un litige** par le client, le restaurant ou le livreur (aucun écran, aucune route).
- **Délais automatiques** (« livreur sans code dans le délai », « client sans réponse »).
- **Fenêtre de contestation** après libération ou après repas sur place.
- **Historique de trajet** du livreur.

### 7.4 Durées de conservation (protection des données personnelles)

- **Nom, téléphone et adresse du client** : remplacés par des valeurs neutres (« Client », téléphone vide, adresse effacée) par une tâche quotidienne, **90 jours** après la dernière mise à jour d'une commande terminée, refusée ou annulée (valeur réglable de 7 à 3 650 jours). Une commande restée non terminée est anonymisée après 30 jours. L'opération est **irréversible**. **Conséquence : un litige ouvert après ce délai n'a plus les coordonnées du client.**
- **Journal d'audit** : purgé après 12 mois par défaut (réglable de 1 à 120 mois).
- **Paiements, écritures, versements, litiges** : aucune règle de purge trouvée dans ce qui a été lu (non vérifié). Un paiement d'argent réel confirmé ne peut pas être supprimé, même par cascade d'une commande.
- **Hébergement** : base de données hébergée en Irlande (d'après une note antérieure du projet).
- **Question ouverte** : durées adaptées à un dossier de litige, droits du client sur ses données, consentement, déclaration ou autorisation éventuelle : Q29 à Q31. Une note de travail antérieure du projet a déjà posé des questions sur la protection des données et l'hébergement hors de Guinée.

## 8. Questions numérotées pour le conseil juridique

Chaque question : une phrase, puis « Pourquoi on pose la question ».

### Responsabilité entre restaurant, livreur et plateforme

**Q1. Quand un client paie Speedfood par Chap Chap Pay, Speedfood est-il considéré comme celui qui doit le remboursement, ou le restaurant ?**
Pourquoi on pose la question : l'argent transite par le compte de Speedfood, ce qui peut changer qui répond d'un remboursement. Le code décide aujourd'hui que Speedfood rembourse avant libération.

**Q2. Si le restaurant annule une commande déjà préparée, qui supporte le coût du travail déjà fait (préparation, déplacement du livreur) ?**
Pourquoi on pose la question : la règle actuelle rembourse tout le client et ne facture rien à personne.

**Q3. Le livreur « Speedfood » est-il un prestataire indépendant, un agent de Speedfood ou un salarié ? Le livreur du restaurant engage-t-il le restaurant seul ?**
Pourquoi on pose la question : le code appelle le premier « indépendant » ; de ce statut dépend qui répond d'une livraison manquée.

**Q4. En mode code marchand, comment le livreur Speedfood doit-il être payé de ses frais de livraison, sachant que tout le total est payé au restaurant et que le paiement en espèces est écarté ?**
Pourquoi on pose la question : le code n'établit pas ce flux ; il influe sur qui peut être appelé à rembourser la livraison.

**Q5. Qui répond du contenu d'une commande (plat manquant ou erroné) : le restaurant seul, le livreur, ou un partage ?**
Pourquoi on pose la question : la règle actuelle fait supporter le remboursement partiel par le restaurant, par hypothèse.

**Q6. Si le client ne peut pas être joint à la livraison, quels efforts de contact (nombre d'appels, délai d'attente) justifient que le client perde son paiement ?**
Pourquoi on pose la question : la règle actuelle conclut « aucun remboursement » sans exiger de preuve de tentative.

**Q7. Si le livreur ne livre pas après avoir récupéré la commande, le restaurant doit-il être payé de son repas, et par qui ?**
Pourquoi on pose la question : la règle actuelle dit « par Speedfood » ; ce n'est pas exécutable aujourd'hui sans opération manuelle.

### Qui supporte quel coût

**Q8. Un client peut-il exiger l'annulation d'une commande déjà acceptée, et à quelles conditions ?**
Pourquoi on pose la question : l'application l'interdit au client et le renvoie à l'assistance, sans règle écrite.

**Q9. En cas de remboursement, qui supporte les frais de livraison, la commission de Speedfood et les frais du prestataire de paiement ?**
Pourquoi on pose la question : le code rembourse le total au client, rend le frais fixe de Speedfood, et les frais du prestataire peuvent ne pas être rendus par lui (non vérifié).

**Q10. Speedfood a-t-il le droit de garder son frais fixe quand la commande échoue pour une raison qui ne lui est pas imputable (client injoignable) ?**
Pourquoi on pose la question : la règle actuelle le garde ; ce choix n'a jamais été validé juridiquement.

**Q11. Le restaurant peut-il être tenu de rembourser une part du repas sans son accord préalable écrit ?**
Pourquoi on pose la question : le remboursement partiel du plat manquant est prévu à la charge du restaurant par hypothèse.

### Délais

**Q12. Quel délai le client a-t-il pour contester une commande (après la livraison, après le repas sur place) ?**
Pourquoi on pose la question : aucun délai de contestation n'existe dans le code ; l'argent est libéré dès la commande terminée.

**Q13. Quel délai maximal Speedfood doit-il respecter pour rembourser une fois la décision prise ?**
Pourquoi on pose la question : aucun délai n'est programmé aujourd'hui ; le remboursement à la main dépend de la disponibilité de l'exploitation.

**Q14. Au bout de combien de temps une commande « prête » mais non livrée ou non retirée peut-elle être considérée comme manquée ?**
Pourquoi on pose la question : aucune minuterie n'existe ; l'argent reste gelé.

**Q15. Combien de temps le lien de paiement de Chap Chap Pay (72 h) peut-il rester utilisable alors que Speedfood expire à 15 minutes ?**
Pourquoi on pose la question : un client peut payer après notre expiration ; le code garde ou rembourse selon l'état de la commande.

### Preuves recevables

**Q16. Le code de remise saisi par le livreur suffit-il à prouver la livraison, y compris contre un client qui conteste ?**
Pourquoi on pose la question : c'est la preuve centrale du système, mais le livreur peut obtenir le code du client sans livrer.

**Q17. Une photo ou un message du client est-il recevable pour un plat manquant ? Combien de temps Speedfood doit-il le conserver ?**
Pourquoi on pose la question : le système ne conserve aujourd'hui qu'un « oui/non » sur l'existence d'une preuve.

**Q18. La position GPS d'un livreur et les horodatages peuvent-ils être utilisés comme preuves ? Faut-il recueillir le consentement du livreur ?**
Pourquoi on pose la question : seule la dernière position est conservée ; un historique serait possible mais n'existe pas.

**Q19. Pour un retrait ou un repas sur place, quelle preuve de remise exiger (code de retrait, accord du client) ?**
Pourquoi on pose la question : il n'y a aucune preuve équivalente au code de remise pour ces deux modes.

### Conditions générales à adopter

**Q20. Quelles clauses sur le remboursement, l'annulation, la contestation et la répartition des frais faut-il faire figurer dans les conditions d'utilisation pour le client, le restaurant et le livreur ?**
Pourquoi on pose la question : les conditions actuelles (provisoires) disent que Speedfood n'encaisse aucun paiement ; elles devront changer avec Chap Chap Pay.

**Q21. Un restaurant doit-il signer un mandat d'encaissement avant que Speedfood encaisse pour lui ? Que doit-il dire sur les remboursements ?**
Pourquoi on pose la question : une question voisine est déjà dans la stratégie de paiement ; elle conditionne le remboursement.

**Q22. Les conditions doivent-elles être acceptées de façon formelle (case à cocher, date et version conservées) ?**
Pourquoi on pose la question : aucune acceptation versionnée n'est enregistrée dans ce qui a été lu.

### Rôle d'arbitre de Speedfood et sa limite

**Q23. Speedfood peut-il juridiquement trancher un litige entre le client et le restaurant, et jusqu'où ? Quelle valeur a sa décision ?**
Pourquoi on pose la question : le plan prévoit que le système n'« arbitre » pas le droit, mais enregistre une décision humaine ; il faut en fixer la portée.

**Q24. Comment informer client, restaurant et livreur qu'ils peuvent contester la décision et devant qui ?**
Pourquoi on pose la question : la stratégie prévoit qu'une décision peut toujours être contestée devant un humain, sans voie extérieure définie.

**Q25. Speedfood doit-il proposer un recours (médiation, délai de réponse) avant toute décision ?**
Pourquoi on pose la question : l'équipe ne sait pas quelles obligations de réponse existent pour une plateforme de ce type.

### Remboursement en espèces

**Q26. Le maintien du dernier recours en espèces est-il acceptable, sous conditions, ou doit-il être supprimé ?**
Pourquoi on pose la question : il existe encore aujourd'hui mais s'oppose à la règle produit du 3 novembre.

**Q27. Si les espèces sont maintenues : quelles preuves exiger (reçu signé, témoin, montant maximal) et qui peut les remettre ?**
Pourquoi on pose la question : aujourd'hui, un nom et un motif suffisent, sans plafond ni témoin.

**Q28. Peut-on rembourser un client en espèces un montant payé par mobile money, sans lien traçable avec le paiement d'origine ?**
Pourquoi on pose la question : le moyen de remboursement n'est pas forcément le moyen de paiement d'origine.

### Données personnelles

**Q29. Quelle durée de conservation convient pour les données d'un litige (nom, téléphone, adresse, preuves) ?**
Pourquoi on pose la question : les coordonnées sont effacées à 90 jours par défaut, ce qui peut priver un litige tardif de ses éléments.

**Q30. Le client doit-il être informé spécifiquement que ses données de commande servent à instruire un litige ? Quels sont ses droits (accès, rectification, effacement) ?**
Pourquoi on pose la question : aucune information spécifique au litige n'est donnée aujourd'hui.

**Q31. L'hébergement des données en Irlande et la transmission au prestataire de paiement demandent-ils une déclaration ou une autorisation ?**
Pourquoi on pose la question : une note antérieure du projet l'a signalé comme question ouverte, sans réponse.

### Différence avec et sans Chap Chap Pay

**Q32. Speedfood peut-il continuer à fonctionner en code marchand (sans Chap Chap Pay) sans responsabilité de remboursement, et que doit-il dire clairement au client ?**
Pourquoi on pose la question : dans ce mode l'argent va au restaurant, mais la plateforme met en relation et propose le parcours.

**Q33. Avec Chap Chap Pay, Speedfood peut-il rembourser un client avant d'avoir reçu l'argent des bénéficiaires, et répercuter la perte ?**
Pourquoi on pose la question : c'est le cas S5 ; le système n'a aucun moyen de reprendre l'argent chez un tiers.

**Q34. Que doit être mentionné sur le reçu et dans les conditions pour un paiement partagé entre plusieurs bénéficiaires (restaurant, livreur, Speedfood) ?**
Pourquoi on pose la question : le client paie un total unique réparti entre plusieurs personnes.

### Réservations non honorées et acompte futur

**Q35. Une plateforme peut-elle demander un acompte pour réserver une table ? Si oui, à qui revient-il (restaurant ou Speedfood), et sous quelles conditions est-il rendu en cas de non-présentation, d'annulation tardive ou de refus du restaurant ?**
Pourquoi on pose la question : la réservation n'a aujourd'hui aucun paiement ; un acompte rouvrirait toutes les questions ci-dessus et aucune règle n'existe.

## 9. Ce que Speedfood fera dès réception de l'avis

Sans promettre de date, la mise en œuvre prévue (lot R2) est la suivante.

1. **Saisir la décision humaine avec la référence de l'avis juridique** dans le dossier du litige (qui décide, quand, pourquoi).
2. **Choisir le moyen de remboursement** selon le cas : Chap Chap Pay si un remboursement existe un jour, sinon mobile money avec référence, sinon (si le conseil l'autorise) espèces derrière un réglage.
3. **Remplacer les règles « à titre indicatif »** par celles que le conseil aura retenues (seuils, délais, partage des coûts). Tant qu'aucun avis n'est rendu, les règles actuelles ne sont ni durcies ni assouplies.
4. **Combler les manques identifiés** à la section 7.3 que l'avis rendra nécessaires : remboursement partiel, trace d'un remboursement après libération, ouverture d'un litige par les parties, conservation des preuves, délais automatiques.
5. **Produire le dossier d'un litige** en un écran lisible, transmissible tel quel.
6. **Mettre à jour les conditions d'utilisation** selon les clauses retenues (Q20 à Q22).
7. **Ne rien allumer en production** (paiement en ligne, Chap Chap Pay, base de données) sans accord distinct de Malika. Aucune migration n'est appliquée en production sans ce feu vert.

## 10. Annexe : références techniques

Pour qui reprendra le chantier. Les chemins sont donnés depuis la racine du dépôt.

**Documents**

- `docs/CHAPCHAP-NOTES-API.md` : référence API lue, essais en mode test, frais mesurés, points manquants.
- `docs/STRATEGIE-PAIEMENT.md` : vision, décisions de Malika (20-21 octobre), règles de litige initiales (section 7).
- `docs/PAIEMENT-ARCHITECTURE.md` : machine à états, livre de comptes, lots P1 à P6, traitement manuel.
- `docs/PAIEMENT-CODE-MARCHAND.md` : paiement par code marchand et reçu.
- `docs/plans/2026-11-10-modes-de-commande-et-remboursements.md` : lots M1 à M4, R1, R2 et décisions par défaut.
- `docs/plans/2026-11-09-inventaire-restes-especes.md` : décisions D1 à D3, B1 à B6.
- `docs/CADRE-JURIDIQUE-LIVREURS.md` : questions juridiques antérieures (livreurs, argent, données).
- `docs/LIVRAISON.md`, `docs/LIVRAISON-LIVREURS-V2.md`, `docs/COMMANDE-SUR-PLACE.md` : livraison, livreurs, commande sur place.

**Base de données (migrations)**

- `supabase/migrations/20261021090000_paiement_en_ligne.sql` : tables `paiements`, `paiement_versements`, `paiement_ecritures`, `paiement_evenements`, `litiges_paiement`, `comptes_versement`, `parametres_paiement`.
- `supabase/migrations/20261025225248_remboursements_manuels.sql` : table `remboursements_manuels`.
- `supabase/migrations/20261005171122_paiement_code_marchand.sql` : colonnes de paiement par code marchand sur la commande.
- `supabase/migrations/20261003121152_conservation_donnees.sql` : anonymisation et purge d'audit.
- `supabase/migrations/20261024193000_incidents_livraison.sql` : incidents de livraison.
- `supabase/migrations/20261110090000_reservations_table.sql` : réservation de table (fichier, non appliqué en production).
- `supabase/migrations/20260927150000_tables.sql` : commandes, historique des statuts, propositions.

**Code**

- `apps/web/src/lib/paiement/en-ligne/litiges.ts` : règles de décision des cinq situations.
- `apps/web/src/lib/paiement/en-ligne/service.ts` : application des décisions, expiration, paiement tardif, remboursement, litiges.
- `apps/web/src/lib/paiement/en-ligne/repartition.ts` : répartition des montants.
- `apps/web/src/lib/paiement/en-ligne/chapchap.ts` : adaptateur Chap Chap Pay (remboursement déclaré indisponible).
- `apps/web/src/lib/paiement/en-ligne/remboursement-manuel.ts` : règles du remboursement à la main.
- `apps/web/src/lib/system-admin/paiements.ts` et `apps/web/src/app/system/paiements/ActionsPaiement.tsx` : décisions de l'exploitation.
- `apps/web/src/lib/livraison/apres-commande.ts` : liens entre changement d'état d'une commande et paiement.
- `apps/web/src/lib/livraison/service.ts`, `statuts.ts`, `code.ts` : livraison, étapes, code de remise.
- `apps/web/src/lib/commande/annulation-client.ts` : annulation par le client.
- `packages/shared/src/contracts/statuts.ts` : statuts de commande.
- `packages/shared/src/paiement/regles.ts` : modes de paiement proposés (sans espèces).

**États utiles**

- Paiement : `cree`, `en_attente`, `confirme`, `libere`, `echoue`, `expire`, `annule`, `rembourse`, `en_litige`.
- Litige : situations `restaurant_refuse_ou_annule`, `livreur_ne_livre_pas`, `client_injoignable`, `plat_manquant_ou_errone`, `contestation_apres_liberation`. États `ouvert`, `decide_auto`, `a_humain`, `clos`. Décisions `rembourser_total`, `rembourser_partiel`, `aucun_remboursement`, `humain`.
- Commande : `en_attente`, `acceptee`, `refusee`, `prete`, `terminee`, `annulee`.
- Livraison : `a_assigner`, `offre_envoyee`, `assignee`, `vers_restaurant`, `recuperee`, `vers_client`, `livree`, `echec`, `annulee`.

**Réglages de simulation à connaître** (réglables sans déploiement, non validés par Malika tant que `valeurs_validees_le` est vide) : délai d'expiration 15 minutes ; plafond de paiement 500 000 GNF ; plafond du remboursement partiel automatique 30 % du repas ; seuil de décision humaine 50 000 GNF ; frais fixe Speedfood 1 000 GNF par défaut en base (1 500 GNF décidé par Malika pour le paiement en ligne : valeur effective en production non vérifiée) ; frais du prestataire mesurés 200 GNF + 2 %.

**Points non vérifiés par cette analyse**

- Valeurs réelles des réglages de paiement en production et état de l'interrupteur.
- Existence d'un remboursement chez Chap Chap Pay (aucune demande formelle à Chap Chap Pay n'est consignée).
- Comportement du bouton « Libérer l'argent » sur un paiement déjà libéré.
- Absence d'alerte quand un paiement arrive pour un montant différent.
- Absence de purge des tables de paiement et de litige.
- Parcours exact du règlement sur place avec Chap Chap Pay.
