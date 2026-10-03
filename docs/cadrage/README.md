# Speedfood — portail de commande pour restaurants

> **Lire d'abord — deux bases de travail distinctes.** Ce dossier `docs/cadrage/` est la copie, dans le dépôt de l'application réelle, des documents rédigés dans le dossier de travail de Malika. Ces documents ont été écrits en partie du point de vue du **prototype** (démo HTML/CSS/JS, `localStorage`, données fictives). L'**application réelle** (Next.js + Supabase, déjà en production sur Cloudflare Workers) existe dans ce dépôt et est bien plus avancée que ce que la démo décrit : commandes serveur avec recalcul des prix, console restaurant, CMS système, RLS, audit. Pour l'état exact bloc par bloc et ce qui est vérifié, lire `../STATUT-PROJET.md`. Quand une phrase de ces documents dit « la démo » ou « le prototype », elle ne décrit pas l'application réelle.

Prototype interactif de validation produit pour un lancement envisagé à Conakry, en français. Ouvrir `index.html` dans un navigateur récent (dossier prototype, hors de ce dépôt). Aucune installation n’est nécessaire.

## Dossier projet

- `TDR.md` : mandat, périmètre, utilisateurs, règles métier et critères d’acceptation.
- `ADR.md` : décisions d’architecture proposées, conséquences et décisions encore ouvertes.
- `AGENT-INSTRUCTIONS.md` : brief commun et règles à joindre à chaque tâche de coding.
- `PLAN-EXECUTION.md` : lots délégables, dépendances, responsabilités de fichiers et prompts d’assignation.
- `PARCOURS-UTILISATEUR.md` : parcours étape par étape des clients, restaurateurs, équipe Speedfood et PWA, avec cas d’erreur et questions ouvertes.
- `PARCOURS-CIBLE-CLIENT-MVP.md` : parcours cible détaillé qui part de la démo actuelle et la fait évoluer jusqu’à une expérience pilote réelle, simple et engageante.
- `NOTIFICATIONS-ICONES-OUTILS.md` : types de notifications, politique d’usage, iconographie Speedfood et outils/librairies candidats.
- `ARCHITECTURE-DESIGN.md` : architecture technique, modules, données, flux de commande et principes d’interface.
- `DESIGN-SYSTEM.md` : palette retenue, typographie choisie et proposition de style des composants et des icônes.
- `FRONTEND-DESIGN-BRIEF.md` : consignes écran par écran pour les wireframes, la carte des parcours, le prototype interactif et sa revue.
- `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` : spécification consolidée du pilote réel — découverte/disponibilité, alternatives, WhatsApp comme canal de partage, identité Google/téléphone et direction visuelle.
- `ETUDE-CONCURRENTIELLE-GUINEE.md` : repérage documentaire des plateformes restaurant-client en Guinée, comparaison avec Speedfood et plan d’étude terrain.
- `SECURITE-GUIDE-PROPRIETAIRE.md` : explication sans jargon des risques, des usages permis et des preuves à demander.
- `PROCEDURE-SECURITE.md` : procédure de sécurité par lot, de revue, de mise en préproduction, de mise en ligne et de réponse à un incident.
- `PROMPTS-AGENTS-SECURITE.md` : consignes prêtes à copier pour un agent de mise en œuvre, un relecteur indépendant et un rapport de mise en ligne.
- `CADRAGE.md` : résumé produit initial.

Le périmètre retenu inclut une PWA installable, une console séparée pour chaque restaurant et un CMS système avec des permissions distinctes. Le produit porte désormais le nom Speedfood. Une modification de prix ou des conditions de livraison après envoi exige l’accord explicite du client avant confirmation ou préparation. Pour les décisions consolidées les plus récentes, notamment disponibilité en temps réel déclarée par les restaurants, recherche locale, alternatives en cas de rupture, connexion Google/téléphone et partage WhatsApp, lire `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` avant de déléguer.

## Parcours inclus

- Découvrir quatre restaurants de démonstration, filtrer par catégorie, plat et quartier.
- Chercher les plats déclarés disponibles, filtrer par ouverture/prise de commandes et obtenir des alternatives explicites si un article est épuisé.
- Partager les pages Speedfood via WhatsApp; les commandes/contact WhatsApp restent une redirection volontaire, sans intégration automatisée.
- Consulter un menu et ajouter des plats au panier.
- Envoyer une demande de commande avec nom, téléphone et retrait/livraison.
- Ouvrir l’espace restaurant, consulter les commandes et les confirmer.
- Les données de démonstration sont conservées dans le stockage local du navigateur.

## Limites actuelles

Ce prototype n’est pas encore un service en ligne : il n’y a ni comptes réels, ni base de données partagée, ni notification ou commande WhatsApp automatisée, ni paiement, ni calcul confirmé de livraison. Les commandes sont visibles uniquement dans le navigateur qui les a créées. Les restaurants, plats, prix et quartiers sont fictifs et doivent être remplacés par des données du marché de lancement. Le pilote réel exige persistance serveur, autorisations multi-restaurant, protection des comptes, surveillance d’erreurs et procédures d’exploitation.

## Prochaine étape de conception

Valider auprès de restaurants et de clients de Conakry les moyens de paiement préférés, le fonctionnement de la livraison et le premier segment (par exemple les déjeuners de bureau). Ces décisions permettront de concevoir l’authentification, le modèle multi-restaurants, les notifications et le modèle tarifaire sans coder des intégrations inadaptées. Les prix affichés sont fictifs, même s’ils sont formatés en GNF.

## Mise à jour documentaire — 3 octobre 2026

La nouvelle spécification `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` rassemble la direction du pilote après validation des idées de recherche locale, disponibilité, alternatives, WhatsApp, comptes et design. `PARCOURS-CIBLE-CLIENT-MVP.md` détaille le parcours à partir de la démo existante. Ces documents prévalent pour ces sujets lorsqu’un passage historique diverge. Les règles doivent encore être confrontées aux restaurateurs et clients de Conakry; aucun test terrain ou intégration réelle n’est affirmé.

Notifications navigateur/PWA, outils d’interface et librairies candidates sont spécifiés dans `NOTIFICATIONS-ICONES-OUTILS.md`. L’ajout de Web Push est post-MVP et conditionné à l’opt-in et aux essais techniques.
