# Parcours d'entrée de l'application : choix du profil, compte, visite

Décidé avec Malika le 26 octobre 2026 (maquettes validées en conversation). Il remplace « logo, visite de 2 écrans, liste sans compte » du cadrage C0 (`PARCOURS-PREMIER-LANCEMENT.md`), dont les règles de fond restent vraies : aucune permission au lancement, le panier se conserve, rien n'est demandé avant d'être utile.

## Le parcours

1. **Logo animé** (1,5 s). Quelqu'un de **connecté** va directement à son espace (client : accueil, restaurateur : son espace). Un lien reçu (WhatsApp) ouvre sa fiche sans rien demander.
2. **Écran de choix** (premier lancement, ou après une déconnexion volontaire) : « Je veux commander », « J'ai un restaurant », et en bas « Livreur ou équipe Speedfood ? ».
3. **Compte** : Google en premier, puis e-mail et mot de passe (la **confirmation d'e-mail est conservée** et annoncée). Le bouton téléphone est **masqué** tant qu'aucun fournisseur d'envoi de code n'est choisi. Facebook n'apparaît que si l'interrupteur de `/system/parametres` est coché (voir `facebook-login-etat` dans la mémoire).
   - Consommateur : « Voir d'abord les restaurants » permet de parcourir sans compte (le compte reste demandé à l'envoi d'une commande).
   - Le nom et le téléphone ne sont **plus demandés** à la création du compte à l'entrée : ils le sont à la première commande.
4. **Visite guidée du profil**, 2 écrans, une seule fois par profil, juste après le compte (ou « Voir d'abord ») :
   - consommateur : « Les restaurants de votre zone », « Commandez, puis suivez » ;
   - restaurateur : « Speedfood tient votre fiche avec vous », « Des plats toujours à jour ».
5. **Consommateur** : accueil par zone. **Restaurateur** : formulaire d'inscription du restaurant (lots R1 à R4), puis suivi de la demande.

## Décisions de Malika

- Écran de choix puis compte ou « Voir d'abord » (pas de mur de compte à l'ouverture).
- Inscrire son restaurant = **demande de référencement traitée par l'équipe** ; délai annoncé : **48 h**.
- Connexion : Google, e-mail ; téléphone plus tard.
- Formulaire restaurateur en 5 étapes : restaurant (nom, quartier, adresse précise, téléphone), cuisine / horaires / paiements acceptés / services, logo et photo (facultatifs), menu complet (photo ou saisie), relecture et envoi.
- **Menu par photo (OCR)** : on réutilise le « Chef IA » existant (`docs/CHEF-IA.md`), avec relecture obligatoire, photo non conservée. Il doit aussi servir à **l'équipe Speedfood dans l'application** (lot R5).
- Photos et logo d'un candidat **refusé** : effacés **30 jours** après le refus.
- Rattachement du compte du candidat à la fiche créée : **semi-automatique** (proposé automatiquement, confirmé par l'équipe).

## Lots

| Lot | Contenu | État |
|---|---|---|
| E1 | Écran de choix, début selon le profil, profil mémorisé (effacé à la déconnexion volontaire) | Livré (26 octobre) |
| E2 | Compte à l'entrée : e-mail et mot de passe seulement, confirmation annoncée, « J'ai confirmé mon adresse : me connecter » | Livré |
| E3 | Visites par profil, une fois, après le compte | Livré |
| R1 | Demandes de référencement liées au compte (migration `20261026081154`, routes `/api/v1/candidature` et `/image`, dépôt privé `candidatures`, règles pures testées) | Livré (26 octobre) |
| R2 | Formulaire en 5 étapes dans l'application, brouillon gardé, suivi de la demande ; un restaurateur connecté rouvre l'application sur sa demande | Livré, joué dans l'émulateur de bout en bout (27 octobre) |
| R3 | Menu par photo : le moteur du Chef IA (route `/api/v1/candidature/menu-photo`, quota 6 par compte et par jour, photo non conservée), relecture ligne par ligne dans l'application, lignes écartées expliquées | Livré (27 octobre) ; la lecture par le modèle n'est testable qu'une fois le site déployé (binding Workers AI) |

**Correctif découvert en jouant R3 :** `PhotoAndroid` refusait TOUTE photo (la lecture des dimensions avec `inJustDecodeBounds` renvoie toujours `null`, traité à tort comme une erreur). Corrigé le 27 octobre ; la photo de plat du restaurateur et le logo du candidat en dépendaient.
| R4 | Suivi de la demande (48 h), dossier complet côté équipe, création de l'établissement avec reprise des plats, rattachement semi-automatique du compte, notification, effacement à 30 jours après refus | À faire |
| R5 | Menu par photo pour l'équipe, dans l'application (fiche d'un établissement) | À faire |

## Fichiers

`data/ProfilEntree.kt` (règles pures : écran après le logo, début, visite à proposer), `ui/ChoixProfil.kt`, `ui/ConnexionScreen.kt` (`inscriptionInitiale`, `onVoirDabord`, `avecContact`, `intro`), `ui/VisiteGuidee.kt` (deux séries), `App.kt` (phase `Choix`, routes `CreationCompteDestination` et `VisiteProfilDestination`), `SessionService.deconnecter` (efface le profil choisi). Tests : `ProfilEntreeTest`, `CommandeTest`.

## Restaurateur : état provisoire (R3 et R4 restent à faire)

Tant que R1 à R4 ne sont pas livrés, le restaurateur arrive après son compte sur l'espace professionnel existant (`AccesProScreen`) ; un restaurant pas encore référencé y est renvoyé vers la demande de référencement du site (`/restaurateurs`).
