# Parcours cible du pilote Speedfood — du premier écran au retour client

> **Note de réconciliation (dépôt).** Ce document parle de « la démo » / du prototype HTML (`index.html`, `app.js`, `localStorage`), hors de ce dépôt. L'application réelle (Next.js + Supabase, en production) est plus avancée : voir `../STATUT-PROJET.md`. Les recommandations d'outillage et de parcours restent valables comme cibles ; les mentions « si la migration vers React/Next.js est approuvée » sont déjà réalisées (Next.js 16, React).

**Version :** 1.0 — 3 octobre 2026  
**Rôle principal :** client/gourmet sur téléphone  
**Compléments :** `PARCOURS-UTILISATEUR.md`, `FRONTEND-DESIGN-BRIEF.md`, `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md`

## 1. Point de départ : faire évoluer la démo existante

Speedfood possède déjà une démo web interactive. Elle comprend une page d’accueil avec recherche et catégories, des cartes restaurant, une fenêtre de menu, un panier, un formulaire client, ainsi qu’un espace restaurant de démonstration. Les données sont fictives et les actions utilisent `localStorage` dans le navigateur : elles ne créent pas de vrai compte, ne partagent pas les commandes avec un restaurant et ne prouvent pas une disponibilité.

La réalisation du pilote doit **faire évoluer cette base de conception**, préserver les choix visuels et interactions compréhensibles, puis connecter progressivement les fonctions réelles. Elle ne doit ni présenter l’espace restaurant de la démo comme une console réelle, ni faire croire que les avis, notes, délais, disponibilité, commandes ou communications sont vérifiés. Avant d’implémenter, l’agent doit relever ce qui fonctionne et ce qui est fictif; il propose les changements d’interface utiles puis les applique sans jeter des composants réutilisables par défaut.

### Éléments de la démo à reprendre ou corriger

- Reprendre l’accueil, recherche par plat/restaurant, choix de zone, catégories, cartes, fenêtre de menu, panier et messages d’action comme base visuelle.
- Remplacer les notes/avis, délais et tags de démonstration par des données validées ou des labels éditoriaux honnêtes; ne pas garder de faux avis en production.
- Rendre le panier strictement mono-restaurant : en cas de plat d’un autre établissement, proposer « Vider le panier et continuer » ou « Garder mon panier »; aucune suppression implicite.
- Garder un prix affiché comme prix restaurant; afficher séparément les frais inconnus et le fait que disponibilité, frais et commande doivent être confirmés.
- Ne jamais stocker un vrai numéro, une adresse, un compte ou une commande pilote dans `localStorage` comme système d’autorité; la base serveur est la source de vérité.
- La démo permet de passer une commande et la voit dans le tableau restaurant du même navigateur. C’est une simulation uniquement, à remplacer par persistance serveur, autorisations restaurant et suivi protégé.

## 2. Résultat à obtenir

Un nouveau visiteur doit pouvoir **trouver un repas, savoir pourquoi un résultat lui est proposé et choisir comment contacter/commander**, avec peu de saisie et sans obligation de créer un compte. Le restaurateur doit pouvoir publier sa page, maintenir ses horaires et disponibilités sans vocabulaire technique.

« Captivant » signifie ici : découverte visuelle, pertinence locale, informations dignes de confiance et retour utile. Ne pas chercher à créer une dépendance avec défilement infini, notifications insistantes, pression artificielle, compteurs inventés, récompenses trompeuses ou obstacles à la sortie.

## 3. Parcours client P0

### Étape 0 — Entrée par un lien partagé

**Entrées :** page d’accueil, page restaurant, plat partagé, QR code ou lien dans WhatsApp. Chaque URL conduit au contenu voulu et conserve Speedfood visiblement dans l’en-tête, le titre de page et l’aperçu de partage.

**Écran :** accueil de découverte.

**Actions visibles :** rechercher un plat/restaurant; choisir un quartier; ouvrir « Disponible maintenant »; consulter les catégories; voir une sélection éditoriale explicitement identifiée.

**Règles :** la consultation est sans compte. La permission GPS n’est pas demandée au chargement de la page.

### Étape 1 — Dire ce que l’on cherche

**Écran :** champ de recherche avec texte concret, par exemple « Un plat, un restaurant… », et choix de zone « Choisir un quartier ».

**Entrées acceptées :** nom de plat, catégorie, type de cuisine ou restaurant. Suggestions de termes/catégories seulement si le référentiel existe.

**Zone :** le client peut sélectionner un quartier/repère ou appuyer sur « Utiliser ma position ». Le refus de localisation ne bloque pas la suite.

**Retour immédiat :** montrer les filtres disponibles et une requête conservée si le client revient de la fiche restaurant.

### Étape 2 — Choisir rapidement un résultat

**Écran :** résultats avec filtres en capsules : « Ouvert maintenant », « Accepte les commandes », « Disponible », « Quartier », « Budget » si les prix permettent ce filtre.

**Chaque carte montre :** photo authentique ou placeholder explicitement neutre, nom, spécialité, quartier, prix indicatif si vérifié, état ouvert/fermé, état de prise de commandes, disponibilité et heure de la confirmation. La distance est indicative et apparaît seulement si des coordonnées fiables existent.

**Ordre d’affichage :** (1) article exact et récemment confirmé; (2) article exact mais confirmation périmée; (3) équivalent déclaré/validé; (4) autres suggestions. À l’intérieur d’un groupe, appliquer le score explicable décrit dans la spécification pilote.

**États :** chargement court, erreur avec réessai, aucun résultat avec élargissement de quartier/terme, GPS refusé, résultat indisponible, ouverture inconnue, restaurant en pause. Aucune page blanche.

### Étape 3 — Vérifier le restaurant et le plat

**Écran :** vitrine restaurant avec plat/photo, informations utiles en haut, menu sectionné et badges textuels.

Le client peut comprendre d’un coup d’œil :

- où se trouve l’établissement (quartier/repère);
- si le restaurant est ouvert;
- s’il prend des commandes maintenant;
- si le plat est disponible ou à confirmer;
- quand cette information a été mise à jour;
- le prix, le service proposé et comment demander confirmation.

Le client peut ajouter un plat, partager la page Speedfood ou ouvrir WhatsApp. Ces choix sont lisibles et distincts; WhatsApp n’est jamais le seul chemin proposé.

### Étape 4 — Ajouter sans surprise

**Action :** « Ajouter au panier ».

**Retour :** compteur mis à jour, message bref (« Ajouté au panier ») et accès panier; conserver la recherche et la position de défilement si le client ferme le menu.

**Article épuisé :** désactiver l’ajout, montrer « Épuisé » + heure de mise à jour et proposer « Trouver ailleurs » avec les groupes d’alternatives. Ne pas substituer automatiquement.

**Changement de restaurant :** si un panier existe, proposer clairement de le remplacer ou de revenir. Le choix « revenir » préserve panier et recherche.

### Étape 5 — Vérifier le panier

**Écran :** récapitulatif d’un seul restaurant, quantités, prix, sous-total, frais connus ou « à confirmer », bouton modifier/supprimer chaque ligne.

La somme est calculée par le serveur au moment de créer la demande. Les montants du navigateur ne sont pas une preuve ni une source d’autorité. Si les articles ont changé ou sont périmés, afficher l’état et demander au client de confirmer le panier actualisé avant envoi.

### Étape 6 — Choisir le mode de contact/service

Le client choisit entre les moyens que le restaurant a réellement activés :

- **Envoyer une demande via Speedfood** : saisir le minimum nécessaire, typiquement nom et téléphone; adresse demandée seulement si livraison demandée. Demander à se connecter n’est pas nécessaire pour cette commande invitée.
- **Contacter le restaurant sur WhatsApp** : ouvrir une conversation avec un texte prérempli qui mentionne Speedfood et les articles. Le client vérifie puis envoie lui-même; l’écran explique qu’aucun suivi de la commande n’est alors synchronisé avec Speedfood.
- **Retrait** ou **livraison à confirmer** selon capacités déclarées. Ne pas inventer de délai ou de frais. Une proposition modifiant prix/frais/conditions attend l’accord explicite du client.

Un restaurant peut n’offrir qu’un des parcours; afficher seulement ce qui a été configuré. Ne pas créer de voie de commande qui serait invisible pour le restaurant.

### Étape 7 — Envoyer la demande ou ouvrir WhatsApp

**Pour une demande Speedfood :** résumé final, total indicatif, informations à confirmer, bouton explicite « Envoyer ma demande ». Désactiver le double-envoi visuel pendant la requête; conserver les champs si réseau en échec; ne montrer « Demande envoyée » qu’après accusé serveur.

**Après envoi :** créer une référence et un lien de suivi protégé non séquentiel/non devinable; afficher « En attente de confirmation du restaurant », sans dire « commande confirmée », « payée » ou « en livraison ».

**Pour WhatsApp :** pas de confirmation d’envoi par Speedfood. Au retour dans le navigateur, revenir à la fiche Speedfood et afficher le restaurant/plat; ne pas inventer de statut.

### Étape 8 — Suivre et répondre

La page de suivi protégée indique les transitions serveur : demande reçue, acceptée, en préparation, prête, terminée, refusée ou annulée.

Si le restaurant change un prix, frais ou condition, montrer côte à côte la demande initiale et la nouvelle proposition, détailler les frais et proposer uniquement deux choix clairs : « Accepter la nouvelle proposition » et « Refuser et annuler ». La préparation reste impossible avant accord sur la proposition active.

Une rupture après envoi offre un état honnête et une action choisie par le client pour voir des alternatives ou contacter le restaurant. Aucun plat alternatif n’est ajouté d’office.

### Étape 9 — Terminer proprement et donner envie de revenir

Après la clôture, montrer le résultat, les informations utiles et les autres restaurants/menus de la zone. Proposer, sans pression, de suivre ou enregistrer le restaurant; création de compte Google/téléphone facultative. Proposer un retour simple seulement après une expérience réelle. Ne pas demander une note avant que l’action soit terminée.

Pour les comptes connectés : liste des restaurants suivis, plats récents, préférences facultatives et accès aux commandes liées. Le client peut enlever un favori, modifier les préférences ou supprimer son compte.

## 4. Parcours restaurateur P0

1. Depuis le portail, choisir « Inscrire mon restaurant ».
2. Créer/se connecter au compte (Google ou téléphone vérifié si actif); expliquer les étapes et les informations nécessaires.
3. Renseigner nom, quartier/repère, contact, horaires et type de service.
4. Créer un premier menu avec nom/prix/description courte et statut disponible; offrir une aide d’import/saisie manuelle par Speedfood durant le pilote.
5. Ajouter une photo facultative et confirmer le droit de la publier.
6. Prévisualiser une vraie page mobile avec URL Speedfood.
7. Soumettre; état « En vérification » jusqu’à la validation manuelle initiale.
8. À la publication, ouvrir la console avec trois actions proéminentes : ouvert/fermé, commandes actives/en pause, modifier disponibilité.
9. Générer lien de page et visuel/QR partageable; guider le premier partage WhatsApp.
10. La console présente actions restantes, demandes reçues et statistiques avec définitions sans suggérer qu’un clic équivaut à une vente.

**Réduction de friction :** sauvegarder le brouillon, permettre de quitter/reprendre, montrer une étape à la fois, signaler les champs obligatoires, proposer des valeurs préremplies uniquement si fiables et offrir le contact du support. Ne pas exiger photo ou géolocalisation exacte pour achever la création.

## 5. Rituels utiles et popularité sans pièges

Créer une raison honnête de revenir : menu du jour réellement mis à jour, nouveautés des restaurants suivis, sélection Speedfood hebdomadaire, recherche par quartier et alternatives fiables. Favoris/suivi sont opt-in. Les notifications éventuelles sont P1, consenties, limitées et faciles à couper; pas de push au premier chargement.

Les restaurants participent à la diffusion en partageant des pages Speedfood, menus et QR. Ces pages renvoient vers le portail et portent la marque Speedfood. Les sélections éditoriales ont une explication et une date; les annonces commerciales futures sont étiquetées.

## 6. Parcours de secours obligatoires

- aucune connexion : message clair, garder saisies et proposer réessai;
- restaurant ferme/pausse après affichage : expliquer, rafraîchir et proposer alternatives;
- disponibilité obsolète : demander confirmation, pas de promesse;
- SMS non reçu : attente/réessai limité, autre méthode et aide; ne pas révéler si un numéro est enregistré;
- GPS refusé ou non supporté : saisie manuelle de quartier;
- photo inaccessible : afficher le contenu textuel;
- utilisateur navigue en arrière : conserver panier et recherche dans des limites sûres;
- page ou restaurant retiré : expliquer et renvoyer au catalogue;
- mise à jour prix/frais/conditions : consentement explicite requis, aucun démarrage de préparation;
- WhatsApp non installé : proposer copie du lien/message ou coordonnées si autorisées, sans fausse erreur.

## 7. Critères d’ergonomie à observer en pilote

Avec de vrais participants, mesurer la capacité à :

1. trouver un plat donné et comprendre pourquoi un restaurant apparaît;
2. trouver une alternative après une rupture;
3. identifier l’état « ouvert », « commandes acceptées » et « disponible »;
4. partager une page sur WhatsApp puis revenir reconnaître Speedfood;
5. envoyer une demande sans créer de compte;
6. marquer un plat indisponible depuis la console restaurant.

Observer hésitations, demandes d’aide, erreurs et abandon. Fixer les seuils de réussite après les premiers essais; ne pas déclarer l’UX « parfaitement aboutie » sans retour d’utilisateurs réels.

## 8. Indicateurs de parcours

Suivre le passage : accueil → recherche → résultat → fiche → panier ou WhatsApp → demande réelle → réponse restaurant → fin. Séparer clic WhatsApp, demande Speedfood, commande acceptée et commande terminée. Mesurer temps jusqu’au premier résultat utile, recherches sans résultat, disponibilité périmée, abandon par étape et retour volontaire. Collecte minimale, sans enregistrer le contenu des messages ou position précise par défaut.

## 9. Séquence de conception pour les agents

1. Examiner la démo actuelle et identifier composants réutilisables, actions simulées, contenu fictif et écarts au parcours cible.
2. Remettre une carte de parcours et wireframes avec toutes les branches ci-dessus.
3. Mettre à jour le prototype existant pour refléter précisément le parcours, avec un badge de démo sur les fonctions non connectées.
4. Faire une revue produit et un test de compréhension sur téléphone avant d’intégrer backend et données réelles.
5. Connecter ensuite les écrans approuvés aux contrats serveur; conserver les états d’erreur et de chargement.
6. Obtenir des retours de restaurants et clients pilotes, puis ajuster friction et priorités.

Ne pas remplacer le site existant par un nouveau shell sans inspection et justification. Une amélioration du prototype ne signifie pas qu’elle est déjà déployée sur le domaine public.
