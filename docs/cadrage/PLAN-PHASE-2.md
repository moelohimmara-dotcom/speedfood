# Plan d'exécution : phase 2 (livraison, carte, avis, promotions)

**Date :** 13 octobre 2026
**Référence :** `docs/cadrage/TDR-v0.2-proposition.md`, §12 (phasage) et §18 (aucune exécution sans validation)
**Statut :** proposition à valider. Aucun code de phase 2 n'est écrit tant que ce plan n'est pas approuvé.

---

## 1. Périmètre de la phase 2

Reprend le §12 du TDR v0.2 :
- livraison par le restaurant (mode 1), livraison choisie par le client avec livreur indépendant ou entreprise inscrite (mode 2), retrait (mode 4) ;
- comptes livreurs indépendants et entreprises de livraison ;
- carte et guidage (Google Maps Essentials complété par OpenStreetMap) ;
- avis et notes vérifiés ;
- promotions simples (codes par restaurant, plafonds, dates).

Hors phase 2 : paiement mobile money en production (phase 3), fidélité et gamification (phase 3), mise en avant payante (phase 3), prestataire de livraison délégué (phase 4).

## 2. Préalables bloquants

Ces points ne dépendent pas du code. Sans eux, les blocs correspondants restent à l'arrêt.

| Préalable | Qui | Bloque |
|---|---|---|
| Compte de facturation Google Cloud (carte bancaire) avec plafond d'usage et alerte à 1 $ | Malika, ou autorisation écrite | Blocs 4 et 5 (carte, itinéraire) |
| Choix du fournisseur de tuiles OpenStreetMap pour un usage réel | Malika, après chiffrage | Mise en production de la carte |
| Avis juridique guinéen sur l'inscription des livreurs et la vérification d'identité | Malika, avec un conseil | Bloc 3 (comptes livreurs) |
| Décision de conservation des pièces d'identité (durée, chiffrement, région d'hébergement) | Malika | Bloc 3 |
| Procédure terrain de recrutement des premiers livreurs et entreprises | Malika | Bloc 6 (activation) |
| Vérification SMS (OTP) en Guinée : fournisseur à choisir (Orange SMS, Twilio Verify ou Vonage Verify), essai, coût et couverture. **Prévu, non lancé** : Malika reste sur Facebook et Google en attendant | Malika choisit le fournisseur et autorise l'essai | Vérification du numéro avant les écritures (TDR v0.2 §5.1). **Décision provisoire (13 oct. 2026)** : numéro déclaré accepté sans vérification, indicateur « non vérifié » sur le compte ; confirmation exigée une fois le SMS en service |
| Connexion Facebook (présente dans le code) : application Meta configurée et approuvée | Malika (compte développeur Meta) ou autorisation écrite | Mise en service de la connexion Facebook |
| Connexion Google : projet Google Cloud et client OAuth | Malika ou autorisation écrite | Connexion Google (à construire, avant le bloc 2) |

## 3. Blocs de travail

Chaque bloc a un périmètre, une dépendance et un critère de fin. Un bloc ne démarre que si son prédécesseur est accepté.

### Bloc 0 : cadrage technique (sans code de production)
**Statut (13 octobre 2026) : VALIDÉ**, avec les réserves suivantes, à lever avant mise en service :
- seuil de 18 ans et validité de la déclaration d'âge (déclaration sans document, décision du 13 octobre) ;
- conservation des pièces d'identité des livreurs : activité puis 12 mois (décision du 13 octobre), à confirmer juridiquement ;
- paiement en ligne réservé aux comptes à numéro vérifié ; mode démonstration séparé (décision du 13 octobre) ;
- statut juridique de la plateforme pour le paiement, à confirmer par un juriste.
Document : `docs/cadrage/BLOC-0-SCHEMAS-ET-AUTORISATIONS.md`.
- Rédiger les schémas de données : `zones_livraison`, `livreurs`, `entreprises_livraison`, `courses`, `avis`, `codes_promo`, `utilisations_promo`, `ecritures_repartition` (valeurs GNF entières).
- Matrice d'autorisations par acteur (client, restaurant, livreur, entreprise, support, modération).
- **Identification obligatoire (TDR v0.2 §5.1)** : toute action en écriture exige un compte identifié, avec téléphone vérifié et identité déclarée ; la commande invitée est retirée du modèle. Chaque écriture porte l'identifiant du compte et une trace d'audit.
- **Trois méthodes de connexion** : Facebook (existant), Google (à construire), téléphone par OTP (à construire). Quel que soit le moyen, le numéro est vérifié par OTP avant toute écriture.
- Critère de fin : schémas et matrice relus et validés.
- Dépendance : aucune.

### Bloc 1 : géographie (ville, commune, quartier)
**Statut (13 octobre 2026) : migration écrite, non appliquée.** Fichier `supabase/migrations/20261013100000_geographie_villes_communes.sql` ; rattachement des quartiers existants à faire par la propriétaire.
- Table de référence géré par le CMS (ajout, renommage, fusion, historique).
- Rattachement des restaurants et des adresses clients à la hiérarchie.
- Filtrage et classement du catalogue par commune et quartier.
- Critère de fin : un restaurant et une adresse sont rattachés à un quartier ; le catalogue se filtre par quartier ; test de bout en bout en base.
- Dépendance : bloc 0.

### Bloc 2 : modes de livraison et cycle de commande
- Ajout des états `en_preparation`, `en_livraison`, `livree`, `retiree` au cycle existant, avec les transitions autorisées et historisées.
- Choix du mode par commande selon ce que le restaurant accepte.
- Mode 1 (livraison par le restaurant) et mode 4 (retrait) en premier, parce qu'ils n'ont besoin d'aucun compte livreur.
- Critère de fin : une commande en mode 1 et une en mode 4 passent de bout en bout, les transitions impossibles sont rejetées (tests unitaires et en base).
- Dépendance : blocs 0 et 1.

### Bloc 3 : comptes livreurs et entreprises
- Inscription, vérification manuelle des pièces, activation par l'équipe.
- Espace livreur : disponibilité, courses acceptées, gains.
- Espace entreprise : liste de livreurs rattachés, responsable désigné.
- Pièces d'identité chiffrées, accessibles au seul service de vérification.
- Critère de fin : un livreur inscrit ne voit une course qu'après activation ; un livreur ne voit que ses courses et sa zone.
- Dépendance : bloc 2 ; préalables juridiques et de conservation levés.

### Bloc 4 : carte et guidage
- Carte interactive : fond OpenStreetMap, attribution obligatoire ; recherche d'adresse et itinéraire via Google Maps Essentials.
- Géocodage mis en cache côté serveur pour limiter les appels facturables.
- Localisation du client avec accord explicite ; position conservée seulement pendant une commande active.
- Critère de fin : la carte s'affiche sur mobile ; un itinéraire est calculé ; le nombre d'appels Google par jour est mesuré et reste sous le plafond fixé.
- Dépendance : bloc 1 ; compte de facturation Google créé (préalable).

### Bloc 5 : suivi du livreur en temps réel
- Position du livreur pendant une course active, fréquence limitée.
- Affichage client sur la carte.
- Critère de fin : la position se met à jour sans vider la batterie ; elle disparaît à la fin de la course.
- Dépendances : blocs 3 et 4.

### Bloc 6 : preuve de livraison et litiges
- Code à 4 chiffres remis au client, ou photo, selon le mode.
- Fenêtre de litige et décision tracée par le support ou la modération.
- Critère de fin : une livraison sans code valide n'est pas marquée livrée ; un litige ouvert bloque le paiement du livreur.
- Dépendances : blocs 2 et 3.

### Bloc 7 : avis et notes
- Notes réservées aux clients ayant reçu une commande.
- Modération a posteriori, réponse du restaurant, signalement.
- Limitation de débit contre les avis en masse.
- Critère de fin : un client ne peut pas noter une commande non reçue ; un avis signalé passe en file de modération.
- Dépendance : bloc 2.

### Bloc 8 : promotions simples
- Codes par restaurant, plafond d'utilisation, dates, premier achat.
- Le serveur calcule la remise ; un seul code par commande.
- Financement de la remise (restaurant, plateforme ou mixte) enregistré dans les écritures.
- Critère de fin : le total serveur intègre la remise ; un code expiré ou épuisé est refusé ; l'écriture de répartition est juste.
- Dépendance : bloc 2.

### Bloc 9 : recette, sécurité et mise en production
- Tests de bout en bout : commande livrée par le restaurant, commande confiée à un livreur, retrait, avis, promotion, litige.
- Revue de sécurité par un agent indépendant (`docs/cadrage/PROCEDURE-SECURITE.md`), `get_advisors(security)` après chaque migration touchant RLS.
- Déploiement uniquement après feu vert explicite de Malika.
- Dépendance : blocs 1 à 8.

## 4. Ordre et dépendances

```
0 cadrage
├── 1 géographie
│   ├── 2 modes et cycle de commande
│   │   ├── 3 comptes livreurs (bloqué : préalables juridiques)
│   │   │   ├── 5 suivi temps réel
│   │   │   └── 6 preuve et litiges
│   │   ├── 7 avis
│   │   └── 8 promotions
│   └── 4 carte (bloqué : compte Google)
└── 9 recette et mise en production (après 1 à 8)
```

Les blocs 2 (modes 1 et 4), 7 et 8 peuvent avancer tant que les préalables de Malika ne sont pas levés. Les blocs 3, 4 et 5 attendent ces préalables.

## 5. Risques

- **Livraison par des tiers sans contrôle de qualité** : seuls les livreurs activés voient les courses ; évaluation des livreurs par les clients (bloc 7 étendu).
- **Dépassement du forfait Google** : plafond d'usage, alerte, cache, mesure quotidienne (bloc 4).
- **Données de localisation** : conservation limitée à la course, accord explicite.
- **Charge de la modération** : file de traitement dimensionnée avant le lancement.
- **Dépendance à Chap Chap Pay** pour les reversements : la phase 2 fonctionne en espèces et en code marchand ; le paiement en ligne reste en phase 3.

## 6. Décisions demandées

1. Approuver le découpage en blocs 0 à 9 et l'ordre des dépendances.
2. Autoriser le bloc 0 (schémas et matrice d'autorisations), qui ne touche ni la production ni un service externe.
3. Décider qui crée le compte Google Cloud et quand.
4. Lancer le conseil juridique (préalable du bloc 3).

## 7. Ce que ce plan ne fait pas

Il ne déploie rien, ne crée aucun compte, ne souscrit aucun service et n'engage aucune dépense. Chaque bloc fera l'objet d'un compte rendu et d'une validation avant le suivant.
