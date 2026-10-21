# Speedfood, revendeur : vision et cadrage (21 octobre 2026)

**Statut : proposition de Malika, cadrée par l'ingénieur, à valider.** Elle remplace le modèle « place de marché » (ADR-001 à ADR-011 : le restaurant crée sa page et vend lui-même, Speedfood n'encaisse rien) par un modèle **revendeur** : Speedfood inscrit les restaurants, fait découvrir leurs plats, **vend** au consommateur et livre. Rien dans le code n'est encore changé ; ce document dit ce que ce choix implique, avant d'y toucher.

> **Mise à jour du 21/10 (étude en sources ouvertes) :** Madifood, la référence citée, se présente comme **intermédiaire** et non comme revendeur ; voir `REFONTE-SPEEDFOOD.md` §1 (posture A « revendeur » contre posture B « intermédiaire qui encaisse et livre », recommandation B). Le reste de ce document reste valable pour les flux, l'argent et la migration.

## 1. Le modèle en une phrase
Le consommateur achète **à Speedfood**, qui achète **au restaurant** et livre. Speedfood est le vendeur du point de vue du client (service, prix, remboursement, réclamation) ; le restaurant est le fournisseur.

## 2. Ce qui change, acteur par acteur
| | Avant (place de marché) | Après (revendeur) |
|---|---|---|
| **Consommateur** | Commande au restaurant, paie le restaurant | Commande à Speedfood, paie Speedfood (espèces à la livraison, ou Mobile Money), un seul interlocuteur |
| **Restaurant** | Crée sa page, gère menu, prix, horaires, livraison | **N'a plus de page à gérer.** Speedfood l'inscrit et tient son catalogue. Il reçoit les commandes (appel, WhatsApp, SMS ou petite tablette), prépare, remet au livreur |
| **Speedfood (équipe)** | Valide les pages, répond au support | **Cœur du métier** : inscrit les restaurants, tient les catalogues et les prix, confirme chaque commande au restaurant, répartit les livreurs, encaisse, règle les restaurants |
| **Livreur** | Livre pour un restaurant ou pour Speedfood | Livre pour Speedfood (flotte Speedfood, mode déjà prévu : « livraison Speedfood ») |

## 3. Le flux de bout en bout
1. Le client choisit des plats dans l'application et passe commande ; **les prix sont recalculés côté serveur** (jamais fiés au client).
2. Le tableau de répartition de Speedfood reçoit la commande et **la confirme au restaurant** (disponibilité, délai de préparation). Si un plat manque, Speedfood propose une alternative au client avant de continuer.
3. Le restaurant prépare ; il signale « prête » (appel, WhatsApp ou tablette).
4. Un livreur Speedfood récupère la commande **et règle le restaurant** (option A) ou Speedfood règle en différé (option B, voir §5).
5. Le livreur livre ; le client paie (espèces ou Mobile Money) ; la commande est clôturée.
6. Speedfood règle les restaurants selon le rythme convenu et tient le **registre comptable** (déjà conçu : double écriture, répartition entière en GNF).

## 4. Ce qui existe déjà et sert directement
- **Paiement en ligne** (P1 à P5) : répartition, registre comptable, remboursement et versement manuels, intégration Chap Chap (éteinte en production). Il passe de « option » à « colonne vertébrale ».
- **Livraison Speedfood et registre de livreurs** : dispatch, statuts, code de remise, garde-fou (`garde-fou-speedfood`).
- **Administration** : comptes, paliers, journal d'audit, studio de contenu, géographie, aide au choix.
- **Espace client** : commandes, favoris, adresses, « commander à nouveau », avis, notifications.
- **Application native** (ADR-019) : devient l'application **client** principale ; l'application **livreur** passe devant l'application restaurateur.

## 5. Les décisions d'argent
**Tranchées dans `DECISIONS-MODELE.md`, alignées sur la posture intermédiaire** : prix du restaurant en parité plus frais de livraison et de service affichés, commission retenue et publiée en paliers (départ décidé par Malika : 5 %), règlement quotidien des restaurants sans avance, livreurs indépendants Speedfood payés à la livraison avec virement journalier. Les options « majoration cachée » et « prix Speedfood libre » proposées au premier cadrage sont écartées. Le réglage par restaurant s'appelle désormais `mode_vente` = `autonome` ou `speedfood`.

## 6. Le cadre juridique devient obligatoire (aucun avis donné ici)
En vendant, Speedfood devient **le vendeur** : cela rend les questions juridiques ouvertes (dossier de questions 10 à 15) **bloquantes avant tout lancement**. À faire valider par un juriste et un expert-comptable de Guinée :
- l'existence et l'objet de la société, l'immatriculation, la licence commerciale, la fiscalité (TVA, facturation, reçus) ;
- la responsabilité sur les produits alimentaires vendus et sur l'hygiène ;
- les **conditions générales de vente** au consommateur (prix, remboursement, annulation, réclamation) : différentes des conditions d'utilisation actuelles ;
- le **contrat avec chaque restaurant** (liste de prix, délais, qualité, règlement, fin de collaboration) ;
- l'encaissement : compte marchand Mobile Money, vérification d'identité de l'entreprise (KYC) exigée par Chap Chap, rapprochement ;
- le statut des livreurs (salariés, indépendants) et leur assurance.

**Conséquence immédiate sur le site actuel :** `/conditions`, `/a-propos`, `/restaurateurs` et `/installer` affirment que « Speedfood n'encaisse rien » et « ne livre pas ». Ces phrases deviendront **fausses** dès que le modèle revendeur démarre. Elles ne changent qu'au moment du lancement, pas avant, mais elles doivent être réécrites avec le texte juridique validé.

## 7. Comment passer de l'un à l'autre sans casser le pilote
Pas de bascule brutale : **un réglage par restaurant**, `mode_vente` = « place de marché » (comme aujourd'hui) ou « revente » (nouveau). Les restaurants actuels du pilote continuent normalement ; chaque nouveau restaurant inscrit par Speedfood passe en « revente ». Quand tous sont en revente et que le droit est validé, le mode « place de marché » est retiré. Avantages : retour en arrière possible, pilote isolé, aucune fausse promesse faite aux clients actuels.

## 8. Ce que cela change dans le produit
- **Inscription restaurateur** : `/inscription` (création de compte libre) est remplacée par une **demande de référencement** (formulaire qui arrive dans l'administration, comme les demandes de partenariat) ; l'équipe appelle, visite, signe le contrat et saisit le catalogue.
- **Administration** : devient le poste de travail principal : **catalogue par restaurant** (plats, prix d'achat, prix de vente, photos, disponibilité), **file des commandes à confirmer**, répartition des livreurs, règlement des restaurants, rapprochement des espèces.
- **Console restaurateur** : réduite à l'essentiel optionnel (voir les commandes, confirmer « prête », marquer un plat épuisé). Le code existant reste ; il n'est plus la porte d'entrée.
- **Application cliente** : un seul acheteur, un seul panier, plusieurs restaurants possibles à terme (un panier = un restaurant au départ).
- **Garde-fous** inchangés : prix recalculés côté serveur, montants GNF entiers, aucun secret dans le code, chaque action tracée.

## 9. Risques à regarder en face
- **Argent liquide** : écarts entre ce que le livreur encaisse et ce qu'il remet. Il faut un rapprochement quotidien et des plafonds.
- **Disponibilité** : si Speedfood vend un plat que le restaurant n'a plus, c'est Speedfood qui doit réparer. D'où la confirmation systématique au restaurant avant de valider (§3, étape 2).
- **Trésorerie** : l'avance faite aux restaurants (option A) immobilise de l'argent.
- **Qualité et réclamations** : Speedfood les porte désormais. Il faut un circuit de remboursement (déjà conçu, manuel).
- **Dépendance** : un restaurant peut ne plus vouloir vendre via Speedfood ; le catalogue et la marque Speedfood doivent rester propres à Speedfood.
- **Concurrence** : GUIFood, Dineroo, Flashbol et Magic existent déjà en Guinée ; la différence de Speedfood est à formuler (confiance, disponibilité à l'heure, quartiers).

## 10. Feuille de route proposée
| Étape | Contenu | Dépend de |
|---|---|---|
| R0 | Décisions §5 et dossier juridique §6 lancés | Malika, juriste |
| R1 | `mode_vente` par restaurant ; catalogue géré par l'équipe (administration) ; « demande de référencement » à la place de l'inscription | R0 (décisions de prix) |
| R2 | Commande « revente » : confirmation par l'équipe auprès du restaurant, répartition des livreurs, encaissement espèces | R1 |
| R3 | Règlement des restaurants et rapprochement des espèces | R2 |
| R4 | Paiement Mobile Money (activation Chap Chap) | KYC, accord écrit, avis juridique |
| R5 | Réécriture des textes publics (conditions générales de vente, À propos, restaurateurs) | avis juridique |
| Natif | N1, N2, puis application livreur avant console restaurateur (NATIF-PLAN) | R2 |

Premier restaurant-test : un seul, de confiance, avec un contrat écrit simple, avant d'en inscrire d'autres.
