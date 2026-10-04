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

## 5. Étape suivante (A2) : notification push web — décisions requises

Pour être alerté **page fermée**, il faut une notification push (Service Worker + abonnement + serveur d'envoi). Ce que cela suppose, avant tout code :

| Besoin | Détail | Qui |
|---|---|---|
| Paire de clés VAPID | Une clé publique (dans le code) et une clé privée **à stocker comme secret du Worker** | Malika autorise ; la clé privée n'apparaît ni dans le dépôt ni dans une conversation |
| Table des abonnements | `push_subscriptions` (restaurant, utilisateur, point d'accès, clés), RLS, migration + fichier de migration, puis `get_advisors` | Développement |
| Envoi | À la création d'une commande : envoyer aux abonnés du restaurant (sans donnée client dans le message). La bibliothèque classique `web-push` s'appuie sur Node ; sur Cloudflare Workers, prévoir une implémentation compatible WebCrypto | Développement |
| Consentement | Bouton « Être averti même page fermée », écran de gestion et de retrait, jamais de demande automatique | Développement |
| iPhone | Les push web exigent que l'application soit **ajoutée à l'écran d'accueil** (iOS 16.4 ou plus) : dépend du lot B (manifeste) | Lot B |
| Limites | Quota et coût : aucun service payant n'est requis pour Web Push ; vérifier les limites du plan Cloudflare | À valider |

Ordre conseillé : **lot B (application installable) puis A2**, car sur iPhone le push n'existe qu'après l'installation.
