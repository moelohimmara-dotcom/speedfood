# Termes de référence — Speedfood

**Version :** 0.1 — cadrage de travail  
**Date :** 27 septembre 2026  
**Produit :** portail web de découverte et de commande directe auprès des restaurants  
**Lancement pilote visé :** une zone limitée de Conakry, Guinée

## 1. Résumé exécutif

Speedfood est un portail web mobile-first et installable (PWA) qui rassemble des menus à jour et permet aux clients de transmettre une commande directement au restaurant. Chaque restaurant possède sa propre console de gestion, conçue pour être utilisable sans formation technique. L’équipe Speedfood dispose d’un CMS système pour administrer les restaurants, le contenu public, la modération et les opérations. Le restaurant garde la décision finale sur la disponibilité et la préparation; toute modification du prix total ou des conditions de livraison attend l’accord explicite du client. Le MVP ne collecte aucun paiement et n’opère pas de livraison.

Le présent TDR définit le périmètre produit et technique à réaliser avant un pilote. Les noms, restaurants, plats, prix et quartiers du prototype sont des données fictives. Les hypothèses de paiement, livraison, tarification et intégration de messagerie restent à valider avec des utilisateurs à Conakry.

Le déroulé détaillé des parcours client, restaurant, administrateur système et PWA est dans [PARCOURS-UTILISATEUR.md](PARCOURS-UTILISATEUR.md). La description technique et design se trouve dans [ARCHITECTURE-DESIGN.md](ARCHITECTURE-DESIGN.md). Ces documents distinguent le prototype existant des éléments à construire.

## 2. Contexte et problème

Les clients doivent pouvoir comparer les menus et trouver une adresse sans parcourir des publications dispersées ou contacter plusieurs restaurants pour connaître les offres. Les restaurants ont besoin d’un moyen simple de publier leur menu et de recevoir des commandes lisibles sans perdre le contrôle de leur activité.

Le projet teste si un portail local peut résoudre ces deux problèmes avec un parcours simple : découverte → menu → commande → confirmation du restaurant.

## 3. Objectifs

### Objectifs du MVP

1. Donner aux clients un catalogue de restaurants consultable sur téléphone et ordinateur.
2. Permettre la recherche par nom, plat, catégorie et quartier.
3. Permettre au client de constituer un panier ne contenant que les articles d’un restaurant, puis d’envoyer une demande de commande.
4. Fournir à chaque restaurant sa propre console de gestion, sécurisée et centrée sur les tâches quotidiennes : commandes, menu, horaires, disponibilité et profil.
5. Fournir à l’administration système un CMS pour piloter les contenus publics et les opérations de la plateforme avec rôles distincts et audit.
6. Donner au client un retour explicite sur l’envoi et le statut de la demande.
7. Rendre le portail installable comme PWA, avec un démarrage rapide et une page hors connexion sans données dynamiques.
8. Mesurer l’usage pilote sans collecter de données superflues.

### Résultats attendus

- Un restaurant pilote peut publier seul un menu exploitable.
- Un client peut passer une commande sans créer de compte.
- Le restaurant reçoit et traite sa commande depuis un espace sécurisé.
- Aucun restaurant ne peut consulter ou modifier les données d’un autre.
- L’équipe peut suivre les conversions, confirmations, refus, annulations et répétitions de commande.

## 4. Utilisateurs et rôles

| Rôle | Besoin | Permissions MVP |
|---|---|---|
| Visiteur/client | Trouver un repas et demander une commande | Lire les restaurants publiés; envoyer et consulter sa commande via un mécanisme de suivi non devinable |
| Propriétaire restaurant | Gérer l’établissement et les commandes | Console de son seul restaurant; profil, menu, disponibilité, horaires, commandes et membres autorisés |
| Équipier restaurant | Aider aux commandes et au menu | Permissions limitées par rôle et par établissement; aucune donnée d’un autre restaurant |
| Administrateur système | Gérer l’ensemble de la plateforme | CMS système selon rôle : restaurants, contenus publics, taxonomie, modération, opérations et configuration autorisée |
| Éditeur de contenu / support | Maintenir contenus ou aider les utilisateurs | Sous-ensemble de permissions; accès aux données personnelles minimisé et journalisé |

Le CMS distingue au minimum les rôles `super_admin`, `operations`, `content_editor` et `support`. Leurs permissions sont explicites et ne sont jamais attribuées depuis une inscription publique. Les coordonnées personnelles des clients restent masquées dans les fonctions de support sauf accès exceptionnel autorisé, motivé et audité.

## 5. Périmètre fonctionnel

### Inclus

- Catalogue public de restaurants approuvés et actifs.
- Recherche, catégories, quartier et fiche restaurant.
- Menus et disponibilité de chaque plat.
- Panier mono-restaurant.
- Commande invité avec nom et numéro de contact; adresse demandée seulement si la livraison est sollicitée.
- Accusé de réception et page de suivi à identifiant opaque ou lien secret.
- Console dédiée à chaque restaurant, avec accueil opérationnel, commandes, menu, horaires/statut d’ouverture, profil et aide; UX pensée pour téléphone, gros contrôles tactiles, libellés simples et parcours guidé.
- CMS système couvrant tableau de bord, gestion des restaurants, comptes et rôles admin, validation/suspension, catégories/quartiers/tags, mise en avant, contenus éditoriaux/pages/FAQ/bannières, recherche de commandes pour le support selon permission, journal d’audit et indicateurs d’activité.
- PWA installable : manifest, icônes, nom d’application, cache du shell et des ressources statiques seulement; page hors connexion informative. Les menus dynamiques ne sont pas présentés comme à jour hors connexion.
- Persistance côté serveur, journaux d’événements minimum nécessaires, gestion des erreurs.
- Interface responsive, français, format monétaire GNF en entier.

### Exclus du MVP

- Paiement encaissé ou conservé par Speedfood.
- Calcul ou exécution de la livraison par Speedfood.
- Application native Android/iOS.
- Commandes hors ligne, synchronisation différée d’actions métier ou stockage hors ligne de données personnelles.
- Notifications push dans la première tranche PWA; à envisager après mesure de compatibilité et validation du besoin terrain.
- Avis publics, commentaires, coupons, fidélité, publicité avancée, recommandation personnalisée opaque ou prédictive par IA. La recherche et le classement déterministe par règles sont inclus selon la spécification pilote.
- Abonnement, commission, facturation et rapprochement financiers automatisés.
- Commande groupée ou panier multi-restaurant.
- Intégration WhatsApp Business automatisée tant que le canal, les coûts, les règles applicables et le processus de secours ne sont pas confirmés. Les liens de partage et d’ouverture de conversation sont inclus selon la spécification pilote.

## 6. Parcours métier et règles

### Parcours client

1. Le visiteur ouvre le catalogue et filtre les établissements.
2. Il consulte la fiche et un menu dont les prix et disponibilités ont été publiés par le restaurant.
3. Il ajoute des articles d’un seul établissement au panier.
4. Il saisit un nom, un numéro de contact, le retrait ou une demande de livraison, et l’adresse si nécessaire.
5. Le serveur recalcule le total à partir des prix de référence, enregistre un instantané des libellés et prix, puis crée la commande en attente.
6. Le visiteur reçoit un numéro/lien de suivi non devinable et une indication claire que la demande reste à confirmer.
7. Le restaurant peut accepter les conditions initiales, refuser, ou proposer une révision du prix total/conditions de livraison.
8. Si une révision est proposée, la commande reste `en_attente` et son état affiché devient « attente de confirmation du client » (état dérivé, `attente_confirmation_client`); le client voit les conditions initiales et proposées, les frais détaillés et le nouveau total, puis accepte ou refuse explicitement.
9. Seule l’acceptation explicite du client fait passer la commande à `acceptee`. Un refus la clôt en `annulee`; l’absence de réponse à l’échéance fait passer la proposition à `expiree` et la commande à `annulee`. Aucune préparation ne commence avant l’accord.
10. Le client voit les états jusqu’à la préparation et la remise du repas.

### Parcours restaurant

1. Un restaurateur crée un compte ou reçoit une invitation contrôlée par l’administrateur.
2. Il complète les données de son établissement et son menu.
3. Le restaurant reste non publié jusqu’à validation administrative.
4. Une nouvelle commande apparaît dans son espace; un canal de notification ne s’ajoute que s’il est réellement choisi et configuré pour le pilote.
5. Le restaurateur accepte, refuse, marque prête, puis terminée; il peut annuler selon les règles définies.

### États de commande

États stockés de la commande : `en_attente` → `acceptee` ou `refusee`; `acceptee` → `prete` → `terminee`; `annulee` selon les règles d’annulation. Quand le restaurant propose une révision, la commande reste `en_attente` et son **état dérivé** est `attente_confirmation_client` : elle passe à `acceptee` après accord explicite du client, ou à `annulee` après refus. L’**échéance** (30 minutes par défaut, paramètre global modifiable dans `/system/parametres`) fait passer la *proposition* à `expiree` et la commande à `annulee`. Toute proposition révisée garde les conditions et montants initiaux, le détail de la proposition, son auteur, son heure, son échéance et la réponse du client. Chaque transition est validée côté serveur et historisée. Une commande en attente n’est ni payée, ni confirmée, ni une promesse de livraison.

### Règles de données

- Une commande référence exactement un restaurant.
- Le serveur recalcule prix et total; les valeurs envoyées par le navigateur ne sont jamais une source d’autorité.
- Les lignes de commande conservent un instantané du nom, du prix GNF entier et des options au moment de l’envoi.
- Un restaurant ne peut modifier que ses propres données et traiter que ses commandes.
- Le suivi client ne révèle aucune donnée personnelle et utilise un jeton aléatoire difficile à deviner.
- Le téléphone et l’adresse sont des données personnelles : finalité, accès, durée de conservation et suppression doivent être définis avant pilote réel.

## 7. Exigences non fonctionnelles

- Mobile-first, utilisable sur connexions mobiles variables et appareils modestes.
- PWA progressive : le portail fonctionne aussi dans le navigateur; les fonctions installables améliorent l’accès sans être obligatoires.
- Ne mettre en cache que le shell applicatif et les ressources statiques versionnées; exclure menus dynamiques, commandes, suivi, sessions, coordonnées client, console restaurant et CMS.
- Aucune commande ou mutation d’administration n’est présentée comme envoyée hors connexion; l’interface exige l’accusé du serveur.
- Installation en production via HTTPS; compatibilité d’installation vérifiée sur les appareils ciblés.
- Français pour le pilote; textes, formats de date et monnaie centralisés pour une localisation future.
- Contraste, navigation clavier, libellés accessibles et erreurs explicites.
- Autorisation vérifiée côté serveur et à la base; isolation multi-restaurant par défaut.
- Secrets hors du dépôt; variables documentées dans un `.env.example` sans valeur réelle.
- Sauvegarde/restauration documentée avant données pilotes réelles.
- États de chargement, vide, succès et erreur pour les parcours principaux.
- Journalisation sans mots de passe, jetons de suivi ni contenu excessif des commandes.
- Déploiement reproductible et environnement de préproduction distinct de la production.

## 8. Modèle économique à tester

Pas de facturation dans le MVP. Hypothèses à tester séparément après l’observation d’un usage réel : (a) abonnement mensuel pour les outils de gestion et la visibilité; (b) frais sur les commandes apportées par le portail; (c) options de mise en avant clairement signalées. Ne pas mélanger plusieurs frais pendant le premier test. Ne pas facturer une commission sur des commandes que la plateforme ne peut attribuer de manière fiable.

## 9. Indicateurs de pilote

- Restaurants invités, vérifiés, publiés et actifs par semaine.
- Part des restaurants avec profil, horaires et menu complets.
- Visites de fiche → démarrage panier → commande envoyée.
- Taux d’acceptation/refus/annulation et délai jusqu’à première réponse.
- Part des commandes terminées et taux de nouvelle commande.
- Incidents de disponibilité, de prix ou de contact par commande.
- Entretiens et intention de payer, suivis séparément des simples déclarations d’intérêt.

Les cibles numériques seront fixées après entretiens et mesure de référence; ne pas inventer de seuils avant ce travail.

## 10. Contraintes, dépendances et risques

- Disponibilité réelle de la connexion et appareils des restaurateurs à vérifier sur le terrain.
- La livraison est opérée par les restaurants pendant le pilote; sa confirmation reste leur responsabilité.
- Le canal d’alerte doit être testé avec les utilisateurs et prévoir un tableau de bord consultable si la notification échoue.
- Prestataire, région cloud, exigences de conservation des données et conditions juridiques à confirmer avant production.
- Faible densité de restaurants ou menus obsolètes peuvent rendre le portail inutile; démarrer dans une seule zone et accompagner l’onboarding.
- Fraude, faux établissements, spam de commandes et accès inter-tenant exigent vérification, limitation de débit et journal d’audit adapté.

## 11. Livrables

1. Application web responsive et installable PWA avec code source documenté.
2. Schéma de données, migrations versionnées et politiques d’accès.
3. Parcours client, console restaurant et CMS système du MVP.
4. Documentation locale, configuration, migration, sauvegarde et déploiement.
5. Matrice d’autorisations et registre des événements/statuts.
6. Rapport de revue de sécurité et liste des décisions restant à prendre.
7. Procédure d’onboarding et guide court du restaurateur.
8. Guide sécurité du propriétaire, procédure sécurité des agents, modèle de revue indépendante et porte de mise en service dans `SECURITE-GUIDE-PROPRIETAIRE.md`, `PROCEDURE-SECURITE.md` et `PROMPTS-AGENTS-SECURITE.md`.

## 12. Critères d’acceptation globaux

- Le client peut parcourir des établissements actifs, voir un menu, envoyer une commande valide et consulter son statut.
- Le serveur ignore tout total soumis par le client et recalcule depuis le menu courant.
- Un restaurateur authentifié peut traiter seulement les commandes de son propre établissement.
- Chaque restaurant dispose de sa propre console et ne peut jamais administrer un autre établissement.
- La console restaurant met les commandes à traiter en évidence et permet les actions quotidiennes sans jargon; cette simplicité est évaluée avec des restaurateurs pendant le pilote.
- Cible d’ergonomie provisoire : confirmer/refuser une commande, marquer un plat indisponible et fermer temporairement le restaurant sont réalisables depuis l’accueil en deux actions au maximum; cette cible sera ajustée après observation terrain.
- Le CMS permet aux rôles autorisés de gérer restaurants, contenu public, taxonomie et modération; seuls les rôles privilégiés contrôlés peuvent attribuer des rôles système.
- Les actions CMS sensibles et changements de publication/modération sont journalisés avec auteur, heure et motif.
- La PWA est installable sur les navigateurs/appareils ciblés; hors connexion elle affiche une page claire sans données dynamiques ni mutation.
- Un établissement non publié ou suspendu n’apparaît pas dans le catalogue public.
- Un prix ou article modifié après commande ne réécrit pas la commande historique.
- Les états impossibles sont rejetés et les transitions permises sont historisées.
- Les parcours disposent d’états chargement, vide, erreur et réussite.
- Les étapes d’installation et de configuration sont reproductibles à partir des instructions.
- Les intégrations non configurées sont explicitement indisponibles, jamais simulées comme réelles.

## 13. Gouvernance et validation

Le propriétaire produit valide le périmètre, les libellés, les hypothèses de paiement/livraison et l’entrée en pilote. Un agent IA reçoit un bloc de tâches unique avec fichiers attribués; il doit lire le brief commun, respecter le dépôt, produire une synthèse des fichiers modifiés et des limites, puis laisser le propriétaire intégrer/revoir les changements. Les blocs dépendants ne démarrent qu’après acceptation de leurs contrats et critères.

## 14. Addendum de périmètre — pilote découverte et comptes (3 octobre 2026)

L’addendum consolidé `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` complète et prévaut sur les formulations antérieures pour les fonctions ci-dessous :

- Recherche par plat, quartier/proximité et statuts distincts « restaurant ouvert », « accepte les commandes » et « plat disponible ».
- Disponibilité gérée par le restaurant, horodatée et présentée « à confirmer » quand elle est périmée; pas de garantie d’inventaire automatique.
- Alternatives organisées en correspondance exacte confirmée, exacte à confirmer, équivalent confirmé et suggestions catégorielles, avec labels visibles.
- Classement initial explicable par règles; personnalisation opaque/IA reste hors pilote.
- Consultation publique sans compte; méthodes souhaitées Google et téléphone +224, OTP activé seulement après essai fournisseur/coût/couverture en Guinée et protections anti-abus.
- Création de pages restaurant en brouillon, vérification manuelle initiale puis publication.
- Partage Speedfood vers WhatsApp avec lien/texte prérempli; pas d’envoi automatique, de bot ou de synchronisation de commandes.
- L’identité visuelle précise la différence entre le portail client éditorial et les consoles restaurant/CMS fonctionnelles, sans inventer avis, popularité ou stock.

Ces besoins ajoutent aux objectifs, critères d’acceptation et indicateurs du TDR. Les tâches déléguées doivent suivre la spécification pilote lorsqu’un ancien passage dit que recherche algorithmique, accès téléphone/Google ou partage WhatsApp ne sont pas inclus.

## Addendum — notifications et outils d’interface (3 octobre 2026)

La démo possède déjà un toast; il est à améliorer pour les retours immédiats. Les notifications transactionnelles du pilote peuvent d’abord vivre dans l’application; les push navigateur/PWA sont un lot ultérieur, activé après consentement explicite et validation sur appareils cibles. Le push n’est jamais requis pour utiliser le portail et ne remplace pas le suivi Speedfood.

La collection d’icônes fonctionnelles conserve le trait arrondi régulier validé; une petite famille d’illustrations culinaires SVG originales apporte la signature de marque. Les bibliothèques proposées sont conditionnelles à la pile réellement retenue et à l’inspection du dépôt. Le détail, les fournisseurs candidats et les règles d’usage sont dans `NOTIFICATIONS-ICONES-OUTILS.md`.
