# Speedfood — portail de commande pour restaurants

Projet de validation produit pour un lancement envisagé à Conakry, en français.

**En ligne :** [speedfood.pages.dev](https://speedfood.pages.dev/) (landing + démo cliquable sous [`/prototype`](https://speedfood.pages.dev/prototype/index.html)) — hébergé sur Cloudflare Pages, projet `speedfood`.

## Ce dossier contient

- `landing/` : page de présentation publique (vision, comment ça marche, argument restaurateurs, formulaire d'inscription démo). Ouvrir `landing/index.html`.
- `prototype/` : démo cliquable de l'application (portail client + espace restaurant), sans backend. Ouvrir `prototype/index.html`. Voir `prototype/README.md`.
- Les fichiers de cadrage ci-dessous.

Aucune installation n'est nécessaire pour ouvrir l'une ou l'autre : double-clic sur le fichier `index.html` concerné.

## Dossier de cadrage

- `TDR.md` : mandat, périmètre, utilisateurs, règles métier et critères d’acceptation.
- `ADR.md` : décisions d’architecture proposées, conséquences et décisions encore ouvertes.
- `AGENT-INSTRUCTIONS.md` : brief commun et règles à joindre à chaque tâche de coding.
- `PLAN-EXECUTION.md` : lots délégables, dépendances, responsabilités de fichiers et prompts d’assignation.
- `CADRAGE.md` : résumé produit initial.
- `FRONTEND-DESIGN-BRIEF.md` : consignes écran par écran pour les wireframes, la carte des parcours, le prototype interactif et sa revue.
- `AUDIT-SUPABASE.md` : état des lieux de la base de données Supabase (schéma, sécurité, écarts à traiter).

Le périmètre retenu inclut une PWA installable, une console séparée pour chaque restaurant et un CMS système avec des permissions distinctes. Le produit porte désormais le nom Speedfood. Une modification de prix ou des conditions de livraison après envoi exige l’accord explicite du client avant confirmation ou préparation. Les intégrations de push, paiement et livraison restent à valider ou hors MVP.

## Limites actuelles

Une base de données existe désormais pour le MVP : projet Supabase `ggldjdizqrtpetdiohxy` (PostgreSQL 17, région `eu-west-1` à confirmer), qui contient déjà le schéma des menus, commandes, rôles et contenus, avec RLS activé. Son état des lieux est dans `AUDIT-SUPABASE.md`; ses migrations sont en cours de reprise versionnée dans le dépôt (bloc 2). En revanche, ni la landing page ni le prototype n’y sont connectés : aucun parcours de compte réel, aucune notification WhatsApp, aucun paiement, aucun calcul confirmé de livraison. Les inscriptions de la landing page et les commandes du prototype restent dans le stockage local du navigateur qui les a créées. Les restaurants, plats, prix et quartiers affichés dans le prototype sont fictifs et doivent être remplacés par des données du marché de lancement.

## Prochaine étape de conception

Valider auprès de restaurants et de clients de Conakry les moyens de paiement préférés, le fonctionnement de la livraison et le premier segment (par exemple les déjeuners de bureau). Ces décisions permettront de concevoir l’authentification, le modèle multi-restaurants, les notifications et le modèle tarifaire sans coder des intégrations inadaptées. Les prix affichés sont fictifs, même s’ils sont formatés en GNF.
