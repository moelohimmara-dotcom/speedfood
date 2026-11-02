# Commande dans l'application Expo — plan (2 novembre 2026)

Objectif : permettre de PASSER une commande réelle depuis l'application Expo (aujourd'hui : catalogue réel + panier réel + suivi/annulation, mais pas d'envoi). Condition pour envisager de remplacer l'APK Kotlin (voir `2026-11-01-remplacement-apk-expo.md`). Rien ne remplace `apps/web/public/speedfood.apk` ici.

## Contraintes globales
- Réponse à Malika en français ; code, tests et commentaires dans le style du dépôt (français, sans dépendance nouvelle sans raison).
- Aucun prix envoyé : le serveur recalcule ; on n'envoie que `sousTotalAffiche` (GNF entier) pour comparaison. Montants GNF en entiers.
- Aucune commande RÉELLE ni appel à la production pendant le développement : tests avec `fetch` simulé / faux serveur (`apps/mobile/src/donnees/faux-serveur-*.mjs`).
- La commande se poste à `ORIGINE_CATALOGUE + '/api/v1/commandes'` avec `Authorization: Bearer <accessToken>` (jeton porteur strict) ; le corps suit `CreationCommandePayload` (`packages/shared/src/contracts/commande.ts`) ; `mode` ∈ `retrait` | `livraison` (jamais `sur_place` : l'API le refuse). 201 = nouvelle commande, 200 = rejeu idempotent ; la réponse contient `reference` et `jeton` (clé d'accès au suivi : jamais journalisée, jamais dans une URL).
- `cleIdempotence` générée UNE fois par tentative d'envoi et réutilisée pour tout rejeu (double appui, réseau coupé) ; jamais régénérée automatiquement après une réponse inconnue.
- `consentementReglement: true` doit être une case cochée explicitement par le client (règlement hors portail, confirmation par le restaurant).
- Le jeton de suivi reçu alimente l'écran de suivi déjà existant (`CompteReel.tsx`, `commandes.ts`) sans le dupliquer.
- Pas de `style={{…}}` de mise en page ; tokens de `apps/mobile/src/design/tokens`.
- Un test qui ne peut pas échouer ne prouve rien : mutations demandées pour les gardes (clé d'idempotence, mode refusé, double envoi).

## Lot A — envoi d'une commande en RETRAIT (ce lot)
1. Domaine pur testable : construction du payload à partir du panier réel, des coordonnées (nom, téléphone) et du consentement ; règles de validation côté client (nom non vide ≤ 100, téléphone au format accepté par `packages/shared/src/commande/telephone.ts`) ; table des refus serveur → messages en français (400 validation, 401, 409/prix changé, 429, 5xx, réseau).
2. Client API : méthode `creerCommande` dans `apps/mobile/src/connexion/client.ts` (même mécanique `requete`, un seul essai, délai, taille de réponse bornée).
3. Écran de validation de commande (depuis `PanierReelVue`) : récapitulatif, champs, consentement, bouton Envoyer désactivé pendant l'envoi et tant que le formulaire est invalide ; exige d'être connecté (sinon renvoi vers la connexion) ; en cas de succès : vider le panier, afficher la référence et ouvrir le suivi de CETTE commande.
4. Gestion d'un envoi incertain (délai dépassé, réseau coupé après envoi) : conserver la même clé d'idempotence ; proposer « Réessayer » (même clé) et « Vérifier mes commandes ».
5. Tests, typecheck, relecture indépendante.

## Lot B — livraison (adresse, quartier, frais estimés par le serveur, `destination`, `fraisAffiches`)
## Lot C — paiement : déclaration du règlement après acceptation par le restaurant (modes et codes marchand fournis par le suivi), sans paiement en ligne tant que Chap Chap Pay n'est pas ouvert
## Lot D — notifications client (push) et espaces restaurateur/livreur/équipe : hors de ce plan

## Journal
- 2 novembre 2026 : plan écrit, lot A à lancer.
- 2 novembre 2026 : **lot A livré (code), commits `ddbae4e`, `a82737a`, `bd874f1`.** Envoi d'une commande en RETRAIT : écran `CommandeReelle.tsx` (Modal, comme le panier et le compte), machine d'états pure `envoi-commande.ts`, `creerCommande` dans `client.ts`. 85 tests et typecheck à code 0 ; mutations tuées (clé d'idempotence, refus `sur_place`, contrôle du jeton, relance automatique, rejeu mémorisé, verrous de fermeture, remise à zéro par compte, délai). Relecture indépendante en trois tours : I1 à I4 (doublon possible après modification du panier, erreur de clé muette, retour matériel pendant l'envoi, fuite entre comptes), N1 (refus au rejeu) et N2 (expiration de session) corrigés ; verdict final « prêt ».
- **Mineurs reportés :** N4 « Réessayer » cliquable sans effet session expirée ; N5 message « panier non vidé » vu seulement à la réouverture ; N6 déconnexion volontaire pendant un envoi incertain efface le corps et la clé (accepté par le plan) ; M4 à M8 du premier rapport non traités.
- **Non vérifié :** rendu réel de l'écran, enchaînement des Modals (risque sur iPhone), présence de `crypto.randomUUID`/`getRandomValues` sous Hermes (sans eux l'envoi est refusé, jamais une clé faible ; solution `expo-crypto` non ajoutée), envoi réel contre le serveur (aucune commande TEST faite depuis l'application). Pas de test d'interface.
- **Reste :** vérification sur émulateur d'une compilation contenant ce lot (puis une commande TEST depuis l'application, sur feu vert distinct) ; lot B (livraison) ; lot C (déclaration du règlement).
- 2 novembre 2026 : **compilation GitHub du lot A réussie** (run 41422207308, commit `690322a`, tests mobiles verts chez GitHub). **Vérifié à l'écran sur l'émulateur Android 14** (APK release `com.speedfood.clientdemo`, installée en neuf) : accueil (texte « Vous pouvez commander en retrait depuis le panier après connexion ; livraison et paiement en ligne pas encore disponibles »), menu du restaurant réel, ajout au panier (« 1 article(s) »), panier (sous-total indicatif 25 000 GNF, bouton « Commander en retrait »), écran « Valider ma commande » (récapitulatif, message « Connectez-vous pour envoyer votre commande » avec « Ouvrir mon compte », champs nom et téléphone, case de consentement, bouton « Envoyer ma commande » grisé). Enchaînement des fenêtres correct sur Android.
- **Toujours non vérifié :** connexion puis envoi réel (aucune commande TEST faite depuis l'application ; demande la saisie du mot de passe par Malika et son feu vert distinct) ; `crypto` sous Hermes jusqu'à un envoi réel ; iPhone. L'émulateur affiche par moments « Pixel Launcher isn't responding » : défaut de l'émulateur, pas de l'application.
