# Cahier d’exécution frontend — wireframes et prototype Speedfood

**Version :** 0.1 — spécification de conception et de réalisation  
**Périmètre :** portail client, console restaurant et CMS système  
**Livrable :** wireframes annotés, carte des parcours, composants et prototype interactif haute fidélité

> Les interactions simulées ne doivent jamais être présentées comme connectées au serveur.

## 1. Mission de l’agent

Concevoir les trois surfaces Speedfood : (1) portail public/client, utilisable sans compte et installable en PWA; (2) console restaurant, propre à chaque établissement, simple pour des utilisateurs non techniques et adaptée au téléphone; (3) CMS système, réservé aux équipes Speedfood, avec outils de contenu et d’opérations selon les rôles.

Commencer par un inventaire des écrans et des wireframes basse fidélité couvrant les parcours MVP. Après revue du responsable produit, appliquer le système visuel retenu et livrer un prototype haute fidélité jouable, écran par écran, avec les états et règles métier définis ci-dessous.

## 2. Sources à lire avant de commencer

1. `AGENT-INSTRUCTIONS.md` et les instructions locales du dépôt.
2. `TDR.md` pour le périmètre, les rôles et les critères globaux.
3. `PARCOURS-UTILISATEUR.md` pour les parcours et les erreurs.
4. `DESIGN-SYSTEM.md` pour les tokens et composants validés.
5. `ARCHITECTURE-DESIGN.md` et `ADR.md` pour les surfaces et limites techniques.
6. Le bloc attribué dans `PLAN-EXECUTION.md`.

En cas de contradiction, la signaler et proposer une résolution; ne pas trancher silencieusement une règle métier.

## 3. Décisions de design déjà validées

- Marque : **Speedfood**.
- Palette : rouge `#D9362B`, orange `#FF7A1A`, mangue `#FFC247`, fond crème `#FFF6ED`, surface `#FFFEFC`, encre `#2B211D`, secondaire `#75695F` (ajusté depuis `#80736C` le 2026-09-27 : la valeur d'origine ne passait pas le contraste AA sur fond crème, 4.29:1 au lieu de 4.5:1 minimum ; `#75695F` donne 4.99:1 sans changement visuel perceptible), bordure `#E9DCD2`.
- Typographie : **Barlow Condensed 700/800** pour marque, grands titres et accroches courtes; **Manrope** pour l’interface, descriptions, formulaires, tables et boutons. Prévoir Latin étendu et solution de secours; ne pas dépendre d’un fournisseur de polices en production.
- Icônes : SVG linéaires au trait arrondi régulier, grille 24 × 24, épaisseur visuelle 1,75–2 px. Pas d’emoji comme contrôle.
- Style : énergique, chaleureux et net; éditorial côté client, calme et utilitaire dans console/CMS.
- Cibles tactiles : 44 × 44 px minimum pour les actions fréquentes.
- Langue et monnaie pilote : français, GNF entier, sans décimales.

Voir `DESIGN-SYSTEM.md` pour les règles d’usage, états et contraste.

## 4. Processus obligatoire

### Phase A — inventaire et architecture de l’information

Remettre les IDs d’écran, rôle, priorité, breakpoint, liens et dépendances; composants partagés; hypothèses et décisions ouvertes.

### Phase B — wireframes basse fidélité

Dessiner chaque écran et variante qui change réellement la structure. Faire apparaître hiérarchie et ordre de lecture, navigation, actions, champs/erreurs, décisions comparatives, états vide/chargement/erreur/succès/indisponible/hors ligne applicables, et adaptations mobile/desktop. Annoter la destination des actions principales. Les wireframes restent neutres, sans décoration de la palette finale.

**Revue de passage :** le responsable produit valide couverture, libellés et hiérarchie avant que l’agent verrouille le rendu haute fidélité. Les composants génériques peuvent avancer en parallèle.

### Phase C — prototype haute fidélité

Appliquer le système visuel aux écrans P0. Relier les écrans et donner un résultat visible cohérent à chaque action principale. Les données sont fictives, cohérentes et signalées « Démo ». Ne pas simuler un succès serveur, paiement, notification ou intégration réelle. Prévoir une réinitialisation si l’état local peut empêcher la revue.

### Phase D — revue

Présenter le résultat par surface et breakpoint, noter les écarts, écrans incomplets et décisions reportées. Compléter le rapport de fin en section 12.

## 5. Règles d’interface et de contenu

- Libellés français concrets et courts, sans jargon.
- Montants cohérents, ex. `25 000 GNF`, sans décimales.
- Label visible pour chaque champ; un placeholder ne suffit jamais.
- États repos, focus, actif, chargement, désactivé et résultat selon pertinence.
- Une action n’est réussie qu’après retour serveur ou simulation clairement indiquée.
- Conserver les saisies valides après erreur et expliquer comment corriger.
- Confirmer les actions destructives et en décrire l’effet.
- Ne pas transmettre un état par couleur seule; noms accessibles, textes et focus clavier.
- Données de restaurants, prix, images, notes et avis de démonstration signalés fictifs; ne pas créer de faux avis semblant authentiques.
- Les données personnelles sont limitées aux écrans et rôles qui en ont besoin; le CMS support masque téléphone et adresse par défaut.

## 6. Règles métier à dessiner

### Panier et commande

- Un panier contient les plats d’un seul restaurant. Tenter d’ajouter depuis un autre ouvre le choix explicite « Remplacer le panier » ou « Revenir ».
- Avant l’envoi, distinguer le sous-total, frais connus et frais à confirmer.
- Après envoi, préciser que la demande attend la décision du restaurant et n’est ni acceptée ni payée.
- Utiliser un lien de suivi opaque; ne pas exposer téléphone/adresse publiquement.

### Proposition révisée — séquence impérative

1. Le restaurant soumet une proposition changeant total, frais ou conditions de livraison.
2. La commande affiche **Accord du client requis**. L’action **Préparer** est absente ou désactivée avec explication.
3. Le client voit côte à côte **Votre demande** et **Nouvelle proposition**, frais détaillés, nouveau total, délai/zone/mode concernés et échéance si définie.
4. Aucun choix n’est présélectionné. Deux actions explicites : **Accepter la nouvelle proposition** et **Refuser et annuler**.
5. Seule l’acceptation explicite de la version active débloque l’état accepté et la préparation.
6. Refus, expiration ou remplacement interdisent l’acceptation de l’ancienne version; expliquer l’état.
7. La console restaurant reste bloquée jusqu’à une réponse client valide.

Ne pas inventer une échéance ni les champs modifiables qui restent à décider.

### PWA et réseau

- Le site fonctionne sans installation; installer la PWA reste facultatif.
- Hors connexion, expliquer clairement que menus, suivi, commandes et gestion ne sont pas actualisés/disponibles.
- Ne jamais afficher une commande comme transmise sans reçu serveur.
- Le prototype peut présenter un écran hors ligne, sans prétendre implémenter cache ou service worker.

## 7. Inventaire des écrans

**P0** : essentiel MVP. **P1** : nécessaire à l’exploitation complète. Les écrans indiqués mobile + desktop adaptent réellement structure et navigation.

### A. Portail client

| ID | Écran / variantes | Priorité | Contenu et actions clés |
|---|---|---:|---|
| PUB-01 | Accueil/découverte, mobile + desktop | P0 | Recherche, quartier, catégories, vedettes, disponibilité, panier, installation discrète |
| PUB-02 | Résultats, mobile + desktop | P0 | Requête, filtres catégorie/quartier/ouvert, cartes, aucun résultat, réinitialiser |
| PUB-03 | Fiche restaurant, mobile + desktop | P0 | Couverture, nom, cuisine, zone, horaires, ouvert/fermé, consignes, menu |
| PUB-04 | Menu/détail plat, mobile + desktop | P0 | Sections, description, prix, indisponibilité, options définies, ajouter |
| PUB-05 | Panier, mobile + desktop | P0 | Restaurant, lignes/quantités, sous-total, frais connus/à confirmer, modifier |
| PUB-06 | Conflit de panier multi-restaurant | P0 | Choisir remplacer ou revenir; aucun effacement implicite |
| PUB-07 | Coordonnées et mode, mobile + desktop | P0 | Nom, téléphone, retrait/livraison, adresse conditionnelle, frais connus |
| PUB-08 | Résumé avant envoi | P0 | Articles, mode, ventilation, incertitudes et action d’envoi |
| PUB-09 | Envoi/échec/réessai | P0 | Anti-double-clic, erreur réseau, saisies préservées, réessai |
| PUB-10 | Demande reçue | P0 | Référence, attente, lien suivi, non confirmée/non payée |
| PUB-11 | Suivi normal | P0 | Attente, accepté, refusé, préparation, prêt, terminé; données masquées |
| PUB-12 | Suivi avec proposition modifiée | P0 | Comparatif, frais, total, conditions, échéance, deux choix explicites |
| PUB-13 | Proposition expirée/remplacée | P1 | Statut, explication, action permise |
| PUB-14 | Hors connexion/erreur/maintenance | P1 | Cause, limites, réessayer/revenir |
| PUB-15 | Aide/FAQ publique | P1 | Commande, confirmation, frais, rôle du restaurant |

### B. Console restaurant

| ID | Écran / variantes | Priorité | Contenu et actions clés |
|---|---|---:|---|
| RES-01 | Connexion/invitation/accès refusé | P0 | Connexion simple, invitation, accès non autorisé |
| RES-02 | Accueil opérationnel, mobile + desktop | P0 | À traiter en premier, actions rapides menu/disponibilité/fermeture |
| RES-03 | File « À traiter », mobile + desktop | P0 | Commande, heure, plats, mode, total, actions valides |
| RES-04 | Détail commande | P0 | Détails nécessaires, lignes figées, conditions, actions permises |
| RES-05 | Accepter une commande | P0 | Confirmation de prise en charge; chargement/succès/échec |
| RES-06 | Refuser une commande | P0 | Motif si défini, conséquence, confirmation |
| RES-07 | Proposer une modification | P0 | Champs permis, aperçu, ventilation, message |
| RES-08 | Attente d’accord client | P0 | Badge dédié, proposition active, préparation bloquée |
| RES-09 | Préparation/prête/terminée | P0 | Actions selon statut, historique, transitions valides |
| RES-10 | Historique, mobile + desktop | P1 | Consultation, filtres retenus, état vide |
| RES-11 | Liste du menu, mobile + desktop | P0 | Sections, prix, disponibilité rapide, ajouter/modifier |
| RES-12 | Créer/modifier un plat | P0 | Nom, description, prix GNF, section, image si retenue, validation |
| RES-13 | Horaires | P0 | Horaires par jour, fermeture temporaire, aperçu |
| RES-14 | Profil établissement | P0 | Nom, description, zone, contact, consignes, statut |
| RES-15 | Membres et rôles | P1 | Membres et droits selon matrice décidée |
| RES-16 | Aide et états système | P1 | Aide, réseau, session expirée, erreur, vide, chargement |

Depuis l’accueil, accepter/refuser, rendre un plat indisponible et fermer temporairement doivent demander au plus deux actions, hors confirmation métier nécessaire.

### C. CMS système

| ID | Écran / variantes | Priorité | Contenu et actions clés |
|---|---|---:|---|
| SYS-01 | Connexion CMS/accès refusé | P0 | Accès réservé, erreurs sans fuite d’information |
| SYS-02 | Tableau de bord, desktop + mobile critique | P0 | Indicateurs utiles, éléments à traiter, raccourcis permis |
| SYS-03 | Restaurants, desktop + mobile | P0 | Recherche, filtres statut/zone, tableau ou cartes, vide |
| SYS-04 | Fiche restaurant | P0 | Profil, menu, complétude, historique, aperçu, actions permises |
| SYS-05 | Revue d’un restaurant en attente | P0 | Contrôles, publier/demander correction selon règles, motif |
| SYS-06 | Catégories/quartiers/tags | P1 | Liste et opérations autorisées |
| SYS-07 | Mise en avant/contenu éditorial | P1 | Sélection, période si décidée, aperçu, brouillon/publié |
| SYS-08 | Pages/FAQ/bannières | P1 | Éditeur, aperçu, publication |
| SYS-09 | Recherche commande support | P0 | Recherche limitée, PII masquées par défaut |
| SYS-10 | Consultation exceptionnelle de PII | P1 | Permission, motif, affichage limité, audit |
| SYS-11 | Utilisateurs/rôles système | P0 | Attribution contrôlée, moindre privilège, confirmation, audit |
| SYS-12 | Journal d’audit | P1 | Auteur, date, cible, action, motif; aucun secret |
| SYS-13 | Paramètres autorisés | P1 | Seulement options décidées, impacts et contrôle d’accès |
| SYS-14 | États transverses CMS | P0 | Chargement, vide, erreur, succès, interdit, session expirée |

Ne pas inventer les permissions de publication, archivage ou support; appliquer la matrice du TDR et signaler les zones à décider.

## 8. États à représenter

Pour les écrans concernés, fournir contenu normal, chargement, vide avec prochaine action, erreur de validation, erreur réseau/serveur, indisponibilité, accès refusé, succès confirmé, désactivé avec explication et hors ligne. Les états peuvent être des variantes d’un composant, mais doivent être consultables dans les maquettes ou le prototype.

## 9. Système des livrables

### 9.1 Carte de parcours

Carte par rôle reliant les IDs d’écran avec les branches principales, erreurs et reprises, notamment les décisions de commande et consentement.

### 9.2 Planches wireframe

- Client : mobile de référence 390 px et desktop 1440 px.
- Restaurant : mobile 390 px et desktop 1440 px.
- CMS : desktop 1440 px et adaptation mobile des tâches urgentes/support.

Tailles indicatives; dessiner l’adaptation de navigation et de hiérarchie, pas une simple réduction.

### 9.3 Bibliothèque de composants

Présenter les boutons; champs, téléphone, recherche, sélecteurs, interrupteurs et cases; cartes restaurant/plat/commande; ligne de panier; badges; navigations; modale/feuille mobile; bannière/toast; tables si utiles; skeleton, vide, erreur, confirmation, hors ligne; comparatif demande/proposition; focus, loading, disabled et validation.

### 9.4 Prototype haute fidélité

- Tous les écrans P0 sont accessibles depuis une navigation cohérente.
- Les parcours principaux sont jouables sans relire cette spécification.
- Interactions testables au clavier et au tactile.
- Mobile/desktop ont des hiérarchies adaptées.
- Données cohérentes marquées « Démo »; intégrations absentes clairement simulées.
- Action de réinitialisation si un état local bloque la revue.
- P1 navigables ou annotés comme reportés, avec limites visibles.

## 10. Scénarios de revue

A. **Commande normale :** accueil → recherche → fiche → menu → panier → informations → envoi → reçu → suivi → accepté → préparation → prêt → terminé.  
B. **Autre restaurant :** ajout → autre fiche → tentative d’ajout → remplacer/revenir → vérifier panier.  
C. **Proposition modifiée :** restaurant propose → préparation bloquée → client compare → accepte explicitement → préparation accessible.  
D. **Refus/expiration :** refus ou état expiré/remplacé → clôture conforme → aucune préparation.  
E. **Réseau :** remplir → échec d’envoi → aucune fausse confirmation → réessai visible.  
F. **Tâches restaurant :** connexion → commande → plat indisponible → fermeture temporaire → réouverture.  
G. **CMS/permissions :** rechercher/traiter selon rôle → support avec PII masquées → accès exceptionnel avec motif → audit.

## 11. Organisation des livrables dans le dépôt

Adapter aux conventions existantes sans créer une application parallèle inutile. Livrer des artefacts identifiables, par exemple :

- `docs/frontend/SCREEN-INVENTORY.md` : IDs, rôle, priorité, breakpoint, dépendances.
- `docs/frontend/FLOW-MAP.md` : parcours par ID.
- `docs/frontend/WIREFRAMES.md` ou équivalent : wireframes annotés et états.
- `docs/frontend/PROTOTYPE-REVIEW.md` : couverture, résultats, décisions ouvertes.
- composants cohérents avec la pile et données de démo centralisées.

Si l’équipe utilise un outil externe, conserver IDs, variantes et annotations. À défaut d’accès, produire des wireframes HTML/SVG ou autres fichiers maintenables dans le dépôt et le signaler.

## 12. Acceptation et rapport de fin

Le propriétaire accepte lorsque :

1. Chaque écran a le statut maquette, prototype ou reporté avec raison.
2. Scénarios A–G couverts et cohérents.
3. Les wireframes précèdent la haute fidélité et ont été revus.
4. Tous les P0 ont des versions mobile et desktop adaptées.
5. Toute révision frais/conditions exige l’accord explicite du client avant confirmation/préparation.
6. Les trois surfaces partagent l’identité visuelle mais restent adaptées à leur rôle.
7. Les couleurs, polices, icônes et composants validés sont appliqués.
8. États pertinents et accessibilité clavier/tactile sont représentés.
9. Démo, données fictives et fonctions simulées ne sont pas confondues avec la production.
10. Décisions ouvertes et écarts sont documentés; aucun choix métier non validé n’est présenté comme acquis.

Rapport final de l’agent : chemins des livrables; nombre d’écrans par surface/priorité/breakpoint; résultats A–G; composants/états couverts; simulations et limites; décisions demandant le propriétaire; écarts visuels; vérifications réellement faites.

## 13. Hors périmètre

Sans attribution distincte, ne pas connecter paiement, WhatsApp/SMS ou livraison; ne pas revendiquer de persistance serveur; ne pas implémenter backend, autorisations ou migrations; ne pas ajouter panier multi-restaurant, avis publics ou recommandation algorithmique; ne pas inventer frais, échéances, permissions ou substitutions; ne pas exposer les données personnelles; ne pas déclarer un prototype prêt pour la production.
