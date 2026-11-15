# Préparation Android 3.0.2 — 15 novembre 2026

Demande de Malika dans la conversation : préparer une APK Android de contrôle
avec les corrections, vérifier son fonctionnement sur l'émulateur, puis diffuser
la nouvelle version aux utilisateurs sur `/installer` (cible confirmée).

Version candidate : **3.0.2, code 102**, identité `com.speedfood.mobile`.
L'APK de contrôle conserve `com.speedfood.clientdemo` et doit inclure x86_64.
La candidate pour téléphones conserve arm64-v8a et armeabi-v7a.

## Contenu

- Défilement des champs code de remise et raison d'échec au-dessus du clavier.
- Transport Expo explicite pour refuser les redirections des écritures livreur,
  sans second envoi ni repli après erreur.
- Délai global de 20 secondes conservé pendant la lecture du corps ; réponses
  tardives après annulation refusées après en-têtes et après lecture.
- Bancs et tests reproductibles, sans inclusion des bancs dans les écrans produit.

Preuves préalables : 793 tests mobiles verts, TypeScript sans erreur ;
redirections et délais vérifiés sur émulateur avec le code chargé par Metro.
Ces essais ne constituent pas encore la preuve d'une APK autonome : le nouvel
artefact de contrôle doit être installé sans effacement puis essayé sans Metro.

## Ordre de livraison

1. Vérifications et commits séparés sur la branche de travail existante.
2. Compilation CI de contrôle et compilation candidate depuis le même code.
3. Contrôle des manifestes, architectures, empreintes et de l'absence de bancs.
4. Installation de la release de contrôle par `adb install -r` ; démarrage sans
   Metro, catalogue, session conservée et espaces vérifiés sur émulateur.
5. Signature de la candidate **par Malika seule**, saisie masquée via le script
   `apps/mobile/scripts/signer-candidat.ps1`. L'agent ne lit ni clé ni mot de passe.
6. Vérification publique du certificat et contrôle de la candidate signée.
7. Envoi R2, mise à jour du seul bloc `mobile`, contrôles et déploiement API/site,
   puis vérification de l'APK publique et de la version annoncée sur `/installer`.

Le téléchargement historique `/speedfood.apk` et les champs de version Kotlin
restent intacts. La version 3.0.1 reste annoncée jusqu'à disponibilité de la
candidate signée et contrôlée. Aucun APK de contrôle ne doit être publié sous
le téléchargement principal des utilisateurs.

Notes de version proposées : « Formulaires livreur plus accessibles avec le
clavier. Actions livreur mieux protégées contre les redirections et les réponses
trop lentes, sans nouvel envoi automatique. »

Ce document décrit la préparation ; compilation, essai du nouvel artefact,
signature et diffusion doivent être consignés séparément une fois réalisés.
