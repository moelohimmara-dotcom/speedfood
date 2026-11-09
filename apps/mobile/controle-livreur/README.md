# Banc natif G1, G2 et G3 — usage local uniquement

Procédure complète, préconditions APK debug, commandes ADB, résolution React, lancement avec cache vidé et retour au produit : [guide de reprise](../../../docs/REPRISE-EQUIPE-DEV.md). Résultat vérifié et limites : [rapport G1](../../../docs/CONTROLE-FICHE-LIVREUR-EXPO-2026-11-07.md).

Ce projet séparé n'est importé ni par `src/app`, ni par la configuration normale, ni par le paquet de production.

Il réutilise **le vrai composant LivreurReel, son contrôleur, GestionSession, le parseur partagé, la route Hono et le service fiche**. Le coffre est une variable en mémoire ; le module `coffre.ts`/`gestion.ts` réel n'est jamais importé. La méthode réseau `creerAuth().ficheLivreur` n'est pas utilisée ici : un port local séparé fournit la fiche ; ses tests unitaires contrôlent séparément l'origine API normale. Toute autre méthode du client produit est branchée sur un fetch qui refuse avant réseau.

Le transport n'accepte que `http://127.0.0.1:8797` et des chemins explicitement permis ; les redirections HTTP sont refusées (`redirect: error`), même si un appelant demande de les suivre. Seuls les deux porteurs factices prédéfinis peuvent lire une fiche. La route et le service s'exécutent sur des lignes factices, B avant A pour détecter la perte du filtre ; aucune écriture de base ni fonction de répartition réelle n'est présente. Les POST du banc changent le scénario, injectent une faute ou modifient le monde factice EN MÉMOIRE, jamais un restaurant ni une base.

## Lancement par le contrôleur

Vérifier d'abord que 8797 est libre et identifier le Metro existant avant de l'arrêter. Ne jamais effacer les données de l'APK ou déconnecter le compte réel. Aucun `npm install`, génération native ou fichier secret nécessaire.

Depuis la racine du dépôt (terminal cmd) :

```bash
node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-livreur/serveur.mjs
```

Dans un autre terminal, depuis la racine :

```bash
set EXPO_NO_DOTENV=1&& set EXPO_NO_TELEMETRY=1&& set CI=1&& set NODE_OPTIONS=--dns-result-order=ipv4first&& node node_modules/expo/bin/cli start apps/mobile/controle-livreur --localhost --port 8081 --clear
```

Le contrôleur peut relayer 8081 et 8797 par `adb reverse`, puis redémarrer **seulement le processus** de l'APK debug de contrôle `com.speedfood.clientdemo`. Pas de désinstallation, pas de `pm clear`. Le bandeau doit annoncer « CONTRÔLE LOCAL — DONNÉES FACTICES ».

Scénarios historiques (G1, G2) : `actif`, `suspendu`, `archive`, `absente`, `panne`, `lente`, `restaurant_masque`, `offre`, `offre_expiree`. Scénarios G3 : voir la section « G3 » plus bas. Modifier par un POST local `/__scenario?cas=...`, puis cliquer « Actualiser mon état ». `/__etat` expose le scénario, le nombre de lectures, les lettres A/B et (G3) l'état du monde factice ; aucune valeur de porteur ni de code.

## Parcours à vérifier (G1, G2)

Fiche A active, actualisation manuelle, scénario suspendu, absence réelle, panne distincte, retour puis réouverture, rattachement masqué neutre. Pour une course de lectures : scénario lente, actualiser A puis cliquer Compte B avant la réponse ; seule la fiche B doit apparaître. Aucune permission de position ni notification n'est sollicitée.

## G3 — offre et course (banc G3c)

Le banc joue le chapitre G3 sur une base **factice en mémoire** : accepter ou refuser l'offre, faire avancer la course, code de remise, échec. Aucune écriture réelle, aucun appel à la production, aucun secret. Offre et course passent par le **vrai client réseau** de l'application (`creerAuth`) dont seule l'adresse est réécrite vers `127.0.0.1:8797` ; la route Hono, le service d'état, la lecture de la course active et le contrôle de `livraisonId` sont ceux de l'API ; seules les écritures (réponse à l'offre, avancement) sont simulées, avec les vraies règles de statut du site (`acteurPeut`). Le code de remise du banc est factice ; il n'est dans aucune réponse ni dans `/__etat`.

### Contrôle automatique sans émulateur (aucun serveur, aucun réseau)

Depuis la racine du dépôt (terminal cmd) :

```bash
node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-livreur/parcours-g3.mjs
```

Onze parcours, sortie « PARCOURS G3 : 11 parcours OK », code 0. Le même parcours est lancé par `npm test` (`tests/livreur-g3-banc.test.ts`).

### Essai natif par le contrôleur (cmd Windows)

1. Vérifier que 8797 et 8081 sont libres, identifier le Metro existant avant de l'arrêter. Ne pas effacer les données de l'APK, ne pas déconnecter le compte réel.
2. Banc (racine du dépôt, un terminal) : la commande `serveur.mjs` de la section « Lancement par le contrôleur ».
3. Metro du banc (racine du dépôt, un autre terminal) : la commande `expo start apps/mobile/controle-livreur` de la même section.
4. Relais ADB, **seulement** si le contrôleur le décide : `adb reverse tcp:8081 tcp:8081` et `adb reverse tcp:8797 tcp:8797`, puis redémarrer le **processus** de l'APK debug de contrôle `com.speedfood.clientdemo`.
5. Choisir un scénario puis, dans l'application, « Actualiser mon état » (cmd, depuis n'importe quel dossier) :

```bat
curl -s -X POST "http://127.0.0.1:8797/__scenario?cas=g3_offre"
curl -s http://127.0.0.1:8797/__etat
```

| Scénario | Situation (compte A) |
| --- | --- |
| `g3_offre` | disponible, une offre en attente : Accepter, Refuser |
| `g3_course` | course acceptée, groupe Speedfood (étape : vers le restaurant) |
| `g3_course_vers_restaurant` | en route vers le restaurant (étape : récupérée) |
| `g3_course_recuperee` | commande récupérée, **client visible** (étapes : vers le client, échec) |
| `g3_course_vers_client` | en route vers le client, client visible (étapes : livrée avec code, échec). Code bon du banc : 4821 ; tout autre code de 4 chiffres est faux (5 essais) |
| `g3_propre` | livraison par le personnel du restaurant : seule l'étape « vers le client » au départ |
| `g3_lente` | A et B ont chacune leur course ; la lecture de A met 2,5 s : actualiser A puis taper « Compte B » avant la réponse, seule la course de B doit apparaître |

Choisir un scénario G3 réinitialise le monde factice. Fautes programmées pour la **prochaine écriture seulement** (cmd) :

```bat
curl -s -X POST "http://127.0.0.1:8797/__faute?type=incertain_applique"
curl -s -X POST "http://127.0.0.1:8797/__faute?type=incertain_perdue"
curl -s -X POST "http://127.0.0.1:8797/__faute?type=incertain_delai"
curl -s -X POST "http://127.0.0.1:8797/__changer-course"
```

- `incertain_applique` : l'écriture est appliquée puis le serveur répond par une panne. L'écran doit afficher « À vérifier », boutons verrouillés ; « Actualiser mon état » montre que l'étape a bien été appliquée.
- `incertain_perdue` : panne avant l'écriture ; après actualisation rien n'a changé et les boutons reviennent.
- `incertain_delai` : appliquée puis silence de 7 s ; le transport coupe à 6 s, même verrou.
- `/__changer-course` : le serveur remplace la course de A par une autre (autre identifiant) ; taper une étape sur l'écran périmé affiche « La course a changé, relisez. » puis montre la nouvelle course.

`/__etat` expose aussi `g3` : journal des écritures (sans code), raisons d'échec, nombre de lectures du client (`clientsLus` reste 0 tant que la commande n'est pas récupérée), `violations` (doit rester vide), états des livraisons.

Parcours à jouer à l'écran : offre, accepter, vers le restaurant, récupérée (téléphone du client visible seulement ici), vers le client, code faux (essais restants affichés), code bon (course terminée, client effacé) ; refuser une offre ; échec avec raison (l'écran demande une confirmation) ; les trois fautes ; course changée ; mode propre ; réponse lente puis Compte B. Vérifier par capture que le code tapé disparaît du champ dès l'envoi et que le clavier ne cache ni le champ ni le bouton.

## Retour à l'application normale

Arrêter uniquement ces deux processus de contrôle. Relancer Metro depuis `apps/mobile` (configuration normale), redémarrer le processus de l'APK : la session réelle persistée doit toujours être là, car le banc ne l'a ni lue, ni modifiée. Ne pas annoncer « livré en production » : les routes G3 ne sont pas déployées et la parité Kotlin reste inachevée.
