# Speedfood — client Expo Android et iOS

État du code au 8 novembre 2026 : `57f80f1`. Le client réel couvre catalogue, panier, connexion existante, création/historique/suivi des commandes, espace restaurateur et notifications. La fiche livreur G1 est ajoutée en lecture seule, sans mise en service par ce lot. Kotlin (`../../mobile`) reste distribué. Ne pas remplacer l’APK avant parité et validation des appareils/paiements.

## Documentation de référence

- [Passation et preuves](../../docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md)
- [Architecture, modules et contrats](../../docs/ARCHITECTURE-APPLI-EXPO.md)
- [Corrections et travaux ouverts](../../docs/REGISTRE-CORRECTIONS-APPLI-EXPO.md)
- [Commandes et reprise par une équipe](../../docs/REPRISE-EQUIPE-DEV.md)
- [Banc livreur synthétique](controle-livreur/README.md)

Installation npm à la racine avec le verrou unique. Versions déclarées : Expo ~57.0.31, React Native 0.86.3, React 19.2.3. Identité debug habituelle : com.speedfood.clientdemo, distincte de Kotlin. L’entrée _layout monte CatalogueReel ; les anciennes routes/états de démonstration restent dans le dépôt mais ne sont pas le parcours réel monté.

Catalogue : API unique directe, sans données fictives de secours. Stockages réel et démo distincts. SecureStore natif conserve le renouvellement ; le navigateur conserve la session en mémoire et la perd au rechargement. Aucun mot de passe ou jeton dans SQLite. Aucun envoi automatique différé de commande. Prix et accès contrôlés côté serveur, montants GNF entiers.

## Vérifier depuis ce dossier

```bash
npm test
```

```bash
npx tsc --noEmit
```

Compléter avec les contrôles racine, les mutations et les scénarios natifs du guide de reprise. Un export JavaScript Android/iOS n’est ni une APK ni une IPA. Les archives iOS de CI sont pour simulateur, pas pour installation sur téléphone physique. Une compilation verte ne prouve pas la livraison fonctionnelle ni le déploiement.

Ne jamais lire .env*, les fichiers de services/signature ou le coffre réel pour diagnostiquer. Ne pas effacer la session de l’émulateur. Les autorisations de production et d’écriture sont précisées dans la passation.


## Veille native (prototype, compilation CI requise)

Le module local `modules/speedfood-veille` porte les deux services de premier plan Android (veille restaurateur : sonnerie et écran allumé ; suivi livreur : positions remontées à la session). Aucun jeton ne passe côté natif. Sa première compilation se fait par la CI Android de contrôle (branche `etape-*` ou lancement manuel) ; tant qu'elle n'est pas verte et essayée sur un vrai téléphone, les lignes C11, C12 et D9 de la matrice de parité restent « prototype écrit », jamais « reprise ».
