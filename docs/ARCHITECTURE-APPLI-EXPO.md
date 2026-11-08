# Architecture de l’appli Expo — référence du 8 novembre 2026

Code de référence : `57f80f1`. Voir la [passation principale](PASSATION-CHANTIER-SPEEDFOOD-APP.md) pour les preuves et les autorisations. Ce document décrit le code, pas la version actuellement servie par Cloudflare.

## Organisation et dépendances

| Dossier | Responsabilité |
|---|---|
| `apps/mobile` | Nouveau client Expo Android/iOS |
| `apps/api` | API Hono / Worker `speedfood-api` |
| `apps/web` | Site Next.js / Worker `speedfood-app`, services métier réutilisés par l’API |
| `packages/shared` | Contrats partagés et validations |
| `mobile` | Ancien client Kotlin, toujours distribué |
| `supabase/migrations` | Historique du schéma et des protections de la base |

Versions déclarées : Expo ~57.0.31, React Native 0.86.3, React 19.2.3 ; site Next.js 16.3.8 ; Hono 4.13.14. Installation npm à la racine, verrou unique. La CI utilise Node 22. Ne pas mettre à niveau ces dépendances pendant une reprise fonctionnelle sans lot séparé.

## Entrée réelle et démonstrateur

L’entrée [src/app/_layout.tsx](../apps/mobile/src/app/_layout.tsx) monte `CatalogueReel`, les fournisseurs visuels et la bannière de mise à jour. Les parcours réels ouvrent des panneaux/modales. Les anciennes routes de démonstration et leur état ne décrivent pas le parcours actuellement monté.

Le catalogue appelle directement l’API unique, sans repli automatique vers le site. Kotlin appelle encore le site et son relais. Une panne API doit rester visible : ne pas la masquer par des données fictives. Le panier réel et le stockage de démonstration sont distincts ; ne pas fusionner leurs bases.

## Carte des modules

Les chemins ci-dessous sont relatifs à `apps/mobile/src/`.

| Zone | Fichiers d’entrée | Comportement et garde-fous |
|---|---|---|
| Catalogue | `catalogue/client.ts`, `catalogue/CatalogueReel.tsx` | Restaurants, menus, quartiers ; lectures publiques ; pagination et erreurs visibles |
| Panier | `stockage/panier-reel-depot.ts`, `stockage/panier-reel-session.ts` | Identifiants et quantités conservés localement ; prix relus, puis recalculés côté serveur |
| Création | `catalogue/envoi-commande.ts` | Un envoi à la fois ; résultat incertain conservé ; clé d’idempotence liée à la tentative et au compte |
| Connexion | `connexion/client.ts`, `connexion/session.ts`, `connexion/gestion.ts`, `connexion/coffre.ts` | Compte existant ; accès en mémoire ; renouvellement dans SecureStore natif, jamais dans SQLite |
| Compte | `connexion/CompteReel.tsx`, `connexion/commandes.ts` | Historique limité aux 50 dernières commandes ; clés de suivi privées, exclues des données affichées |
| Paiement et suivi | `connexion/ReglementReel.tsx`, `connexion/reglement.ts` | Lecture de l’état, actions selon contrat ; résultat ambigu bloqué jusqu’à une relecture concluante |
| Restaurateur | `connexion/RestaurateurReel.tsx`, `connexion/restaurateur.ts`, `connexion/ServiceMenuReel.tsx` | Commandes, transitions, règlement, propositions, service, menu/photos et livraison selon droits serveur |
| Notifications | `notifications/` et `connexion/ouverture-espace.ts` | Autorisation, enregistrement, retrait, ouverture et génération de session |
| Livreur G1 | `connexion/LivreurReel.tsx`, `connexion/lecture-fiche-livreur.ts`, `connexion/livreur.ts` | Fiche personnelle en lecture manuelle, sans offre/course/position |

Le client Expo exige une connexion pour créer une commande. Cela ne supprime pas le contrat de commande invitée du site. L’inscription et les connexions sociales natives restent à distinguer du compte existant.

## Écritures et incertitude réseau

Aucune file de commandes hors ligne ni relance automatique d’écriture. Après un résultat incertain de création, une reprise **manuelle du même corps avec la même clé** est possible selon la machine d’état ; ne jamais fabriquer une nouvelle clé pour contourner l’incertitude. Les autres actions doivent retrouver un état serveur fiable avant de proposer une nouvelle écriture. Un prix affiché n’est jamais une autorisation : le serveur recalcule les montants GNF entiers.

## API et partage du métier

[apps/api/src/app.ts](../apps/api/src/app.ts) monte les routes. L’API réutilise des services du site par alias ; le paquet Worker ne doit pas embarquer Next.js. Les contrôles de construction vérifient cette séparation et la taille. Les contrats mobiles appartiennent à `packages/shared/src/contracts`, avec adaptateurs côté site.

| Famille `/api/v1/` | Usage |
|---|---|
| `catalogue`, `connexion/configuration` | Lectures publiques du catalogue et configuration de connexion |
| `moi`, `client`, `commandes` | Profil/espace client et commandes authentifiées |
| `suivi` | POST racine = lecture avec clé dans le corps ; sous-actions = écritures |
| `appareils` | Enregistrer/retirer un appareil après authentification stricte |
| `restaurant` | Commandes/actions, service, réglages, menu/photo et livraison restaurateur |
| `livreur/fiche` | Nouvelle lecture G1, non mise en service par ce lot |

Ne pas ouvrir globalement CORS pour débloquer un essai natif. L’autorisation repose sur l’identité vérifiée et les contrôles serveur, jamais sur un identifiant de restaurant fourni par l’interface. L’API peut écrire des compteurs de limitation même lorsqu’une route métier est en lecture seule.

## Contrat G1 détaillé

[Contrat partagé](../packages/shared/src/contracts/livreur-fiche.ts), [route](../apps/api/src/routes/livreur.ts), [service](../apps/api/src/livreur/fiche.ts), [câblage RLS](../apps/api/src/livreur/cablage.ts).

`GET /api/v1/livreur/fiche` : porteur strict, plafond par compte (600 sur 300 secondes), client RLS et filtre explicite `utilisateur_id` égal à l’identité vérifiée. Un compte support ne doit pas choisir une autre fiche.

Réponse : `{ ok: true, fiche: null }` si aucune fiche ; sinon six champs : `nom`, `statut`, `vehicule`, `cycle`, `motifCycle`, `restaurantNom`. Authentification refusée : 401 ; plafond : 429 ; panne ou ligne invalide : erreur générique 500. Réponse non mise en cache. Ne pas convertir une panne en fiche absente.

Statuts : `hors_ligne`, `disponible`, `en_course`. Véhicules : `moto`, `velo`, `voiture`, `pied`. Cycles : `cree`, `invite`, `candidat`, `actif`, `suspendu`, `archive`. Nom non vide, au plus 80 caractères ; motif nullable au plus 300 ; restaurant nullable au plus 256. Les champs supplémentaires sont exclus. Aucun téléphone, GPS, invitation, document ni clé de suivi.

Une relation restaurant masquée donne un rattachement non renseigné, jamais une appartenance inventée au groupe Speedfood. Le contrôleur invalide les anciennes réponses après fermeture/changement de compte et regroupe les lectures simultanées. Le montage StrictMode recrée un contrôleur utilisable.

**Piège :** l’ancien GET livreur/etat peut faire avancer les offres et la simulation. Ne pas l’utiliser pour vérifier une fiche en lecture seule. Aucune migration nouvelle pour G1.

## Notifications et cycle de session

Sur Android, l’adaptateur récupère le jeton FCM natif ; sur iOS, getDevicePushTokenAsync fournit le jeton natif APNs. Le serveur actuel envoie par FCM, sans service Expo Push. Canaux : `suivi_commande`, `alerte_commande`, `offre_course`. La présence du troisième canal ne prouve pas un parcours livreur terminé. L’envoi serveur passe par `apps/web/src/lib/push/` et les transitions métier. Une permission active ne prouve pas que l’enregistrement serveur a réussi.

La génération reste stable lors du renouvellement de session. Une génération fermée ne se rouvre pas. Enregistrement, retrait et nouvelle session sont ordonnés ; aucun nouvel essai automatique après un résultat incertain. Un nouveau jeton pendant un envoi est mis en attente ; l’écho identique est ignoré. La déconnexion invalide les travaux avant les attentes réseau.

Sur iOS, ne pas supposer qu’un jeton natif APNs est utilisable par le serveur FCM : vérifier le type de jeton, l’adaptateur et le provisionnement sur un appareil physique avant de promettre les notifications iPhone. Une compilation simulateur ne ferme pas ce risque.

Le retrait dispose d’un budget de six secondes. Un abandon côté client n’annule pas une écriture déjà reçue par le serveur : le risque résiduel I2 est décrit dans le [registre](REGISTRE-CORRECTIONS-APPLI-EXPO.md).

Schéma concerné : migration `20261022170000_appareils_push.sql`. Les écritures utilisent le service serveur après authentification ; ne pas ajouter de politique RLS ou de SECURITY DEFINER sans lecture des contraintes et contrôle de sécurité. Les migrations livreur existantes sont à consulter avant toute évolution, sans les réappliquer aveuglément.

## Banc G1 isolé

[controle-livreur](../apps/mobile/controle-livreur/README.md) est un projet de contrôle séparé du graphe produit. Il utilise les vrais composant, contrôleur, session, parseur, route et service, avec coffre/base factices en mémoire. Les comptes A/B sont synthétiques. Il ne prouve ni la RLS réelle ni le réseau produit en production.

HTTP limité à 127.0.0.1:8797, chemins autorisés, redirections refusées et délai borné. React et react/* sont résolus depuis le mobile pour éviter deux copies. Aucun changement du Metro produit. Les tests et les 12 mutations vérifient notamment la fuite de fiche, les réponses tardives, les pannes et ce réglage Metro. Voir le [rapport G1](CONTROLE-FICHE-LIVREUR-EXPO-2026-11-07.md).
