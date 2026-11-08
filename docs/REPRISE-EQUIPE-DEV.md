# Reprise par une nouvelle équipe — 8 novembre 2026

## Ordre de lecture et premier contrôle

Lire [CLAUDE](../CLAUDE.md), [AGENTS web](../apps/web/AGENTS.md), la [passation principale](PASSATION-CHANTIER-SPEEDFOOD-APP.md), l’[architecture](ARCHITECTURE-APPLI-EXPO.md), le [registre](REGISTRE-CORRECTIONS-APPLI-EXPO.md), puis les plans du lot choisi. Les anciens journaux sont datés, pas des procédures actuelles. Aucun accès aux mémoires privées d’un agent n’est requis.

Première commande en invite cmd Windows :

```bash
cd /d C:\Users\moelo\dev\speedfood && git branch --show-current && git status --short && git log --oneline -15
```

Attendu : branche `etape-adr021-deblocage-commandes`. Préserver les fichiers locaux de Malika, notamment `.tmp-*`. Ne pas changer de branche avec des changements non compris. Installer les dépendances uniquement à la racine avec le verrou npm ; ne jamais ouvrir les fichiers de secrets. Node 22 est utilisé en CI.

## État à transmettre oralement

Le code Expo couvre le catalogue, la commande connectée, le suivi, le restaurateur et une fiche livreur en lecture seule. Kotlin reste distribué ; G1 n’est pas mis en service par ce chantier. Avant tout remplacement, il faut terminer la parité, les paiements, les vérifications sur appareils et la diffusion signée.

Ne pas réinitialiser l’émulateur ni fermer la session réelle : Malika l’a refusé. Ne pas demander ses identifiants. Les bancs synthétiques doivent rester séparés du compte réel.

## Contrôles à relancer pour un changement de code

Chaque commande est une étape distincte, depuis la racine sauf indication. Exiger le code de sortie 0 et examiner aussi les échecs signalés dans le texte. Ne pas lancer une compilation lourde en parallèle des tests API sensibles aux délais.

```bash
cd /d C:\Users\moelo\dev\speedfood && npm run typecheck
```

```bash
cd /d C:\Users\moelo\dev\speedfood && npm run test:api
```

```bash
cd /d C:\Users\moelo\dev\speedfood && npm run test:unit
```

```bash
cd /d C:\Users\moelo\dev\speedfood && npm run test:cloisonnement
```

```bash
cd /d C:\Users\moelo\dev\speedfood && npm run build:api
```

```bash
cd /d C:\Users\moelo\dev\speedfood\apps\mobile && npm test
```

```bash
cd /d C:\Users\moelo\dev\speedfood\apps\mobile && npx tsc --noEmit
```

Mutation G1, hors essai UI et sans modification concurrente des sources :

```bash
cd /d C:\Users\moelo\dev\speedfood && node apps/mobile/scripts/muter-livreur-g1.mjs
```

Attendu au code de référence : 12 mutations détectées et restauration exacte, puis tests ciblés verts. Le nombre total évolue avec les travaux : ne pas considérer un compte historique comme une exigence figée. Pour un changement web, lire d’abord les guides Next.js locaux puis compléter par ESLint et cf:build selon les règles du dépôt.

## Banc livreur sans données réelles

Préconditions : Android SDK/ADB, émulateur existant, APK **debug** `com.speedfood.clientdemo` compatible avec Metro. La CI fournit une archive, pas une preuve d’installation. Ne pas installer une autre signature sur la session conservée ; ne pas utiliser désinstallation/effacement pour contourner ce point. Les chemins ADB ci-dessous sont ceux du poste actuel, à adapter sur un autre poste.

Avant de lancer le banc, inspecter les ports 8081 et 8797. L’état laissé contient déjà Metro normal sur 8081 : identifier sa commande puis arrêter uniquement ce terminal/processus avant de lancer Metro du banc. Ne pas changer de port silencieusement et ne pas tuer tous les processus Node.

L’AVD existant est `speedfood_pixel`. S’il est arrêté, le démarrer sans wipe, dans un terminal dédié :

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\emulator\emulator.exe" -avd speedfood_pixel
```

Attendre le démarrage complet et vérifier `adb devices`. Ne pas créer un nouvel AVD ni réinitialiser celui-ci pour contourner une erreur.

Terminal 1, serveur synthétique :

```bash
cd /d C:\Users\moelo\dev\speedfood && node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-livreur/serveur.mjs
```

Terminal 2, Metro du banc :

```bash
cd /d C:\Users\moelo\dev\speedfood && set "EXPO_NO_DOTENV=1"&& set "EXPO_NO_TELEMETRY=1"&& set "CI=1"&& set "NODE_OPTIONS=--dns-result-order=ipv4first"&& node node_modules/expo/bin/cli start apps/mobile/controle-livreur --localhost --port 8081 --clear
```

Vérifier d’abord les appareils :

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\platform-tools\adb.exe" devices
```

Puis, seulement si l’appareil attendu est `emulator-5554` :

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\platform-tools\adb.exe" -s emulator-5554 reverse tcp:8081 tcp:8081
```

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\platform-tools\adb.exe" -s emulator-5554 reverse tcp:8797 tcp:8797
```

Relancer le processus de l’appli sans supprimer ses données :

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\platform-tools\adb.exe" -s emulator-5554 shell am force-stop com.speedfood.clientdemo
```

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\platform-tools\adb.exe" -s emulator-5554 shell am start -n com.speedfood.clientdemo/.MainActivity
```

**Avant toute action**, reconnaître le bandeau « CONTRÔLE LOCAL — DONNÉES FACTICES ». Sinon arrêter l’essai. Ne jamais appliquer des boutons de changement de compte synthétique au produit réel. Scénarios : actif, suspendu, archivé, absent, panne, restaurant masqué, réponse A lente suivie de B. Actualiser une fois doit ajouter une seule lecture. Une réponse tardive A ne doit pas remplacer B.

Utiliser un état UiAutomator et une capture récents pour les interactions. Aucun facteur universel de coordonnées : les dimensions peuvent changer. Ne pas capturer/exporter le coffre ou les identifiants. Voir le [rapport détaillé](CONTROLE-FICHE-LIVREUR-EXPO-2026-11-07.md).

### Revenir au produit

Arrêter uniquement les terminaux/processus identifiés comme ceux du banc. Ne pas tuer tous les processus Node. Retirer le port du banc :

```bash
"C:\Users\moelo\.bubblewrap\android_sdk\platform-tools\adb.exe" -s emulator-5554 reverse --remove tcp:8797
```

Relancer Metro normal :

```bash
cd /d C:\Users\moelo\dev\speedfood && set "EXPO_NO_DOTENV=1"&& set "EXPO_NO_TELEMETRY=1"&& set "CI=1"&& set "NODE_OPTIONS=--dns-result-order=ipv4first"&& npm exec --workspace=@speedfood/mobile -- expo start --localhost --port 8081
```

Relancer le processus de l’appli avec les deux commandes ADB précédentes. Vérifier l’écran normal puis « Mon compte » et « Compte connecté », sans lire le stockage ni se déconnecter. Le retour a été vérifié le 8 novembre ; l’état des processus doit être revérifié à chaque reprise.

## Prochain lot recommandé : préparer G1 en service

1. Lire le code et les migrations existantes ; comparer le Worker réellement déployé au **bundle complet** de la branche, pas seulement au diff G1.
2. Écrire le plan de mise en service avec route, contrat, accès livreur, sécurité, essais autorisés et retour arrière. Ne pas modifier un rôle ou créer un compte implicitement.
3. Faire relire le plan et les résultats ; demander le feu vert distinct de Malika pour chaque action de production.
4. Après autorisation seulement, mettre en service puis vérifier absence/fiche personnelle, absence de fuite et panne distincte. Aucune écriture chez barbie food implicite.
5. Conserver le relais commandes éteint ; cette route mobile n’exige pas son activation. Documenter la version exacte, les codes de sortie et les limites.

Les lots suivants sont listés dans le registre : protocole notifications I2, preuve « prête » sur appareil physique, G2+ livreur, équipe, parité et paiement exclusif Chap Chap Pay. Les décisions d’architecture nouvelles appartiennent à Malika. Ne pas engager les étapes dépendantes sans acceptation.

## Déploiement et retour arrière

Les compilations ne sont pas des déploiements. Les derniers résultats CI du code 57f80f1 sont indiqués dans la passation ; les artefacts expirent le 15 novembre. Ne pas distribuer un debug APK ni une archive simulateur comme application finale. La diffusion iPhone nécessite une solution signée autorisée ; aucun nouveau compte/coût implicite.

Avant production : identifier version actuelle, migrations déjà appliquées, paquet complet et sauvegarde du candidat précédent. Préparer un retour de code ciblé, vérifier les migrations non réversibles séparément. Ne pas supprimer une migration appliquée pour revenir en arrière. `API_RELAIS=non` est un retour global qui nécessite lui aussi son feu vert. Le dernier relais rapporté est partiel ; ce n’est pas une lecture actuelle de Cloudflare.

Après chaque lot : actualiser la passation, API-UNIQUE, STATUT-PROJET et PASSATION-REFONTE avec preuves/limites. Ajouter les fichiers nommément, jamais `git add -A`. Commit avec le trailer imposé :

```text
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Indiquer honnêtement les modèles réellement intervenus. Pousser uniquement la branche de travail. Aucun merge master ni réécriture d’historique sans demande précise.

## Prompt de relais prêt à transmettre

> Reprends Speedfood dans C:\Users\moelo\dev\speedfood, branche etape-adr021-deblocage-commandes. Lis CLAUDE.md, apps/web/AGENTS.md, docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md puis les trois guides liés. Vérifie le Git et les preuves, distingue code/production/distribution. Ne lis aucun fichier de secrets. Préserve la session réelle de l’émulateur et les fichiers personnels non suivis. Propose le prochain petit lot à partir du registre ; aucune écriture barbie food, production, coût, activation commandes ou suppression d’historique sans feu vert distinct. Plan court, Sonnet implémente et corrige, Opus relit, mutations puis contrôles personnellement relancés et essai natif. Les exceptions GPT précédentes étaient limitées à leurs lots : redemander si nécessaire. Tiens la passation à jour, ajoute les fichiers individuellement et pousse seulement cette branche. Ne dis pas livré sur la seule base d’une compilation.
