# Banc natif G1 — usage local uniquement

Ce projet séparé n'est importé ni par `src/app`, ni par la configuration normale, ni par le paquet de production.

Il réutilise **le vrai composant LivreurReel, son contrôleur, GestionSession, le parseur partagé, la route Hono et le service fiche**. Le coffre est une variable en mémoire ; le module `coffre.ts`/`gestion.ts` réel n'est jamais importé. La méthode réseau `creerAuth().ficheLivreur` n'est pas utilisée ici : un port local séparé fournit la fiche ; ses tests unitaires contrôlent séparément l'origine API normale. Toute autre méthode du client produit est branchée sur un fetch qui refuse avant réseau.

Le transport n'accepte que `http://127.0.0.1:8797` et trois chemins explicitement permis ; les redirections HTTP sont refusées (`redirect: error`), même si un appelant demande de les suivre. Seuls les deux porteurs factices prédéfinis peuvent lire une fiche. La route et le service s'exécutent sur des lignes factices, B avant A pour détecter la perte du filtre ; aucune écriture de base ni fonction de répartition n'est présente. Les seuls POST du banc changent le scénario EN MÉMOIRE, pas un restaurant.

## Lancement par le contrôleur

Vérifier d'abord que 8797 est libre et identifier le Metro existant avant de l'arrêter. Ne jamais effacer les données de l'APK ou déconnecter le compte réel. Aucun `npm install`, génération native ou fichier secret nécessaire.

Depuis la racine du dépôt (terminal cmd) :

```bash
node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-livreur/serveur.mjs
```

Dans un autre terminal, depuis la racine :

```bash
set EXPO_NO_DOTENV=1&& set EXPO_NO_TELEMETRY=1&& set CI=1&& set NODE_OPTIONS=--dns-result-order=ipv4first&& node node_modules/expo/bin/cli start apps/mobile/controle-livreur --localhost --port 8081
```

Le contrôleur peut relayer 8081 et 8797 par `adb reverse`, puis redémarrer **seulement le processus** de l'APK debug de contrôle `com.speedfood.clientdemo`. Pas de désinstallation, pas de `pm clear`. Le bandeau doit annoncer « CONTRÔLE LOCAL — DONNÉES FACTICES ».

Scénarios disponibles : `actif`, `suspendu`, `archive`, `absente`, `panne`, `lente`, `restaurant_masque`. Modifier par un POST local `/__scenario?cas=...`, puis cliquer « Actualiser ma fiche ». `/__etat` expose seulement le scénario, le nombre de lectures et les lettres A/B ; aucune valeur de porteur.

## Parcours à vérifier

Fiche A active, actualisation manuelle, scénario suspendu, absence réelle, panne distincte, retour puis réouverture, rattachement masqué neutre. Pour une course de lectures : scénario lente, actualiser A puis cliquer Compte B avant la réponse ; seule la fiche B doit apparaître. Aucune action métier, permission de position ou notification n'est sollicitée.

## Retour à l'application normale

Arrêter uniquement ces deux processus de contrôle. Relancer Metro depuis `apps/mobile` (configuration normale), redémarrer le processus de l'APK : la session réelle persistée doit toujours être là, car le banc ne l'a ni lue, ni modifiée. Ne pas annoncer « livré en production » : la route nouvelle n'est pas déployée et la parité Kotlin reste inachevée.
