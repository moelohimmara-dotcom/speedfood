# Notifications, icônes et outils d’interface — Speedfood

> **Note de réconciliation (dépôt).** Ce document parle de « la démo » / du prototype HTML (`index.html`, `app.js`, `localStorage`), hors de ce dépôt. L'application réelle (Next.js + Supabase, en production) est plus avancée : voir `../STATUT-PROJET.md`. Les recommandations d'outillage et de parcours restent valables comme cibles ; les mentions « si la migration vers React/Next.js est approuvée » sont déjà réalisées (Next.js 16, React).

**Version :** 1.0 — 3 octobre 2026  
**Portée :** interface de démonstration existante et préparation du pilote réel.

## 1. Règle de départ

La démo Speedfood contient déjà un toast visuel dans la page et une icône de panier avec compteur. Il faut améliorer ces éléments dans l’interface existante, sans empiler d’emblée plusieurs services externes. Une notification n’est pas un statut métier : une commande confirmée, une disponibilité ou un changement de frais doit venir de la source serveur, pas de l’animation d’une fenêtre.

## 2. Les différents types de notification

### 2.1 Toast dans l’application

Petit message non bloquant près du bas de l’écran, qui disparaît après quelques secondes. Usage : « Plat ajouté au panier », « Page copiée », « Disponibilité mise à jour ». En cas d’erreur, le message reste assez longtemps et fournit une action si utile (« Réessayer »). Les retours importants restent aussi visibles dans la page ou le formulaire; le toast seul ne doit pas porter une erreur irréversible.

**Outil recommandé maintenant :** garder et améliorer le composant `#toast` déjà présent dans la démo. Il répond au besoin sans nouvelle dépendance. Si une nouvelle interface React est réellement adoptée, `Sonner` est une option courante pour les toasts; la bibliothèque doit rester remplaçable et suivre les conventions du dépôt.

### 2.2 Fenêtre de confirmation

Dialogue/modal seulement pour une décision réellement importante : remplacer le panier par un autre restaurant, refuser/annuler une demande, accepter une modification de total ou de livraison. Pas de popup promotionnelle à chaque arrivée. Le focus clavier est géré, fermeture accessible et aucune action n’est préchoisie.

**Outil recommandé si React :** composant Dialog de Radix UI, directement ou via shadcn/ui si cette bibliothèque est retenue après inspection. Dans la démo HTML actuelle, garder une implémentation accessible et légère plutôt que migrer juste pour une modal.

### 2.3 Centre de notifications dans Speedfood

Une cloche discrète ouvre une liste des notifications importantes non lues et récentes, avec date, texte clair, destination et action « Tout marquer comme lu ». Le centre est la mémoire durable; un toast ou push n’est qu’un signal. Il peut être P1 après validation du pilote, sauf besoin de suivre commandes authentifiées.

Exemples : statut d’une commande liée au compte; restaurant suivi qui publie son menu du jour si l’utilisateur a activé ces alertes; alerte de support dans la console. Ne pas conserver de données sensibles dans les aperçus.

### 2.4 Push navigateur/PWA

La notification push apparaît hors de la page et peut fonctionner lorsque celle-ci est en arrière-plan. Elle nécessite HTTPS, un Service Worker, une autorisation utilisateur, une souscription enregistrée et un serveur capable d’envoyer des messages. L’autorisation doit être demandée après une action volontaire et dans son contexte (« Être averti quand une commande change »), jamais dans une popup automatique au premier chargement. Prévoir un écran préférences, révocation et désabonnement côté Speedfood.

La cible iOS a une contrainte particulière : les web push sont prévues pour les web apps ajoutées à l’écran d’accueil sur iOS/iPadOS 16.4 ou supérieur. Détecter la capacité et fournir un chemin de consultation dans Speedfood si Push n’est pas disponible. Les règles exactes de Safari et navigateurs peuvent évoluer; vérifier au moment de construire.

**Fournisseur candidat pour le pilote :** Firebase Cloud Messaging (FCM), car Cloud Messaging est listé sans frais par Firebase. Il ajoute toutefois une configuration Firebase, un Service Worker dédié, clés VAPID, stockage des abonnements et un envoi serveur autorisé; il ne remplace ni Supabase Auth ni la base de données ni les permissions Speedfood. Faire un petit essai technique après le MVP fonctionnel avant de le retenir. Une option Web Push standard auto-gérée est aussi possible, mais impose de maintenir génération, stockage, chiffrement et envoi des abonnements.

## 3. Politique des événements

| Événement | In-app | Push au pilote | Destinataire |
|---|---|---|---|
| Ajout panier/copie lien | Toast | Jamais | Personne d’autre |
| Demande client créée | Confirmation persistante | Optionnel si client a explicitement demandé un suivi | Client |
| Restaurant confirme/refuse | Suivi dans Speedfood + centre | Oui, si permission et commande liée au compte | Client |
| Restaurant propose un nouveau prix/frais/conditions | Alerte dans le suivi, exige décision | Oui, prioritaire si client a opt-in | Client |
| Nouvelle demande au restaurant | État urgent en console | Push souhaitable si le propriétaire l’a activé | Membres assignés du restaurant |
| Plat mis en rupture | État du menu | Pas de push généralisé | Visiteurs du menu; abonnés seulement si choix explicite |
| Nouveau menu d’un restaurant suivi | Centre/découverte | P1, seulement opt-in et fréquence limitée | Client abonné |
| Offre commerciale/promotion | Visuel dans le portail | Pas au pilote par défaut | Client ayant choisi cette catégorie |

Les changements de commande sont transactionnels; une push ne modifie jamais son état. Toujours dédupliquer, limiter les répétitions, offrir préférences par type, permettre de couper les messages promotionnels, respecter une plage calme configurable et éviter téléphone, adresse, montant ou plat sensible dans l’aperçu de notification.

## 4. Icônes et éléments gourmands

### Icônes fonctionnelles

Conserver les icônes d’interface SVG au trait arrondi et régulier déjà approuvées. Lucide est un bon jeu générique léger pour recherche, localisation, horloge, panier, cœur, partage, cloche, paramètres et statuts; la version React ne s’introduit que si l’application utilise effectivement React. Choisir les SVG nécessaires et garder une taille/grille/épaisseur cohérente; icônes décoratives accessibles en masquées aux lecteurs d’écran si le libellé voisin suffit.

### Collection Speedfood culinaire

Créer un petit jeu SVG propriétaire cohérent, avec contours doux et quelques accents rouge/orange/mangue, pour les éléments qu’un jeu standard ne rend pas distinctifs : marmite, bol de riz, brochette/flamme, bissap, plantain/alloco, piment, jus, plat couvert, cloche de service, menu du jour. Ce sont des illustrations d’accent ou catégories, pas des remplacements de photos de plats. Première collection limitée à 8–12 symboles et réutilisée dans catégories, états vides et visuels à partager.

Éviter les emoji dans navigation/boutons et les packs d’icônes de styles mélangés. Les catégories doivent aussi avoir un nom textuel, pour l’accessibilité et si l’image ne charge pas.

## 5. Choix d’outillage selon l’état du projet

### Dans la démo HTML/CSS/JS actuelle

- Aucun framework ou kit UI à installer par principe.
- Améliorer le toast existant et les fenêtres modales présentes.
- Icônes SVG en fichiers locaux/sprite, pas de police d’icônes ni de dépendance à un CDN externe.
- Pour les push, ne pas ajouter de code tant que les comptes, serveur, consentement, cas d’usage et essais d’appareils ne sont pas préparés.

### Si la migration vers l’architecture React/Next.js proposée est approuvée

- **Lucide React** pour les icônes fonctionnelles;
- **Radix UI** pour les primitives accessibles Dialog, Popover, Dropdown et Sheet, ou **shadcn/ui** comme base de composants si le dépôt adopte ce style;
- **Sonner** pour les notifications toast;
- **Zod** pour valider les formulaires/contrats côté serveur et réutiliser le schéma côté client sans considérer le contrôle client comme sécurité;
- **React Hook Form** uniquement si les formulaires multi-étapes deviennent complexes; sinon les formulaires natifs suffisent;
- **Web App Manifest + Service Worker** pour l’installation et les ressources statiques; Push API/FCM dans un lot distinct.

Ces choix sont des candidats, pas des autorisations d’ajouter les paquets. Les agents inspectent les dépendances existantes, vérifient documentation/licence/version, justifient coût et maintenance, puis utilisent une seule bibliothèque par besoin. Pas d’outil analytics ou de bibliothèque animation lourde pour un effet décoratif sans objectif mesurable.

## 6. Ordre de mise en œuvre

1. **Maintenant / démo :** harmoniser toasts, états d’erreur/succès, modal de panier et set d’icônes SVG alimentaires; aucun push.
2. **Pilote connecté :** notifications in-app liées aux événements serveur, surtout changement de commande; préférences minimum.
3. **Après opt-in d’utilisateurs pilotes :** prototype push sur les appareils et navigateurs ciblés, essais sur PWA iOS ajoutée à l’écran d’accueil, Android et ordinateur; mesurer réception et désabonnement.
4. **Après preuves d’usage :** centre d’activité et nouveautés de pages suivies; toute promotion push reste explicitement facultative.

## 7. Sources officielles

- [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN — utilisation de Notifications API et consentement après geste utilisateur](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)
- [Apple — envoyer des notifications Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Firebase — configuration FCM pour le Web](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Firebase — tarifs actuels](https://firebase.google.com/pricing)
- [Lucide — icône Utensils](https://lucide.dev/icons/utensils) et [licence](https://lucide.dev/license)
- [shadcn/ui — Sonner](https://ui.shadcn.com/docs/components/radix/sonner)
