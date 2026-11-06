# Notifications restaurateur Expo — design (5 novembre 2026)

Validé avec Malika (conceptrice et initiatrice de Speedfood, compte / identité projet `moelohimmara`) : choix d’autorisation **C**, sections 1 à 3 du dialogue de conception.

Ce document fixe le comportement. Le plan d’implémentation suit dans `docs/plans/2026-11-05-notifications-restaurateur-expo.md`. En cas de contradiction avec le code, le code et `docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md` gagnent : signaler, ne pas trancher en silence.

---

## 1. Objectif

Un membre de restaurant connecté dans l’appli Expo (`com.speedfood.clientdemo`) reçoit la notification push **« Nouvelle commande »** quand une commande arrive pour son établissement, et un appui ouvre l’**Espace restaurateur**.

Le serveur le fait déjà pour Kotlin. Ce lot aligne Expo sur le même socle, sans nouvel envoi serveur ni nouveau secret.

## 2. Périmètre

**Dans le lot**

- Canaux Android `alerte_commande` et `offre_course` (en plus de `suivi_commande` déjà créé).
- Autorisation **C** : déclenchée à la connexion / session rouverte si `GET /api/v1/moi` indique un rôle restaurateur, **et** à l’ouverture de « Espace restaurateur » ; **une seule** demande système (même drapeau appareil que le client).
- Routage d’appui : type `commande_nouvelle` → Espace restaurateur ; types client de suivi → Mon compte / suivi (inchangé).
- Messages d’état courts pour le rôle resto (accordé / désactivé).
- Tests unitaires + mutations ; essai réel émulateur (commande TEST, écriture barbie food seulement avec le « oui » de Malika).

**Hors lot**

- Espace livreur / équipe ; réaction à `course_offre` ou `equipe_commande` dans l’UI Expo.
- iPhone natif (APNs).
- Nouveau secret, nouveau projet Firebase, déploiement Worker sans feu vert.
- Remplacement de l’identifiant `com.speedfood.app`.

Le canal `offre_course` est **créé** (comme Kotlin) pour ne pas perdre les messages futurs ; ce lot **n’ouvre pas** l’écran livreur.

## 3. Rôle de Malika / `moelohimmara` (exceptions d’essai, pas de contournement)

Malika est la conceptrice et l’initiatrice du produit ; l’identité projet / comptes opérationnels liés à `moelohimmara` (Firebase, Cloudflare, dépôt, compte de test double rôle type `elohim`) lui appartiennent.

**Ce que cela autorise en essai**

- Utiliser le compte double rôle (client + membre barbie food) sur l’émulateur pour prouver client *et* restaurateur sur le même appareil / même jeton FCM.
- Décider seule des feux verts d’écriture TEST chez barbie food, des déploiements et des secrets.
- Saisir elle-même tout mot de passe ; aucun agent ne le saisit ni ne l’extrait.

**Ce que cela n’autorise jamais**

- Aucune exception dans le code de production : pas de liste blanche d’e-mails, pas de contournement RLS, pas de confiance en un `restaurantId` venu du client, pas de jeton d’appareil ou porteur dans les logs / commits / chat.
- L’affichage du bouton « Espace restaurateur » reste un confort lu via `/moi` ; **chaque** route restaurateur revérifie le droit côté serveur (règle déjà en vigueur).
- Une écriture TEST réelle = un « oui » explicite de Malika à ce moment-là.

## 4. Architecture (réutilisation)

| Couche | Rôle | Changement ce lot |
|---|---|---|
| Serveur `notifierRestaurantFcm` + textes `commande_nouvelle` / canal `alerte_commande` | Envoi FCM aux `restaurant_memberships` | Aucun |
| API `POST /api/v1/appareils` (+ retirer) | Enregistrement du jeton | Aucun |
| Table `appareils_push` | Un jeton par installation, rattaché au compte | Aucun |
| Expo `apps/mobile/src/notifications/` | Autorisation, canaux, enregistrement, ouverture | **Oui** |
| UI `CompteReel` / `CatalogueReel` | Déclencheurs C + ouverture espace | **Oui** |

Un seul jeton FCM par installation : le serveur choisit le texte et le `channel_id` selon le **type** d’événement. Le double rôle n’implique pas deux enregistrements.

## 5. Autorisation C (détail)

- **Drapeau unique** appareil (`speedfood.notifications.demandee.v1`) : partagé client / resto. Une demande système au plus.
- **Déclencheur 1 — session :** après connexion réussie ou restauration de session, si `moi().restaurateur !== null`, appeler la même machine à états que « après commande » (`demander` / `enregistrer` / `rien`).
- **Déclencheur 2 — ouverture Espace restaurateur :** même appel, juste avant ou au moment d’ouvrir le modal (échec silencieux : l’espace s’ouvre quand même).
- **Déclencheur client inchangé :** après la 1ʳᵉ commande réelle envoyée.
- Refus définitif : pas d’insistance ; l’actualisation manuelle reste.
- Au simple démarrage anonyme : **jamais** de demande. Après restauration de session et reconnaissance du rôle restaurateur, la demande unique est permise (choix C confirmé par Malika le 6 novembre 2026). Si déjà accordée : réenregistrement sans nouvelle demande.

## 6. Canaux Android

Au `demarrer()` du service (avant toute réception utile) :

| Id | Nom affiché | Importance |
|---|---|---|
| `suivi_commande` | Suivi de commande | HIGH (existant) |
| `alerte_commande` | Nouvelles commandes | HIGH |
| `offre_course` | Nouvelles courses | HIGH |

Aligné sur Kotlin (`FirebaseSpeedfood.kt`). Sans `alerte_commande`, une notif serveur peut être mal acheminée ou silencieuse sur Android 8+.

## 7. Appui sur une notification

Étendre la logique pure d’`ouverture.ts` :

- Liste blanche **suivi client** (inchangée) → `ouvrirSuivi()` (Mon compte).
- Liste blanche **resto** : au minimum `commande_nouvelle` → `ouvrirRestaurateur()`.
- Types hors listes → ignorés.
- Une même notification (même identifiant) traitée **une seule** fois (froid + écouteur).
- Si l’écran de commande est verrouillé (envoi / incertain) : différer comme aujourd’hui pour le suivi client ; pour le resto, même discipline si un verrou équivalent existe, sinon ouvrir seulement quand l’UI peut recevoir le modal.

L’écran principal branche deux callbacks (pas de routeur natif) : `brancherOuvertureSuivi` (existant) et `brancherOuvertureRestaurateur` (nouveau).

## 8. Messages d’état

| Situation | Message |
|---|---|
| Client, actives (existant) | Vous serez prévenu quand votre commande avance. |
| Client, désactivées (existant) | Notifications désactivées : ouvrez « Mon compte » puis actualisez pour suivre votre commande. |
| Resto, actives (nouveau) | Vous serez prévenu des nouvelles commandes. |
| Resto, désactivées (nouveau) | Notifications désactivées : ouvrez l’espace restaurateur et actualisez. |

Ne pas journaliser ni afficher de jeton.

## 9. Garde-fous (non négociables)

- Identifiant restaurant ou rôle venant du client ≠ autorisation ; le serveur tranche.
- Un seul essai réseau pour enregistrer / retirer l’appareil ; jamais de réessai automatique.
- Retrait à la déconnexion **avant** effacement de session ; échec silencieux.
- Aucune donnée client (nom, téléphone, montant, référence) dans le corps FCM : textes génériques serveur uniquement.
- Pas de déploiement / secret / écriture barbie food sans oui de Malika.
- Montants GNF entiers ailleurs ; sans objet ici.

## 10. Preuve de livraison

1. Tests `apps/mobile` + mutations ciblées ; `npx tsc --noEmit` ; racine `typecheck` selon impact.
2. Essai AVD `speedfood_pixel` (Play Store) : compte membre, autorisation via C, canaux présents, commande TEST (oui Malika) → notification « Nouvelle commande » / canal `alerte_commande` ; appui → Espace restaurateur.
3. Journal dans `docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md` et le plan F3.

## 11. Risques

- Secret `FCM_SERVICE_ACCOUNT` absent → envoi silencieux (preuve : émulateur + `appareils_push.derniere_reussite_le`).
- Émulateur : connexion Google parfois instable (leçon E3) ; mode avion on/off si besoin.
- Compte double rôle : deux familles de notifs sur un appareil — comportement voulu ; bien séparer les listes d’ouverture pour ne pas ouvrir le suivi client sur une alerte resto.

## 12. Lots d’implémentation

| Lot | Contenu |
|---|---|
| **F1** | Canaux + routage d’ouverture `commande_nouvelle` |
| **F2** | Autorisation C + branchements session / Espace restaurateur + messages |
| **F3** | Essai réel émulateur + journal passation |

Méthode : plan détaillé → implémenteur (sonnet) lot par lot → relecture sécurité (opus) → essai F3.
