# Termes de référence — Speedfood, version 0.2 (proposition)

**Version :** 0.2 — proposition à valider, remplace la v0.1 du 27 septembre 2026 une fois validée
**Date :** 13 octobre 2026
**Produit :** application complète de découverte, commande, livraison et fidélisation pour la restauration à Conakry, puis en Guinée
**Statut :** brouillon. Aucune ligne de ce document n'engage de dépense, de contrat ni de mise en production. Les points marqués **[DÉCISION]** attendent une validation de Malika.

> Ce document remplace la v0.1 sur le périmètre. Il ne réécrit pas les décisions déjà prises sur la sécurité, la conservation des données et la gouvernance agent ; elles restent valables sauf mention contraire.

---

## 1. Résumé exécutif

Speedfood devient une application complète qui couvre tout ce qu'une plateforme de restauration doit gérer : découverte géographique, menus et disponibilités, commande, paiement mobile money, livraison (restaurant, client ou prestataire), suivi en temps réel, avis, promotions, fidélité et mise en avant.

Speedfood se positionne comme **passage obligé** : toute commande, tout paiement et toute livraison passent par la plateforme. Speedfood ne livre pas lui-même au départ ; il orchestre des livreurs (restaurants, clients, indépendants ou entreprises de livraison inscrits sur la plateforme).

Trois principes guident le produit :
1. **Vérité de l'information.** Disponibilité, délai, prix et statut sont horodatés et affichés honnêtement (« à confirmer » plutôt qu'une promesse non vérifiée).
2. **Sans installation obligatoire.** Le portail web reste complet ; l'application installable est un accès supplémentaire.
3. **Engagement responsable.** Gamification et fidélité sont conçues pour récompenser l'usage utile, sans mécaniques de pression ni de jeu d'argent (voir §9).

Le pilote reste limité à une zone de Conakry. Les modules sont **phasés** (§12) : chaque module indique sa phase, ses dépendances externes et sa condition de lancement.

---

## 2. Contexte et problème

Les clients cherchent un repas, comparent les offres et veulent payer et suivre leur commande sans appeler plusieurs établissements. Les restaurants veulent vendre au-delà de leur clientèle de passage, recevoir des commandes lisibles et livrer sans gérer seuls un service de coursiers. Les livreurs indépendants et les petites entreprises de livraison cherchent des courses régulières.

Les applications concurrentes (dont Madifood, analysé le 4 octobre 2026) imposent une application lourde, n'affichent pas de preuves vérifiables et ne publient pas leurs conditions. Speedfood cible les mêmes fonctions avec une exigence de transparence et une présence web légère.

---

## 3. Objectifs

### Objectifs produit
1. Permettre à un client de trouver un restaurant **près de lui**, dans sa commune et son quartier, et de commander en quelques gestes.
2. Permettre le **paiement mobile money** avec confirmation fiable et réconciliation.
3. Permettre à chaque restaurant de **livrer lui-même**, de **déléguer** à un livreur indépendant ou une entreprise inscrite, ou de laisser le **client** choisir son livreur.
4. Offrir aux livreurs et aux entreprises de livraison un **espace de compte** pour recevoir des courses et être payés.
5. Donner au client une **géolocalisation** et un **guidage** comparables à ceux de Google Maps (itinéraire, point de rendez-vous, position du livreur).
6. Publier des **avis** vérifiés, des **promotions** et un **programme de fidélité** (§9).
7. Offrir une **mise en avant payante** clairement signalée (§10).
8. Garder une administration complète : validation, modération, litiges, remboursements, comptabilité et audit.

### Résultats attendus pour le pilote
- Un client commande, paie et suit sa livraison de bout en bout, sans créer de compte pour une commande simple (compte exigé pour le paiement mobile money, §5).
- Un restaurant reçoit, accepte, prépare et remet la commande, quel que soit le mode de livraison.
- Un livreur accepte une course, la réalise et est payé ou crédité selon les règles.
- L'équipe voit les paiements, litiges, remboursements, délais et annulations.
- Aucune donnée d'un restaurant, d'un livreur ou d'un client n'est visible d'un autre acteur hors de son périmètre.

---

## 4. Acteurs et rôles

| Acteur | Besoin | Accès |
|---|---|---|
| Visiteur | Découvrir, comparer | Catalogue public, recherche, carte, fiches |
| Client | Commander, payer, suivre, noter, fidéliser | Compte client (requis pour le paiement mobile money et la fidélité), historique, adresses |
| Propriétaire restaurant | Gérer l'établissement et ses commandes | Console de son seul restaurant |
| Équipier restaurant | Aider aux commandes et au menu | Permissions limitées par établissement |
| Livreur indépendant | Recevoir et réaliser des courses | Espace livreur : disponibilité, courses, gains, documents |
| Entreprise de livraison | Gérer une flotte de livreurs | Espace entreprise : livreurs rattachés, affectation, facturation |
| Support | Aider clients, restaurants, livreurs | Accès minimisé, journalisé, réservé aux dossiers ouverts |
| Modérateur | Traiter avis, signalements, fraudes | File de modération, journal |
| Opérations / finance | Suivre paiements, remboursements, reversements | Vues financières, exports, rapprochement |
| Administrateur système | Piloter la plateforme | Tout, selon rôles explicites |

Les rôles CMS restent `super_admin`, `operations`, `content_editor` et `support`, auxquels s'ajoutent `moderation` et `finance`. Aucun rôle n'est attribuable depuis une inscription publique.

---

## 5. Compte, identité et paiement

### 5.1 Identification de tout acteur
**Principe retenu par Malika le 13 octobre 2026 : toute personne qui pose une action (commander, payer, noter, livrer, gérer un restaurant, signaler) doit être identifiée.** Cette règle vise à prévenir les abus et à pouvoir agir en cas de dérapage.

- **Aucune action en écriture sans compte identifié.** La commande invitée (sans compte) est supprimée. Le visiteur peut consulter le catalogue, les fiches et la carte sans se connecter ; toute demande d'action le conduit à s'identifier.
- **Méthodes de connexion (choix de Malika le 13 octobre 2026)** : compte **Facebook**, compte **Google**, ou **numéro de téléphone** vérifié par code (OTP).
  - Facebook : déjà présent dans l'application (connexion OAuth, `src/lib/client/actions.ts`). À vérifier : l'application Meta doit être configurée et approuvée.
  - Google : à construire. Demande un client OAuth Google (projet Google Cloud, à créer par Malika ou autorisé par écrit).
  - Téléphone : à construire. Demande un fournisseur d'envoi de SMS en Guinée (§13).
  - **Règle commune** : quel que soit le moyen de connexion, le compte doit être lié à un **numéro de téléphone vérifié par OTP** avant toute action en écriture. Facebook et Google ne fournissent pas un numéro vérifié pour Speedfood ; sans cette étape, la traçabilité du §5.1 ne tiendrait pas. Un numéro ne peut être lié qu'à un seul compte actif.
  - Une identité déclarée (nom et prénom) est demandée à la première action en écriture.
- **Identité déclarée et vérifiée** pour les livreurs, les entreprises de livraison et les restaurants : pièce d'identité, justificatif d'activité, contrôle manuel avant activation.
- **Client** : identité minimale (nom, téléphone) demandée à la création du compte. Les actions à risque (paiement mobile money, avis, plus de N commandes non réglées) peuvent exiger une vérification supplémentaire.
- **Traçabilité** : chaque action en écriture est rattachée à un compte identifié et journalisée (qui, quoi, quand). Les journaux suivent la conservation fixée au §14.
- **Sanctions** : un compte fautif peut être suspendu, avec motif et recours, sans effacer les traces nécessaires au litige.
- **Conséquence technique** : la vérification par SMS (OTP) en Guinée est **prévue**, mais **pas encore lancée**. Malika a choisi de rester sur Facebook et Google en attendant (décision du 13 octobre 2026).
- **Écart provisoire, décidé le 13 octobre 2026 (option retenue : numéro déclaré accepté sans vérification)** : tant que le SMS n'est pas en place, le numéro est déclaré par l'utilisateur et enregistré tel quel. Chaque compte porte un indicateur « numéro non vérifié ». La traçabilité du §5.1 reste assurée par le compte Facebook ou Google. Dès que la vérification SMS est en service, les comptes non vérifiés devront confirmer leur numéro avant toute nouvelle écriture.
- **Options de fournisseur SMS étudiées** (sans compte ouvert) : Orange SMS Guinée (tarif local le plus bas, intégration sur mesure, conditions anciennes), Twilio Verify et Vonage Verify (intégrés à Supabase Auth, couverture Guinée à confirmer par écrit). Le choix et l'essai sont à lancer sur décision de Malika.

### 5.2 Paiement mobile money : **Chap Chap Pay retenu comme agrégateur**
- **Statut : en cours de concrétisation.** Le prestataire est choisi ; les démarches (tarifs, agrément, dossier, test) sont à engager et leur avancement sera consigné dans `docs/STATUT-PROJET.md`. Rien n'est encore signé ni ouvert.
- **Prestataire choisi par Malika : Chap Chap Pay** (chapchappay.com, SARL guinéenne). Il agrège Orange Money, MTN MoMo, PayCard, Kulu, Soutra Money, Akiba, Visa et Mastercard via une seule API REST.
- Ce qui couvre notre besoin, selon leur guide d'intégration : liens de paiement (E-Commerce), paiement QR, **PULL API** (encaisser une commande), **PUSH API** (envoyer des fonds vers des wallets, utile pour les reversements), webhooks signés HMAC avec rejeu manuel, clés distinctes test et production.
- **Speedfood ne détient pas les opérateurs mobile money** : Chap Chap Pay est l'intermédiaire, et Speedfood reste utilisateur de son API. Le statut juridique reste néanmoins à confirmer (voir prérequis).
- **Prérequis avant toute transaction réelle** (aucun n'est encore levé) :
  1. **Vérifier l'agrément** : le site affiche « agréé par la Banque Centrale de la République de Guinée ». C'est une affirmation de l'entreprise, à confirmer auprès de la BCRG avant signature.
  2. **Tarifs** : aucun barème public (« sans frais cachés » sans chiffre). **Demande écrite envoyée le 13 octobre 2026** à sales@chapchappay.com (grille, délai de règlement, modèle plateforme, KYC, environnement test, niveaux de service). **Réponse en attente.**
  3. **Modèle marketplace** : vérifier par écrit qu'ils gèrent un compte Speedfood qui paie plusieurs bénéficiaires (restaurants, livreurs) et une commission, ce que leur guide ne détaille pas.
  4. **Dossier KYC** de Speedfood : registre de commerce, pièce d'identité du dirigeant, coordonnées bancaires. Délai annoncé : 24 à 48 h ouvrées après soumission. **Non soumis tant que Malika ne l'a pas autorisé par écrit.**
  5. **Test en environnement sandbox** avec la clé Test : parcours complet encaissement, webhook, reversement, remboursement.
  6. **Juridique** : contrat signé et conseil guinéen sur les obligations de Speedfood en tant que plateforme de paiement intermédiée.
  7. Accord écrit de Malika sur les coûts (règle : aucun nouveau service, compte ou coût sans consigne explicite).
- Tant que ces prérequis ne sont pas levés, le module reste en **mode test** (clé Test). Aucun paiement réel n'est accepté. Les modes espèces et code marchand restent disponibles.
- **Restriction (décision du 13 octobre 2026)** : le paiement en ligne n'est ouvert qu'aux comptes dont le numéro est **vérifié** par OTP. Tant que la vérification SMS n'est pas en service, ce paiement reste fermé.
- **Mode démonstration (décision du 13 octobre 2026)** : pour présenter le parcours de paiement à un tiers, un environnement de démonstration distinct, qui n'utilise que des clés de test, des données fictives (pas de vrai client, restaurant ni livreur) et un bandeau permanent « DÉMONSTRATION : aucun paiement réel ». Il n'est jamais déployé sur la production ni relié à une clé de production. Une démonstration ne doit jamais pouvoir être prise pour un vrai paiement.
- Règles : montant en GNF entier ; le serveur recalcule le total ; un paiement n'est confirmé qu'après notification vérifiée de l'opérateur ; remboursements et annulations tracés ; aucune donnée de carte ou de compte mobile money stockée par Speedfood.

### 5.3 Reversements
- Chaque commande payée génère une écriture de répartition : part restaurant, part livreur, commission Speedfood, frais de paiement.
- Reversements planifiés (hebdomadaires au départ) et journal consultable par chaque bénéficiaire.
- **Commission** : taux non fixé ; **[DÉCISION]** à prendre après le pilote, aucun taux n'est publié avant.

---

## 6. Géographie : ville, commune, quartier

- Hiérarchie géographique unique : **ville → commune → quartier**, avec des zones de livraison rattachées au quartier.
- Chaque restaurant, chaque client (adresse) et chaque livreur est rattaché à cette hiérarchie.
- La liste des quartiers est gérée par le CMS (ajout, renommage, fusion), avec historique.
- Le catalogue se filtre et se classe par commune et quartier ; le classement tient compte de la distance (§7).

## 7. Géolocalisation et guidage

Objectif : une expérience proche de Google Maps pour trouver, rejoindre et suivre.
- Carte interactive : restaurants autour du client, filtre par distance et temps de trajet.
- Localisation du client avec son accord explicite ; position enregistrée seulement pendant une commande active.
- Itinéraire vers le restaurant ou l'adresse de livraison ; ouverture dans l'application de cartographie du téléphone.
- Position du livreur en temps réel pendant une course (fréquence limitée pour économiser la batterie et les données).
- **Choix de Malika : forfait gratuit Google Maps Essentials, complété par OpenStreetMap.**
  - Google Maps Platform, offre **Essentials** : Google indique un quota gratuit de **10 000 événements facturables par mois pour chaque SKU** (et non plus un crédit de 200 $ commun, depuis le 1ᵉʳ mars 2025). Le compteur se remet à zéro chaque mois. Source : [FAQ de facturation Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/faq).
  - **OpenStreetMap** pour le fond de carte, avec attribution « © contributeurs OpenStreetMap » obligatoire et licence ODbL.
  - **Règle de répartition** (à valider) : Google pour la recherche d'adresse, le géocodage et l'itinéraire ; OpenStreetMap pour l'affichage de la carte. Cela limite les appels facturables.
  - **Pour rester dans le gratuit** : quota par SKU lu sur la grille tarifaire officielle (les SKU utilisés doivent être identifiés un par un), **plafond d'usage** fixé dans la console Google, **alerte budgétaire** à 1 $, et cache côté serveur des résultats de géocodage.
  - **Limites à connaître** : le serveur public de tuiles OpenStreetMap interdit un usage intensif ; pour une fréquentation réelle, il faudra un fournisseur de tuiles ou un hébergement propre (coût à chiffrer). Le routage OpenStreetMap public n'est pas prévu pour la production.
  - **Prérequis** : créer le compte de facturation Google Cloud (carte bancaire) est une action que Malika doit faire elle-même ou autoriser par écrit.
- Les positions GPS ne sont pas partagées avec d'autres clients ni utilisées pour le marketing.

## 8. Commande et livraison

### 8.1 Modes de livraison
Chaque commande choisit un mode, selon ce que le restaurant accepte :
1. **Livraison par le restaurant** : le restaurant utilise ses propres livreurs.
2. **Livraison choisie par le client** : le client choisit un livreur indépendant ou une entreprise inscrite, parmi ceux qui couvrent sa zone.
3. **Livraison par un prestataire** : le restaurant délègue à un livreur ou une entreprise inscrite via Speedfood.
4. **Retrait** : le client vient chercher sa commande.

Speedfood est le passage obligé : les modes 1 à 3 passent par la plateforme (statut, suivi, paiement, avis), même lorsque la course est réalisée hors de la plateforme.

### 8.2 Cycle de la commande
États stockés : `en_attente` → `acceptee` ou `refusee` ; `acceptee` → `en_preparation` → `prete` → `en_livraison` (si livraison) → `livree` ou `retiree` → `terminee`. Annulations et litiges sont des états distincts, tracés avec motif.
- Une proposition de révision (prix ou conditions) reste `en_attente` avec l'état dérivé `attente_confirmation_client`, comme dans la v0.1 (acceptation ou refus explicite, échéance).
- Un paiement mobile money n'est déclenché qu'après acceptation par le restaurant.

### 8.3 Répartition des courses (livreurs)
- Un livreur ne voit que les courses de sa zone et de ses disponibilités.
- Affectation : premier accepté, ou attribution par le restaurant ou l'entreprise, selon le mode choisi.
- Règles d'équité (ne pas accaparer toutes les courses) et délais affichés honnêtement.
- Un livreur peut être suspendu temporairement après plusieurs refus ou incidents, avec motif et recours.

### 8.4 Preuve de livraison
- Confirmation par code à 4 chiffres remis au client, ou photo, selon le mode.
- Litige possible pendant une fenêtre définie ; décision tracée par le support ou la modération.

---

## 9. Avis, promotions, fidélité et gamification

### 9.1 Avis et notes
- Seuls les clients ayant payé ou reçu une commande peuvent noter (restaurant, livraison, plats).
- Modération a posteriori ; signalement ; réponse du restaurant ; pas de suppression sans motif journalisé.
- Protection contre les avis en masse (limitation de débit, détection de comptes liés).

### 9.2 Promotions et coupons
- Codes promo par restaurant ou par la plateforme ; plafonds, dates, périmètre (quartier, premier achat).
- Le serveur calcule la remise ; un code ne se cumule que selon une règle explicite.
- Financement de la remise défini par commande (restaurant, plateforme ou mixte), avec écriture comptable.

### 9.3 Fidélité et gamification : recette des applications à succès
Choix de Malika : reprendre la recette des applications de consommation à forte rétention. Mécaniques retenues :
- **Série d'utilisation (streak)** : compteur de commandes ou de jours consécutifs, pour créer l'habitude.
- **Paliers de fidélité (tiers)** : niveaux qui débloquent des avantages, avec progression visible.
- **Points** gagnés par commande payée, avis utile et parrainage validé ; échangeables contre livraisons offertes ou réductions.
- **Défis** hebdomadaires et badges (découvrir un nouveau quartier, premier restaurant commandé, avis déposé).
- **Parrainage** à double récompense (parrain et filleul), après une première commande payée.
- **Récompenses personnalisées** selon les habitudes du client (catégories préférées, quartier), calculées par règles.
- **Offres à durée limitée** annoncées avec leur date de fin réelle.
- **Rappels** de série et de défis, désactivables depuis le compte.

**Garde-fous conservés** (ce sont des limites légales ou de protection, pas de confort) :
- Aucune loterie, aucun tirage, aucun pari : risque juridique et de dépendance avéré.
- Les points ne s'achètent pas et n'ont pas de valeur de rachat en argent : sans cela, Speedfood s'exposerait à une qualification de monnaie électronique.
- Pas de mécanique ciblant les mineurs : les comptes déclarant moins de 18 ans n'ont pas de défis ni de rappels. **Décision du 13 octobre 2026 (option 1) : déclaration de date de naissance à l'inscription, sans document.** La déclaration est limitée à un indicateur « 18 ans ou plus », pour ne pas collecter plus que nécessaire. Un juriste doit confirmer le seuil de 18 ans et la validité de cette déclaration.
- Les règles de points sont publiées en clair et les rappels restent désactivables.

**Assouplissements retenus** (par rapport à la première rédaction) :
- Rappels de série jusqu'à un par jour, avec des formulations directes (« votre série continue demain ») et sans culpabilisation.
- Offres à durée limitée et compte à rebours autorisés, à condition que la date de fin soit réelle.
- Fréquence des notifications de défis laissée au réglage de l'équipe produit, avec un suivi mensuel de la désactivation (sans seuil bloquant).

### 9.4 Publicité et mise en avant
- Emplacements payants clairement signalés « sponsorisé » ; limités en nombre ; jamais au détriment du classement honnête sur les critères affichés.
- Facturation par période ou par clic à définir ; aucune facturation avant décision de §10.

---

## 10. Restaurants, livreurs et entreprises : inscription et vie du compte

- **Restaurant** : demande en plusieurs étapes (type, commune, quartier, position sur carte, catégories, moyens de paiement acceptés, horaires, mode(s) de livraison). Publication après validation manuelle.
- **Livreur indépendant** : inscription, pièces, zone, véhicule, validation manuelle, formation courte.
- **Entreprise de livraison** : inscription légale, liste de livreurs rattachés, responsable désigné, contrat de service.
- Conditions de partenariat (commission, frais, délais de reversement) **publiées** avant inscription.
- Tableau de bord de chaque acteur : commandes, gains ou ventes, avis, alertes, documents.

## 11. Administration et opérations

- Validation et suspension de restaurants, livreurs et entreprises, avec motif.
- Gestion des litiges : remboursement total ou partiel, réaffectation, sanction.
- Finance : tableau des paiements, des reversements, des remboursements, des commissions ; export pour la comptabilité ; rapprochement avec les relevés opérateurs.
- Modération des avis, des photos et des signalements.
- Gestion des promotions et des campagnes de fidélité.
- Journal d'audit complet pour toute action sensible.
- Indicateurs : commandes, taux d'achèvement, délais de livraison réels, litiges, annulations, rétention, taux de livreurs actifs.

## 12. Phasage

| Phase | Contenu | Condition de lancement |
|---|---|---|
| **Pilote (actuel)** | Catalogue, géographie, commande, paiement espèces et code marchand, console restaurant, alertes, PWA, CMS de base | Déjà en cours |
| **Phase 2** | Livraison (modes 1, 2, 4), comptes livreurs et entreprises, carte et guidage, avis, promotions simples | Décision fournisseur de cartes ; procédure d'inscription des livreurs validée |
| **Phase 3** | Paiement mobile money en production, reversements, fidélité et gamification, mise en avant payante | Prérequis juridiques et contractuels de §5.2 levés ; coûts approuvés |
| **Phase 4** | Mode livraison par prestataire, suivi GPS complet, programme de parrainage à grande échelle, extension hors Conakry | Mesures du pilote et accord de Malika |

Le pilote ne doit pas encaisser d'argent mobile money tant que la phase 3 n'est pas autorisée.

---

## 13. Dépendances externes et décisions

| Élément | Statut | Action requise |
|---|---|---|
| Chap Chap Pay (agrégateur de paiement) | En cours de concrétisation ; demande de tarifs envoyée le 13 octobre 2026, réponse attendue ; compte non créé, dossier KYC non soumis | Ouverture du compte test à autoriser par Malika (écrit) |
| Agrément BCRG de Chap Chap Pay | Affirmé sur leur site, non vérifié ; vérification **non autorisée pour le moment** | Autorisation de Malika avant toute vérification |
| Conseil juridique guinéen (paiement, données, livraison) | Non engagé | Accord écrit et budget |
| Google Maps Platform (forfait Essentials) | Choisi ; compte de facturation non créé | Malika crée le compte ou autorise par écrit ; plafond et alerte configurés |
| OpenStreetMap (fond de carte) | Choisi ; fournisseur de tuiles pour l'usage réel non choisi | Chiffrage avant mise en production |
| Connexion Facebook (présente dans le code) | Application Meta à configurer et approuver | Malika : compte développeur Meta ou autorisation écrite |
| Connexion Google (à construire) | Client OAuth à créer | Malika : projet Google Cloud ou autorisation écrite |
| Vérification SMS (OTP) du numéro en Guinée | **Prévue, non lancée** (décision du 13 octobre 2026). Écart avec la règle §5.1 pendant la période provisoire | Choisir le fournisseur (Orange SMS, Twilio Verify ou Vonage Verify) puis l'essai, sur décision de Malika |
| Notifications push | Lot ultérieur | Consentement et validation sur appareils cibles (`VAPID_PRIVATE_KEY` requis) |
| Hébergement, base, stockage des pièces d'identité | Région à confirmer | Conservation et chiffrement documentés avant pilote réel |
| Recrutement et formation des livreurs | Non engagé | Plan terrain, responsable désigné |

---

## 14. Exigences non fonctionnelles (ajouts à la v0.1)

- **Sécurité** : contrôle d'accès au niveau de la base sur chaque donnée multi-acteurs ; vérification des paiements côté serveur ; secrets opérateurs jamais exposés au navigateur ; limitation de débit sur OTP, commande et avis.
- **Données personnelles** : positions GPS limitées à la durée utile ; pièces d'identité chiffrées et accessibles au seul service de vérification ; **conservation des pièces des livreurs et entreprises : pendant toute la durée d'activité, puis 12 mois après la fin du compte, avec purge automatique** (décision du 13 octobre 2026, option 2 ; à faire confirmer par un juriste guinéen) ; durée de conservation par catégorie, appliquée automatiquement (cf. `CONSERVATION-ET-CONSENTEMENT`).
- **Disponibilité** : pendant les heures de service, la plateforme doit rester utilisable ; procédure de dégradation documentée (passage au mode espèces si le paiement tombe).
- **Performance** : catalogue et carte utilisables sur connexion mobile moyenne ; données de position mises à jour sans épuiser la batterie.
- **Accessibilité et langue** : français ; contraste AA ; navigation clavier ; textes centralisés pour une localisation future.
- **Journalisation** : jamais de numéro de carte, de code opérateur ni de pièce d'identité dans les journaux.
- **Tests** : parcours de bout en bout (commande, paiement en sandbox, livraison, avis, remboursement) avant chaque phase.

## 15. Indicateurs

- Par zone : commandes, taux d'acceptation, délai de livraison réel, taux d'annulation, litiges.
- Par acteur : livreurs actifs par semaine, restaurants actifs, revenu par commande.
- Engagement : fréquence de commande, rétention à 30 jours, part de commandes issues de la fidélité.
- Confiance : part d'avis vérifiés, délai de traitement des litiges, incidents de paiement.
- Responsabilité : nombre de notifications envoyées par utilisateur et par semaine, taux de désactivation des alertes (garde-fou du §9.3).

Les cibles chiffrées sont fixées après mesure de référence, jamais inventées à l'avance.

## 16. Points retirés de la v0.1

- « Livraison exclue » et « paiement encaissé exclu » : **retirés** (décisions de Malika du 13 octobre 2026).
- « Avis, coupons, fidélité, publicité exclus » : **retirés** ; ils entrent en phases 2 à 4.
- « Application native exclue » : **maintenue** pour l'instant ; PWA d'abord. **[DÉCISION]** si une application native est visée en phase 3.
- « Intégration WhatsApp automatisée exclue » : **maintenue** (coût et règles non confirmés).
- « Commande groupée et panier multi-restaurant exclus » : **maintenus**.

## 17. Points restant à trancher

1. Validation du phasage (§12) et de l'ordre des modules.
2. Autorisation de demander les tarifs à Chap Chap Pay et de vérifier son agrément BCRG (§5.2).
3. Conseil juridique guinéen (§5.2 et §13), avec budget.
4. Commission et frais (§5.3), à fixer après le pilote.
5. Application native ou PWA seule en phase 3.
6. Région d'hébergement et conservation des pièces d'identité (§14).
7. Seuil de 18 ans et validité de la déclaration d'âge pour l'exclusion des mineurs de la gamification (§9.3), à confirmer par un juriste. Décision technique prise : déclaration sans document.

Décisions prises le 13 octobre 2026 : Chap Chap Pay comme agrégateur de paiement, en cours de concrétisation (§5.2) ; forfait Essentials Google Maps complété par OpenStreetMap (§7) ; recette de gamification des applications à succès, garde-fous assouplis et limités aux protections légales (§9.3).

## 18. Ce qui n'est pas décidé ici

Aucune mise en production, aucun contrat, aucun compte, aucun service payant et aucune dépense n'est engagé par ce document. Chaque phase fait l'objet d'un plan d'exécution distinct, soumis à validation avant tout déploiement.

---

*Document de travail. Les sections v0.1 non citées ci-dessus restent en vigueur jusqu'à validation de cette version.*
