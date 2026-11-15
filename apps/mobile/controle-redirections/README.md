# Contrôle des redirections Android — données fictives

Ce banc charge le vrai `creerAuth` et le même `fetchHttp` que `gestion.ts`.
Il ne lit aucun coffre ni fichier de secrets et ne contacte aucun service réel.
Les trois écritures livreur sont réécrites vers un serveur local qui accepte
uniquement un porteur factice. Aucun code de remise ni position n'est envoyé.

Depuis la racine du dépôt, démarrer le serveur :

```bat
node apps/mobile/controle-redirections/serveur.mjs
```

Les ports 8798 et 8799 doivent être libres. Arrêter seulement le Metro connu,
puis lancer celui du banc :

```bat
set EXPO_NO_DOTENV=1&& set EXPO_NO_TELEMETRY=1&& set CI=1&& set NODE_OPTIONS=--dns-result-order=ipv4first&& node node_modules/expo/bin/cli start apps/mobile/controle-redirections --localhost --port 8081 --clear
```

Relayer 8081, 8798 et 8799 avec `adb reverse tcp:PORT tcp:PORT`, puis relancer
le processus de l'APK **debug de contrôle**, `com.speedfood.clientdemo`.
Ne jamais désinstaller ni effacer ses données. Aucun nouvel APK n'est requis
si le module Expo Fetch est déjà présent dans l'APK de contrôle.

1. « Témoin XHR (factice) » : le client utilise explicitement `whatwg-fetch`,
   l'ancien Fetch XHR React Native (Expo 57 remplace déjà global.fetch par défaut).
   Une entrée 307 et une requête de destination doivent reproduire le défaut.
2. « Vérifier la protection native » réinitialise les compteurs, puis exécute
   trois témoins positifs HTTP 200 et trente redirections : 301/302/303/307/308,
   chacune pour disponibilité, offre et course, vers la même origine puis vers
   une autre origine locale (port différent).
3. Attendu : trois succès HTTP 200, trente erreurs métier `incertain`,
   **33 entrées et zéro destination**. Une erreur de chargement du module ou
   un serveur injoignable ne suffit donc jamais à faire passer le contrôle.
4. Consulter les compteurs : `curl http://127.0.0.1:8798/__etat`.
   Aucun porteur ni corps de requête n'est exposé par cette route.

Après l'essai : arrêter ce serveur et le Metro du banc, relancer Metro normal
depuis `apps/mobile` avec les mêmes variables et IPv4, redémarrer le processus
de l'APK, vérifier catalogue et compte connecté. Le banc n'est importé par
aucun écran ni configuration du produit.

Cette preuve porte sur les redirections HTTP et l'APK de contrôle essayée.
Elle ne vaut ni essai iOS, ni compilation d'un nouvel APK, ni publication.

## Délais et corps lents — secondes réelles

Le bouton « Vérifier les délais » utilise un autre serveur :

```bat
node apps/mobile/controle-redirections/serveur-delais.mjs
```

Relayer également `adb reverse tcp:8796 tcp:8796`. Il n'est pas nécessaire
de démarrer les serveurs de redirections pour cet essai.

Le vrai client conserve son délai de **20 000 ms** ; le vrai contrôleur
livreur est utilisé avec une session et une course factices, sans coffre.
Trois cas sont exécutés sur l'émulateur :

- `rapide` : en-têtes immédiats, JSON terminé après 1,5 seconde. Succès et
  relecture automatique attendus, pour vérifier le fonctionnement du banc.
- `entetes` : aucune réponse avant 25 secondes. Abandon vers 20 secondes,
  résultat incertain et socket fermée avant envoi des en-têtes attendus.
- `corps` : en-têtes et début de JSON immédiats, progression toutes les
  4 secondes, fin à 25 secondes. L'activité de lecture ne doit pas remettre
  à zéro le délai global de 20 secondes.

Pour les deux cas lents : tentative supplémentaire via le contrôleur après
abandon (elle doit être bloquée, compteur toujours à un), attente jusqu'à
27 secondes pour vérifier qu'aucune fin tardive ne transforme le résultat en
succès, puis relecture manuelle qui montre l'action fictive appliquée et
retire le verrou. La course n'est jamais rejouée.

`curl http://127.0.0.1:8796/__etat` fournit les durées mesurées par Android,
le journal serveur (en-têtes, morceaux, fermeture, tentative de fin tardive)
et les rapports du vrai contrôleur. Aucun porteur ni corps de requête n'est
exposé. Ces secondes ne sont pas simulées. Le contrôle signale un échec
si l'abandon n'est pas mesuré entre 19 et 26 secondes.

Après essai, arrêter aussi ce serveur et retirer le relais 8796 ; remettre
Metro normal et vérifier la session comme indiqué plus haut.
