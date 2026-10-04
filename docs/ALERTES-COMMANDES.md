# Alertes de nouvelle commande — console restaurateur

**Version :** 1.0, 4 octobre 2026. **Origine :** lot A de `ANALYSE-CONCURRENT-MADIFOOD-2026-10-04.md` (le plus gros retard de Speedfood : le restaurateur devait rafraîchir sa page pour voir arriver une commande).

## 1. Ce qui existe (étape A1, console ouverte)

| Fonction | Comportement |
|---|---|
| Vérification | Toutes les 15 s, et au retour sur l'onglet ou au retour du réseau, la console interroge `/restaurant/alertes`. |
| Carillon | À chaque nouvelle commande (deux notes montantes, deux fois). Rejoué toutes les 2 minutes tant qu'une commande reste à traiter. |
| Titre d'onglet | Onglet caché : le titre alterne avec « (2) Nouvelles commandes · … » jusqu'au retour sur l'onglet. |
| Notification du navigateur | Si le restaurateur l'a autorisée (bouton explicite, jamais de fenêtre automatique) et que l'onglet est caché. |
| Rafraîchissement | La liste « À traiter » et la pastille de la navigation se mettent à jour d'elles-mêmes ; les âges (« il y a 12 min ») une fois par minute. |
| Retard | Une commande à traiter depuis **10 minutes ou plus** affiche un bandeau rouge « En attente depuis 12 min : le client attend votre réponse. ». |
| Annonce | Les lecteurs d'écran annoncent « Nouvelle commande reçue. Elle est à traiter. » |
| Honnêteté | Si la connexion est perdue ou la session expirée, le bloc le dit en rouge : **les alertes sont en pause**. |

Réglages (bloc « Alertes actives » de la barre latérale, sur téléphone en haut de la page) : son activé ou non (mémorisé dans le navigateur), test du son, notifications du navigateur.

## 2. Données et sécurité

- La route `/restaurant/alertes` ne renvoie que : le nombre de commandes à traiter, leurs identifiants et la date de la plus ancienne. **Jamais de nom, téléphone ni adresse de client.**
- Le restaurant est déduit de la **session**, jamais d'un paramètre ; la RLS reste l'autorité.
- Sans session (ou sans double authentification validée), le proxy renvoie vers la connexion : le composant l'interprète comme « session expirée ».
- Réponse en `Cache-Control: no-store`.

## 3. Limites connues (à connaître et à dire aux restaurateurs)

1. **La page doit rester ouverte.** Sans notification push (étape A2), un onglet fermé ou un téléphone verrouillé ne sonne pas.
2. **Le son exige un premier geste** sur la page (règle des navigateurs). Le bloc le signale (« touchez “Tester le son” »).
3. **Téléphone en veille** : les navigateurs mobiles ralentissent ou arrêtent les onglets cachés ; l'alerte peut arriver en retard. Les restaurateurs doivent garder l'écran allumé ou installer l'application sur l'écran d'accueil (lot B).
4. **Notifications du navigateur sur téléphone** : le constructeur `Notification` est refusé par certains navigateurs mobiles ; elles seront remplacées par la notification push de l'étape A2.
5. **Délai** : jusqu'à 15 secondes entre l'arrivée de la commande et l'alerte (intervalle de vérification).

## 4. Vérifications faites (4 octobre 2026)

- 19 tests purs (`npm run test:unit`, suite `alertes`) : détection des nouvelles commandes, minutes d'attente, seuil de retard, titre d'alerte, relance du son.
- Essai réel en local avec un compte de test (supprimé ensuite) :
  commande insérée pendant que la console est ouverte → carillon joué (compteur de sons), annonce, carte apparue seule, pastille à 1 ;
  onglet simulé caché → titre « (2) Nouvelles commandes · Commandes · Speedfood » en alternance, retour normal à la visibilité ;
  commande vieille de 12 min → bandeau de retard ;
  coupure du réseau simulée → « Connexion perdue : alertes en pause » avec point rouge.
- **Non vérifié** : le son réellement entendu (le compteur prouve l'appel, pas le volume), les notifications du navigateur (nécessitent une autorisation dans un vrai navigateur), un téléphone réel.

## 5. Lot A2 : notification push web (page fermée)

**État : code et base prêts en local, non déployés. Secret de production à poser avant usage.**

- **Sans contenu** : le serveur envoie un push vide signé VAPID (RFC 8292) ; le Service Worker (`public/sw.js`) affiche le texte générique « Nouvelle commande ». Aucune donnée client ne passe par Google, Mozilla ou Apple.
- **Table** `push_subscriptions` (migration `20261004022747_abonnements_push.sql`, RLS, 10 appareils max par personne).
- **Routes** `/restaurant/alertes/abonnement` (POST/DELETE) et `/restaurant/alertes/test` (3 essais par 5 min) : session obligatoire, en-tête `Origin` vérifié, point d'accès limité aux services de push connus (anti-SSRF).
- **Envoi** : `after()` dans la création de commande, abonnés du restaurant, abonnements expirés (404/410) supprimés, trois échecs passagers de suite aussi.
- **Consentement** : bouton explicite dans la console, jamais de demande automatique ; sans clé configurée le bouton n'apparaît pas.
- **Variables** : `VAPID_PUBLIC_KEY` et `VAPID_SUBJECT` dans `wrangler.jsonc` ; **`VAPID_PRIVATE_KEY` = secret Cloudflare** (`npx wrangler secret put VAPID_PRIVATE_KEY`), jamais dans le dépôt.
- **Vérifié** (compte de test, supprimé ensuite) : abonnement valide accepté ; hôte inconnu, http et clés manquantes refusés (400) ; 11e appareil refusé (409) ; essai d'envoi signé réellement émis vers le service de push, abonnements factices supprimés ; 17 tests purs. Routes sans session redirigées vers la connexion.
- **Non vérifié** : réception réelle sur un téléphone, déclenchement par une vraie commande invitée (même code d'envoi que l'essai), iPhone.
- **Android** : le push marche dans Chrome, Firefox et Samsung Internet sans installation (pas dans les navigateurs intégrés de WhatsApp ou Facebook). Chrome interdit `new Notification()` : les notifications locales passent maintenant par le Service Worker. `requireInteraction` est ignoré, son et vibration viennent du canal de notification du téléphone. Icône et badge de notification : à ajouter avec le lot B (aucune icône PNG dans le dépôt). Pas de test sur téléphone réel.
- **iPhone** : le push n'existe qu'après « Ajouter à l'écran d'accueil » (iOS 16.4+), donc dépend du lot B (manifeste).

## 6. Lot B : application installable

- `src/app/manifest.ts` : nom, couleurs du design system, affichage `standalone`, raccourcis « Commandes à traiter » et « Restaurants », icônes `any` et `maskable`.
- Icônes générées par `node scripts/generer-icones.mjs` (emblème du logo officiel `public/logo-speedfood.webp`, sur son fond crème) dans `public/icons/` : 192, 512, maskable 512, `apple-touch-icon` 180, badge de notification 96 (blanc sur transparent). Pour changer de logo : remplacer le fichier source et relancer le script.
- `layout.tsx` : `theme-color`, icône iOS, mode application iOS.
- Console : bloc « Installer l'application » (`InstallationApp.tsx`) : bouton natif sur Android quand Chrome le propose, mode d'emploi sur iPhone/iPad (condition du push iOS 16.4+), conseil batterie Android ; invisible une fois installée et sur ordinateur.
- Notifications : `icon` et `badge` renseignés (push et notification locale).
- **Vérifié en local** : manifeste, icônes et `sw.js` servis (200, bons types) ; bloc rendu à 375 px avec un agent Android, sans débordement. **Non vérifié** : installation réelle sur Android et iPhone, bouton natif (nécessite HTTPS en ligne), rendu de l'icône sur l'écran d'accueil.
