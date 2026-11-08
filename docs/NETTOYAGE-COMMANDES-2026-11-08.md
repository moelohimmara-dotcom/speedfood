# Nettoyage des commandes en attente — espace restaurateur barbie food, 8 novembre 2026

## Périmètre et état

**Nettoyage terminé le 8 novembre 2026, par l'application Expo sur l'émulateur, sans déploiement, migration, secret ni relais modifié.** Les sections « À traiter » et « En cours » de l'espace restaurateur de barbie food sont passées de 8 commandes actives à **0**. Chaque geste a été fait depuis l'écran Commandes de l'application `com.speedfood.clientdemo` (prod debug, Metro local), avec la session réelle conservée de l'émulateur `speedfood_pixel`. Aucune lecture SQL indépendante : la preuve est l'interface des deux surfaces (restaurateur puis client), comme les contrôles précédents.

## Autorisations et méthode

- Parcours préalables de la même session, en lecture seule : catalogue réel, panier local (ajout, quantité, vidage confirmé, aucune commande envoyée), compte et suivi réels.
- Nettoyage des commandes TEST « À traiter » : oui explicite de Malika dans la conversation, après identification exacte des références.
- Nettoyage des « En cours » : oui explicite, puis **arrêt avant les deux commandes sans marque TEST** ; décision distincte de Malika après présentation des faits (vraies commandes du 12 octobre, effectuées selon son souvenir) : clôture comme terminées, pas annulation.
- Aucune action sur les réglages du service, le menu, la session (pas de déconnexion), ni sur aucune autre commande.

## Commandes TEST « À traiter » — annulées (4)

Chacune : bouton « Annuler la commande », confirmation « Oui, annuler la commande », message « Commande annulée », compteur décrémenté après relecture.

| Référence | Origine connue | Lecture restaurateur | Résultat |
|---|---|---|---|
| SF-P34U9 | Essai alerte API, 02/11, « NE PAS PREPARER » | À traiter (4) → (3) à 08:35 | Annulée |
| SF-K2M2P | Essai idempotence, 02/11, « NE PAS PREPARER » | (3) → (2) à 08:36 | Annulée |
| SF-SC78P | Étape 9, création via l'API, 01/11 11:21 | (2) → (1) à 08:37 | Annulée |
| SF-WMQXU | Étape 9, création via le site, 01/11 11:21 | (1) → (0) à 08:38, « Aucune commande » | Annulée |

Vérification croisée côté client, dans l'historique relu du compte : les quatre références affichent « Annulée ».

## Commandes TEST « En cours » — clôturées (2)

| Référence | État initial | Geste | Résultat |
|---|---|---|---|
| SF-BNZ6B | Prête, livraison, 02/11, « Test Malika / Test livraison », 25 000 GNF | « Marquer terminée » (seule clôture offerte à cet état) | « Commande marquée terminée » à 19:43, En cours (3) |
| SF-P76HU | Acceptée, retrait, 02/11, « ESSAI ALERTE API - NE PAS PREPARER », 25 000 GNF | Annulation confirmée (jamais préparée) | « Commande annulée » à 19:46, En cours (2) |

## Commandes réelles « En cours » — décision distincte (2)

Fait déclencheur de l'arrêt : deux cartes **sans marque TEST**, datées du 12 octobre 2026, acceptées mais jamais marquées prêtes.

| Référence | Détail lu à l'écran | Décision de Malika | Geste |
|---|---|---|---|
| SF-K94YB | Retrait 12/10 23:13, Famo youla, 2 × Jus d'orange + 1 × Poulet braisé = 90 000 GNF | Commande effectuée → terminer | Marquer prête, puis terminée à 19:57 |
| SF-6CZHJ | Livraison 12/10 16:41, Mr Camara, Kobaya bas-fond, 65 000 GNF | Commande effectuée → terminer | Marquer prête, puis terminée à 19:59 |

Règle appliquée, proposée par l'agent et acceptée : *terminée* affirme une commande honorée, *annulée* affirme une commande non honorée ; choisir selon le fait réel connu du propriétaire, jamais pour vider un compteur. Les transitions portent la date du 8 novembre dans l'historique de commande : la régularisation reste visible comme telle et ne réécrit pas les dates d'origine.

## État final vérifié

Capture de l'espace restaurateur relue à 19:59 : « À traiter (0) — Aucune commande », « En cours (0) — Aucune commande », « Historique récent (15) ». Les huit commandes sont en état terminal (annulée ou terminée). Aucune autre section touchée.

## Incident d'émulateur pendant le parcours

Avant le nettoyage des « En cours », l'espace restaurateur a affiché « Impossible de joindre Speedfood. Vérifiez votre connexion. » Diagnostic : l'API répondait depuis le poste (catalogue public 200) et le réseau IP de l'émulateur passait, mais le shell `adb` ne répondait plus — émulateur gelé, pas une panne du produit. Arrêt du lanceur seul insuffisant (le processus `qemu-system-x86_64.exe` enfant survivait et gardait le port 5554) ; arrêt du qemu, relance sans effacement (`-avd speedfood_pixel`, aucun wipe), démarrage complet, `adb reverse tcp:8081` rétabli, catalogue relu frais à 19:32:32. Session, panier et données de l'application conservés. Leçon à conserver : pour arrêter cet émulateur, tuer aussi le processus qemu enfant, sinon le port reste occupé et l'appareil fantôme répond à `adb devices` sans shell.

## Limites et retour arrière

- États terminaux **irréversibles depuis l'application** : pas de retour arrière par l'interface. Les commandes TEST annulées étaient des essais explicitement « NE PAS PREPARER » ; les deux commandes réelles ont été terminées sur instruction distincte du propriétaire, qui connaît leur existence réelle.
- Preuve par l'interface uniquement (écrans restaurateur et client relus après chaque geste), pas de lecture indépendante en base, conformément à la pratique des nettoyages précédents (SF-AA5TT, 6 novembre).
- Aucun déploiement, aucune migration, aucun secret lu ou modifié, aucune déconnexion ; l'émulateur et Metro sont restés en marche à la fin de la session.
- Le compte client historique contient toujours les autres commandes TEST en état terminal (historique récent 11 → 15) : aucun effacement de lignes n'a été fait ni demandé.
