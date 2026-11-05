# Passation du chantier « appli Speedfood » (Expo) — au 5 novembre 2026

Document de reprise : un agent ou un développeur qui n'a pas suivi les conversations doit pouvoir continuer à partir d'ici.
Il complète `docs/PASSATION-REFONTE.md` (refonte API unique) et ne le remplace pas. En cas de contradiction entre ce document et le code, **le code gagne** : ne pas trancher en silence, le signaler à Malika.

Branche de travail : `etape-adr021-deblocage-commandes` (poussée, jamais fusionnée dans `master`). Dépôt : `moelohimmara-dotcom/speedfood`.

---

## 1. En une page

- **Produit :** commande de repas à Conakry. Site (Next.js), API unique (Hono sur Cloudflare Workers), base Supabase, appli mobile.
- **Chantier :** remplacer l'ancienne appli Android Kotlin (`mobile/`) par l'appli **Expo / React Native** (`apps/mobile/`), avec iPhone installé depuis le site (sans App Store).
- **Règle produit (Malika, 3 nov. 2026) : pas de cash, tout par Chap Chap Pay.** Les modes « J'ai payé » avec code marchand restent seulement jusqu'à l'ouverture de Chap Chap Pay.
- **Où on en est :** le client peut commander (retrait ou livraison), suivre, se connecter ; le restaurateur peut tout faire depuis l'appli (lots D1 à D5) ; le client reçoit des notifications Firebase (lots E1 à E3, essai réel sur émulateur réussi sauf « prête »).
- **Ce qui manque pour remplacer Kotlin :** espaces livreur et équipe, notifications au restaurateur, Chap Chap Pay, iPhone natif, identifiant `com.speedfood.app` + signature, essai sur vrai téléphone (§6 et §7).

## 2. Qui est Malika, comment lui parler

- Non technicienne. **Toujours en français**, phrases courtes, **une action à la fois**, questions oui/non.
- Commandes à lui donner : bloc ```bash, syntaxe `cmd` (Windows).
- Elle donne des « feux verts » explicites ; sans feu vert : **aucun déploiement en production, aucun service/compte/coût nouveau, aucune écriture sur le vrai restaurant « barbie food »** (chaque écriture = son « oui »).
- Seule Malika clique : « Ajouter un secret » GitHub (l'environnement bloque Claude), « Conserver » sur un téléchargement Chrome, création de compte tiers.
- Trailer de commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. On ne pousse que la branche de travail.

## 3. Le dépôt et les commandes

| Dossier | Rôle |
|---|---|
| `apps/web` | Site Next 16 + OpenNext, Worker `speedfood-app` |
| `apps/api` | API Hono, Worker `speedfood-api` (https://speedfood-api.moelohimmara.workers.dev) |
| `apps/mobile` | Appli Expo SDK 57 (package Android `com.speedfood.clientdemo`) |
| `packages/shared` | Contrats partagés (le site exige un raccord d'une ligne par contrat) |
| `mobile/` | Ancienne appli Kotlin (`com.speedfood.app`), encore en service |
| `supabase/` | Migrations (projet `ggldjdizqrtpetdiohxy`) |
| `docs/` | Documentation ; `docs/plans/` = plans et journaux de lots |

Commandes (**exit 0 exigé**, relancer soi-même, ne jamais croire un rapport) :

```bash
npm install
npm run typecheck
npm run test:api
npm run test:unit
npm run test:cloisonnement
npm run build:api
```

Depuis `apps/mobile` : `npm test` (478 tests) et `npx tsc --noEmit`. `npm install` se lance **à la racine** (espaces de travail npm, un seul `package-lock.json`).

Taille du Worker API : limite 1 400 000 octets, actuel ≈ 1 284 373 (marge faible).

## 4. Travaux réalisés

Détail commit par commit : `git log --oneline master..HEAD` (127 commits). Journaux : `docs/plans/2026-11-02-commande-expo.md` (A à D5), `docs/plans/2026-11-04-notifications-push-client-expo.md` (E1 à E3).

| Lot | Contenu | Preuve |
|---|---|---|
| A, B | Commande depuis l'appli (retrait, puis livraison avec quartiers) ; route `GET /catalogue/quartiers` | Commandes TEST réelles depuis l'émulateur |
| C | Déclaration du règlement après acceptation ; décision « pas d'espèces » (mode filtré, refusé avant réseau) | Vérifié à l'écran, route déployée |
| Retrait des espèces | Côté serveur et site (code seulement) ; modes code marchand gardés | Journal + émulateur |
| D1 | Espace restaurateur : lire, accepter, refuser | Essai réel (commande TEST) |
| D2 | Prête, terminée, confirmation du paiement | Essai réel |
| D3, D3b | Annuler, proposer un autre prix ; clavier ; proposition close à l'annulation | Essai réel |
| D4a | Service (ouvert/fermé), réglages, disponibilité des plats | Essai réel |
| D4b | Créer, modifier, archiver un plat ; suppléments | Essai réel |
| D4c | Photo d'un plat (envoyer, remplacer, retirer) | Essai réel (échec `expo/fetch` trouvé et corrigé) |
| D5 | Livraison par le restaurant (mode propre), code de remise | Essai réel : accepter, prête, parti, faux code, bon code |
| E1 | API `POST /api/v1/appareils` et `/appareils/retirer` | Tests + déployé (401 sans connexion) |
| E2 | Appli : autorisation, enregistrement du jeton FCM, retrait à la déconnexion, ouverture du suivi | 36 tests, 28 mutations tuées |
| E3 | Essai réel notifications du client sur émulateur | Voir §5 |
| Firebase + CI | Clé de service posée sur l'API ; `google-services.json` par secret GitHub `GOOGLE_SERVICES_JSON_B64` ; étape dans `android-expo.yml` | APK n° 26 vérifiée (`resources.arsc`) |

Déploiements faits par Malika le 5 nov. : API (version `45cfd8bc-dc2e-4e02-9862-bcf0e1d12852`) et site.

## 5. Notifications du client : architecture et état

- Serveur : `apps/web/src/lib/push/{fcm,fcm-envoi,appareils}.ts` ; crochet `apresTransitionCommande` → `signalerChangementCommande` (appelé pour le site **et** l'API). Textes génériques, aucune donnée de client. Types : `commande_acceptee`, `commande_prete`, `commande_terminee`, `commande_refusee`, `commande_annulee` ; canal Android `suivi_commande`.
- Secret `FCM_SERVICE_ACCOUNT` lu dans `process.env` ; **absent, l'envoi est silencieux** (aucune erreur) : la preuve se lit sur l'émulateur ET dans `appareils_push.derniere_reussite_le`.
- Table `appareils_push` : sans policy (écriture par clé de service), 10 appareils par compte, suppression après 5 échecs.
- API : `apps/api/src/routes/appareils.ts` + `apps/api/src/appareils/cablage.ts`. Exception documentée : réutilise `enregistrerAppareil`/`retirerAppareil` du site avec la clé de service, après Bearer strict, plafond par compte et validation du corps (test `appareils-cablage-source.test.ts` épingle les 3 imports). Risque résiduel m-1 : un jeton connu change de propriétaire (même règle que le site).
- Appli : `apps/mobile/src/notifications/` (`autorisation`, `enregistrement`, `ouverture`, `service`, `natif`, `cablage`, `index`). Jeton natif FCM (`getDevicePushTokenAsync`), pas le service Expo Push. Autorisation demandée **une fois, après la 1re commande réelle**.
- Navigation : pas de routeur ; l'écran « suivi » est la fenêtre « Mon compte » (`CatalogueReel.tsx`).

**Prouvé sur émulateur (5 nov.) :** demande d'autorisation au bon moment ; ligne `appareils_push` créée ; notification « acceptée » 1 s après l'acceptation ; notification « terminée » reçue ; appui à froid → « Mon compte » sur la commande « Terminée » ; l'ancien appareil Kotlin du même compte a reçu l'alerte de nouvelle commande.

**Non prouvé / constats :** voir §6 (haut de liste).

## 6. Tâches inachevées (à faire, par priorité)

### P1 — pour tenir la parité avec Kotlin
1. **Notification « prête » sur un vrai téléphone.** Jamais vue sur émulateur (connexion Firebase perdue après la 1re notification ; cause non élucidée, mécanisme de remplacement non écarté).
2. **Notifications au restaurateur** (nouvelle commande) dans l'appli Expo : même socle. Canaux Android `alerte_commande` et `offre_course` à créer (m-4).
3. **Espaces livreur et équipe** dans l'appli Expo (non abordés).
4. **Chap Chap Pay en démo** : Malika place ses clés ; ensuite retirer les restes de paiement en espèces (décisions en attente de Malika) et les modes « J'ai payé ».
5. **Remplacement de l'APK Kotlin** : l'appli Expo doit porter `com.speedfood.app` et **la même clé de signature** (mise à jour par-dessus sans désinstaller) ; voir `docs/SIGNATURE-CANDIDAT-EXPO.md`, `docs/plans/2026-11-01-remplacement-apk-expo.md`. Conditions de publication à fixer avec Malika.

### P2 — cas d'essai non vérifiés (notifications)
Refus de l'autorisation ; déconnexion puis retrait de l'appareil (oblige Malika à se reconnecter) ; deuxième appareil ; client sans compte ; notifications d'annulation et de refus ; bandeau au premier plan sur la durée ; comportement des routes E1 sous workerd ; limite CPU 1102 sur le chemin « Livrée » et « Annuler la livraison ».
**Décision à prendre :** un appui sur une notification alors que « Mon compte » (ou le panneau restaurateur) est déjà ouvert ne change rien d'écran.

### P3 — iPhone
Notifications natives = compte Apple (non disponible). Aujourd'hui iOS reçoit un jeton APNs alors que le serveur n'envoie que par FCM (m-3). Compilation iOS et simulateur vérifiés via GitHub Actions (`ios-expo.yml`), voir mémoire `ios-compilation-github-actions`.

### P4 — petits points connus
- Mineurs E2 n-1 à n-5 (dont renouvellement de jeton perdu pendant un envoi en vol) ; m-1/m-2 (un retrait échoué laisse l'appareil enregistré).
- Mineurs D4a/D4b/D4c et limites D5 : voir les journaux de lots.
- Message d'erreur obsolète après une relecture réussie ; frais « à convenir » affichés à 0 GNF.
- `revalidatePath` après une action venue de l'API ; RLS d'un compte non propriétaire ; test statique m-3 à deux comptes.
- Le script de mutation E2 devrait restaurer les fichiers en `try/finally`.

### Décisions en attente de Malika
- `docs/PROMPT-CODEX-CHEF-DE-PROJET.md` (fichier à elle) a été embarqué par erreur dans le commit `744ec55` (poussé, aucun secret trouvé) : le retirer de l'historique (réécriture + force-push, accord requis) ou le laisser ?
- Fusion de la branche dans `master` : non faite, à décider.
- Relais `commandes` du site vers l'API : **éteint** (`API_RELAIS` absent ou `non`) ; ne jamais l'allumer ni déployer sans feux verts (Tâche 10, plan 1b ; `docs/FEUX-VERTS-ADR021-COMMANDES.md`).

## 7. Non abordé du tout

Espace livreur et équipe dans Expo ; paiement Chap Chap Pay réel (KYC à 0 %, pas de remboursement dans leur API : mémoire `chapchap-api-constats`) ; publication iOS/Android (conditions) ; connexion Facebook en production (app Meta en mode dev, publication reportée) ; limite CPU du Worker (erreur 1102 dès ~5 visiteurs simultanés : tests de charge prudents).

## 8. Instructions de reprise

### 8.1 Ordre de lecture
1. `CLAUDE.md` (racine) puis `apps/web/AGENTS.md` (Next 16 ≠ souvenirs : lire `node_modules/next/dist/docs/` **depuis la racine**).
2. Ce document, puis `docs/PASSATION-REFONTE.md`, `docs/CARTE-DU-CODE-WEB.md`, `docs/CARTE-DU-CODE-API-MOBILE-BASE.md`, `docs/API-UNIQUE.md`.
3. `docs/plans/2026-11-02-commande-expo.md` et `docs/plans/2026-11-04-notifications-push-client-expo.md`.
4. Au besoin : `docs/cadrage/{TDR,ADR,AGENT-INSTRUCTIONS,DESIGN-SYSTEM,PROCEDURE-SECURITE}.md`, `docs/STATUT-PROJET.md`, `docs/PASSATION.md`, `docs/REPRISE-SESSION.md`.

### 8.2 Méthode (à ne pas sauter)
1. Plan court dans `docs/plans/` (lot par lot).
2. Un sous-agent **sonnet implémente** (repris par message pour les corrections ; ne pas corriger soi-même).
3. Un sous-agent **opus relit** de façon indépendante (sécurité, cloisonnement), puis relecture ciblée après corrections.
4. **Mutations obligatoires** : casser volontairement le code ; les tests doivent échouer.
5. Relancer soi-même les commandes du §3 (exit 0), pas de confiance dans un rapport.
6. **Essai réel sur émulateur** avant de dire « livré » : les tests unitaires ne prouvent pas le natif (leçon D4c).
7. Journal du lot dans `docs/plans/`, mise à jour de ce document, commit **ciblé**.

### 8.3 Règles de sécurité
- Aucun secret, clé ou jeton dans le code, les commits, les logs ni les réponses. `.env.local` jamais commité. `google-services.json` est ignoré par Git.
- Identifiant de restaurant reçu du navigateur ≠ autorisation. Prix et accès : côté serveur/RLS.
- Montants GNF en entiers. Tokens du `DESIGN-SYSTEM.md` tels quels. Classes CSS préfixées par page (CSS global).
- Avant d'écrire dans une table, lire ses contraintes. Toute migration appliquée a son fichier dans `supabase/migrations/` dans le même commit ; après migration RLS/SECURITY DEFINER : `get_advisors(type: "security")`.
- Écriture d'une action : réponse incertaine = verdict « incertain », pas de réessai, verrouillé jusqu'à une relecture réussie ; un échec local (avant le réseau) = refus sans verrou.
- Piège Expo SDK 57 : le `fetch` global est `expo/fetch` ; un `FormData` avec `{uri,name,type}` est rejeté.
- **Commits : ne jamais `git add -A` sur `docs/`** (des fichiers non suivis de Malika s'y trouvent). Ajouter les fichiers un par un.

### 8.4 Déploiements (feu vert de Malika obligatoire)
```bash
cd /d C:\Users\moelo\dev\speedfood\apps\web && npm run cf:deploy
cd /d C:\Users\moelo\dev\speedfood\apps\api && npx wrangler deploy
```
Secrets du Worker API : `COMMANDE_JETON_SECRET`, `CREATION_COMMANDE_API`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RELAIS_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`, `FCM_SERVICE_ACCOUNT`. Poser un secret : `wrangler secret put NOM < fichier` sans jamais afficher le contenu.

### 8.5 Compiler l'APK (CI)
Workflow `android-expo.yml` (≈ 22–26 min) : lancer par « Run workflow » **sur la branche `etape-adr021-deblocage-commandes`** (le menu propose `master` par défaut). L'artefact `speedfood-expo-debug-apk` contient `debug/app-debug.apk` et `release/app-release.apk`. Si le secret `GOOGLE_SERVICES_JSON_B64` est absent, l'APK n'a **pas** de notifications : vérifier dans l'APK (`resources.arsc`, chaînes `google_app_id`, `first-metric-478413-e1`). Téléchargement par Chrome : Malika clique « Conserver ».

### 8.6 Émulateur Android
SDK `C:\Users\moelo\.bubblewrap\android_sdk`, AVD `speedfood_pixel` (image **Play Store**, obligatoire pour Firebase). Lancer avec `-dns-server 8.8.8.8,1.1.1.1`.
- Panne « Impossible de joindre Speedfood » : `adb shell settings put global private_dns_mode off`.
- Coordonnées réelles = coordonnées affichées × 1,2. Capture : `timeout 100 adb -s emulator-5554 exec-out screencap -p > fichier.png`.
- Volet des notifications : `cmd statusbar expand-notifications` (précédé de `collapse` si rien ne s'affiche).
- Connexion Firebase perdue : `cmd connectivity airplane-mode enable` puis `disable`.
- `uiautomator dump` ne marche pas ici : repérer par captures. Saisie de formulaire : un champ à la fois, avec pauses (le clavier désaligne le focus).
- Ne jamais défiler au hasard dans la liste du restaurateur : ce sont de **vraies commandes** (ex. SF-K94YB). Compte de test connecté : « elohim » ; une seule commande de test chez barbie food, avec le « oui » de Malika.
- Un faux serveur existe pour éviter la production : `mobile/faux-serveur/` (voir mémoire `faux-serveur-audit-emulateur`).

### 8.7 Firebase
Projet « Speedfood » `first-metric-478413-e1` (n° 378371573902), compte `moelohimmara@gmail.com`, plan Spark, Analytics désactivé. Applis Android : `com.speedfood.app` (Kotlin) et `com.speedfood.clientdemo` (Expo). Le projet Cloud contient des clients OAuth d'**autres** applications (« KORA Web », « Hermes Agent ») : ne pas les utiliser pour Speedfood ; supprimer le projet les supprimerait. Ne créer aucun autre compte/projet Google sans accord.

### 8.8 Mémoire de l'agent
`C:\Users\moelo\.claude\projects\C--Users-moelo-dev-speedfood\memory\` (index `MEMORY.md`). Entrées utiles : `notifications-client-expo-e3`, `firebase-speedfood`, `espace-restaurateur-expo-lots-d1-d5`, `emulateur-android-speedfood`, `expo-sdk57-fetch-formdata-piege`, `speedfood-pas-de-cash-chapchap-pay`, `verifier-tests-code-de-sortie`, `objectif-remplacement-kotlin-expo-ios-site`. Une mémoire ne remplace pas la lecture du code : vérifier avant de s'y fier.

## 9. Prochaine action recommandée
Proposer à Malika, en une question oui/non : **(a)** essai de la notification « prête » sur un vrai téléphone (elle installe l'APK n° 26), ou **(b)** démarrer le lot « notifications au restaurateur » (plan puis implémenteur sonnet, relecteur opus, essai émulateur).
