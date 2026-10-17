# Parcours de test complet avant d'enrôler des restaurants

**Version :** 0.1, 17 octobre 2026. **But :** jouer, du début à la fin et avec de vrais comptes, ce que vivra un restaurateur enrôlé puis son premier client, avant d'ouvrir à de vrais restaurants. Ce document dit aussi ce qui a été **vérifié** avant l'essai et ce qui reste à **constater**.

## 0. Avant de commencer (vérifié le 17 octobre 2026)

| Contrôle | Résultat |
|---|---|
| Site en ligne, pages publiques | Répondent (surveillance manuelle, 15 h 15) |
| Version en production | `ff565497`, notée dans `PLAN-INCIDENT.md` §8 |
| Secrets du Worker présents (noms seulement) | `COMMANDE_JETON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `VAPID_PRIVATE_KEY` |
| Sauvegarde | Export du 17 octobre vérifié restaurable ; tâche hebdomadaire de nouveau active |
| Cloisonnement entre restaurants | 129 contrôles automatiques passent |
| Alertes de sécurité Supabase | Rien d'inattendu ; reste la protection contre les mots de passe divulgués (offre Pro) |

**À faire par la propriétaire avant le premier restaurant réel** (aucun agent ne peut le faire) :
1. **E-mails d'inscription** : dans Supabase, Authentication, Emails (ou SMTP Settings), regarder si un **service d'envoi personnalisé** est configuré. Le service par défaut de Supabase est très limité (quelques e-mails par heure, pour tout le projet) : si vous enrôlez plusieurs restaurants le même jour, les e-mails de confirmation peuvent ne pas partir. Noter ce qui est affiché. Un service d'envoi personnalisé est un compte externe, éventuellement payant : **décision de la propriétaire**.
2. `/system/parametres` : numéro WhatsApp d'assistance, textes d'accueil (voir `REPRISE-SESSION.md` §8, point 6).
3. Contacts du plan d'incident (`PLAN-INCIDENT.md` §1) : au moins vous et une personne de secours.
4. Téléphone réel de test : un smartphone avec Chrome (Android) ou Safari (iPhone), pour la partie restaurateur.

## 1. Comptes et matériel de test

| Rôle | Adresse | Où |
|---|---|---|
| Restaurateur de test | `moelohimmara+resto1@gmail.com` (arrive dans votre boîte habituelle) | téléphone, ou Chrome |
| Administrateur | votre compte habituel | Chrome, autre fenêtre |
| Client | **un compte client est obligatoire pour commander** (page `/commande` : identification exigée, TDR v0.2 §5.1) : créer `moelohimmara+client1@gmail.com` par `/entrer` | **fenêtre de navigation privée** (Ctrl+Maj+N) |

Notez les heures : elles servent à lire les journaux en cas de problème.

## 2. Déroulé

Pour chaque étape : **Attendu** et, à droite, ce que vous constatez (OK, gêne, bloqué). Toute gêne est utile : c'est elle que vos vrais restaurateurs rencontreront.

### A. Le restaurateur s'inscrit
1. `https://speedfood-app.moelohimmara.workers.dev/inscription`, adresse `+resto1`, mot de passe de 12 caractères ou plus. **Attendu** : un mot de passe plus court est refusé avec un message clair ; « Vérifiez votre boîte mail ».
2. Ouvrir le mail de confirmation (arrive-t-il ? en combien de temps ? dans les spams ?), cliquer. **Attendu** : arrivée sur le site réel.
3. Se connecter. **Attendu** : « Configurons votre établissement ».
4. Créer l'établissement (nom, catégorie, quartier). **Attendu** : arrivée dans la console, restaurant **non publié**.

### B. Le restaurateur prépare sa page (depuis un téléphone si possible)
5. Hub « Mon restaurant » : photo, logo, horaires, moyen de paiement, quartier et zones de livraison, documents d'identité. **Attendu** : chaque carte passe à « Prêt » et la progression suit.
6. Menu : ajouter 3 plats (un avec option), un prix en GNF entier. **Attendu** : aucun montant à virgule ; l'ordre se retrouve sur la page publique.
7. Ouvrir/fermer le restaurant, le menu du jour. **Attendu** : l'état change et se retrouve sur la fiche publique.

### C. L'administrateur valide
8. `/system`, section « À traiter » : le restaurant apparaît. Ouvrir sa fiche, bloc « Décision ». **Attendu** : la liste de ce qui bloque ou non, puis **Approuver** une fois les prérequis remplis (ou « Demander une correction » avec un message que le restaurateur voit).
9. Après approbation : la fiche publique du restaurant s'ouvre pour un visiteur. **Attendu** : visible dans le catalogue de sa zone, pas ailleurs.

### D. Le premier client commande (fenêtre privée)
9 bis. **Créer le compte client** (`/entrer`), confirmer son adresse par le mail reçu, se connecter. **Attendu** : mail de confirmation reçu (spams ?), arrivée sur « Mon compte ». Ce parcours consomme un mail de plus sur la limite de 30 par heure.
10. Choisir la zone, trouver le restaurant, ajouter des plats au panier. **Attendu** : prix identiques à ceux saisis, total correct, frais de livraison cohérents.
11. Passer la commande connecté (nom, téléphone, adresse si livraison ; préremplis si le compte a déjà des coordonnées). Le contrôle anti-robot s'affiche. **Attendu** : commande envoyée, page de suivi ; **copier l'adresse de suivi** (elle est la seule clé de la commande).
12. Une seconde commande **depuis le compte du restaurateur** avec `?vue=test` sur la fiche : **Attendu** : marquée « Test », exclue des chiffres.

### E. Le restaurateur traite
13. Console ouverte (téléphone) : **Attendu** dans les 15 secondes : carillon, notification si autorisée, commande « À traiter ». Fermer l'onglet et recommencer une commande : une notification push arrive-t-elle ? (limite connue : voir `ALERTES-COMMANDES.md`).
14. Accepter, puis « Prête », puis « Terminée ». **Attendu** : le client voit chaque changement sur sa page de suivi, sans recharger plus de quelques secondes.
15. Essayer aussi : **refuser** une commande, et **proposer une modification** (prix ou délai) que le client accepte ou refuse depuis son suivi.
16. Émettre un reçu ou une facture (si le paiement est confirmé). **Attendu** : numéro séquentiel, montants exacts.

### F. L'administrateur regarde
17. `/system/commandes` : la commande apparaît avec des coordonnées **masquées**. Révéler les coordonnées avec un motif : **Attendu** : trace dans le journal d'audit (`/system/audit`).

### G. Remise en ordre
18. Dépublier le restaurant d'essai (ou le marquer comme données de démonstration) pour qu'il ne reste pas dans le catalogue. Supprimer le compte `+resto1` s'il ne sert plus (`/system/acces/comptes`, « Supprimer » ; un restaurant qui a des commandes n'est pas supprimé).
19. **Écrire** : ce qui a surpris, bloqué ou été long. Chaque point est soit corrigé, soit expliqué dans un guide pour les restaurateurs.

## 3. Limites connues à dire aux restaurateurs enrôlés

- La page de commandes doit rester ouverte ou l'application installée ; le son demande un premier geste ; un téléphone en veille peut retarder l'alerte (`ALERTES-COMMANDES.md` §3).
- Les journaux d'exécution gardent 7 jours les adresses de suivi des commandes (risque accepté par écrit le 7 octobre 2026).
- Le paiement est un code marchand affiché au client : Speedfood n'encaisse rien (`PAIEMENT-CODE-MARCHAND.md`).
- Une personne qui connaît le mot de passe d'un restaurateur voit ses commandes : conseiller l'activation de l'application d'authentification et, à défaut, les questions de sécurité (`QUESTIONS-SECURITE.md`).

## 4. Critères pour passer à de vrais restaurants

Tout le parcours A à F joué sans blocage ; les e-mails d'inscription arrivent de façon fiable ; au moins une notification arrive sur un vrai téléphone ; l'autorisation d'enrôler et de recevoir de vraies commandes a été **donnée le 17 octobre 2026** (voir `PROCEDURE-SECURITE.md`, section « Autorisation du 17 octobre 2026 ») ; le plan d'incident a un contact de secours.
