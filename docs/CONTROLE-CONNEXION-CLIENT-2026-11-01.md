# Connexion client Expo — contrôle du 1er novembre 2026

## État

Premier lot e-mail/mot de passe existant préparé et branchement API déployé. **Connexion avec un vrai compte NON encore vérifiée : saisie personnelle de Malika requise dans le formulaire.** Aucun mot de passe demandé dans le chat, aucun compte créé, aucune tentative de connexion réelle effectuée par l’agent.

Même Supabase Auth que Kotlin/site, REST directement vers le projet attendu. Configuration publique récupérée en mémoire depuis l’API : aucune clé dans le code mobile ou un fichier de secrets mobile. Le serveur ne rend qu’une clé anon du bon projet ou une clé publiable ; une clé privilégiée est refusée. Destination Auth fixe dans le client, sans cookie, jeton d’accès en en-tête et renouvellement dans le corps ; aucun jeton en URL/journal. Erreurs fixes, sans réponse brute du service.

Android/iOS : seul le renouvellement va dans Expo SecureStore, accès en mémoire ; pas de session dans SQLite. Plugin officiel ajouté, version ~57.0.4 conforme aux modules du SDK 57 installé. Web : mémoire uniquement, rechargement/fermeture déconnectent. Mot de passe vidé après soumission et fermeture du formulaire. Déconnexion locale, demande de révocation distante limitée à cet appareil, avertissement si elle n’est pas confirmée. Coffre en échec : aucune fausse réussite de connexion. Une réponse tardive ne rétablit pas une session fermée. Renouvellement simultané partagé, identité stable, refus définitif effacé et panne temporaire conservée.

Lectures privées via GET /api/v1/client/espace, contrôle strict existant. Le client ne garde qu’un résumé en mémoire (pseudo, nombre de favoris/adresses), aucune adresse ni liste de données privées sauvegardée. Relire l’espace renouvelle le jeton si nécessaire ; ouvrir Mon compte relit les données. Aucun droit d’accès accordé par l’écran ni l’identifiant du navigateur.

## Preuves locales

- Tests ajoutés rouges (modules absents, code 1), puis verts.
- **API 260/260, code 0.** Trois nouveaux tests : clé privilégiée refusée, configuration absente refusée, prévol GET et refus sans identité ; pas de CORS d’écriture ouvert. Le test statique de lecture différée a exigé la forme en bloc du getter dans worker.ts ; le getter reste lu à la requête.
- **Mobile 36/36, code 0.** Douze tests connexion : coffre, projection des lectures, déconnexion, race réponse tardive, indisponibilité/refus du renouvellement, échec de sauvegarde, destination, cookies, messages expurgés, renouvellement partagé, changement de compte, refus d’accès privé, identité du renouvellement et révocation distante en panne (certains regroupés dans un même test).
- Cinq mutations détectées à code 1 : clé privilégiée autorisée, POST annoncé dans le CORS, accès sauvegardé à la place du renouvellement, retrait des gardes de réponse tardive, retrait du refus de configuration d’une autre destination. Restauration puis suite mobile 36/36 à code 0 ; API 260/260 à code 0 sur le code restauré identique.
- Types de tous les workspaces : code 0. Build API : code 0, 1 174 Kio. Paquet exact démarré dans workerd avec valeurs fictives et réseau externe interdit : configuration, prévol, santé et refus des lectures/commandes sans identité ; code 0. Wrangler dry-run dans un dossier isolé sans .env/.dev.vars : code 0.
- Exports finaux après restauration des sources : Android/iOS/web, code 0. Hermes Android 3,4 MB, iOS 3,1 MB ; web 1,5 MB (arrondis du compilateur). Ces exports ne sont ni des APK/IPA ni une preuve du coffre sur téléphone.

## Mise en ligne et vérifications publiques

Code : commit d51d4fb. Autorisation explicite persistante de Malika pour les déploiements prêts. Paquet construit depuis le code courant (pas l’ancienne livraison historique du catalogue), copié avec sa configuration dans un dossier isolé. SHA-256 : `9D7048CF749826874758BD90435EBDF79038A536148097E6EC75A6614628103E`.

API déployée : **cd5d0ef8-c2ea-4761-adcb-29349126087e**, déploiement code 0 et métadonnées confirmées à 100 %. Version précédente : 22542e7e-fdfe-4cd1-beb2-f978f9923aff. SITE_JETONS et les noms/types des secrets sont conservés. Aucun ajout/modification de secret, garde de création ou relais ; aucune migration ni écriture métier, aucun changement du site.

Après déploiement, contrôles sans compte : configuration 200/no-store, disponibilité Supabase Auth 200 avec connexion e-mail activée, prévol privé 204, espace sans session 401, catalogue 200 ; contrôle à code 0. La clé publique n’a été utilisée qu’en mémoire, jamais affichée. Ces contrôles ne prouvent pas une connexion de compte réussie.

## Interface et suite requise

Formulaire réel dans l’aperçu dédié **http://localhost:8092/**, bouton Mon compte Speedfood. Vérification au format 390 × 844 : type du champ mot de passe = password ; envoi vide désactivé. Aucun identifiant saisi par l’agent. Capture hors dépôt : C:\Users\moelo\dev\speedfood-connexion-client.png. Page laissée prête pour la saisie personnelle de Malika.

À vérifier ensuite : connexion réelle → lecture de l’espace → déconnexion → absence d’accès privé. Sur appareils : SecureStore, restauration après fermeture, suspension/reprise, effacement et cas de panne système. La persistance iOS suit le Keychain (peut survivre à une réinstallation avec le même identifiant) ; une déconnexion explicite efface le renouvellement. Source : [documentation Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Connexion sociale, inscription et récupération natives sont hors de cette première tranche ; le lien d’inscription ouvre le site existant.

Retour arrière : retirer ces ajouts depuis le code courant ou, s’il n’existe pas de changement ultérieur à conserver, rétablir la version API précédente ci-dessus. Retirer l’entrée connexion Expo et déconnecter les testeurs avant retrait pour effacer leur coffre. Ne jamais supprimer de compte ou de données en base pour annuler ce lot. Catalogue, panier et ADR-021 restent en place. Les préconditions des commandes et des alertes restent distinctes.
