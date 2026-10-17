# Notation : avis des clients, des restaurants et des livreurs

**Version :** 0.1, 18 octobre 2026. **Statut : conception validée par la propriétaire (décisions ci-dessous) ; implémentation en cours (voir §8).**

## 1. Décisions de la propriétaire

| Sujet | Décision |
|---|---|
| Qui note qui | **Dans les deux sens** : le client note le restaurant et le livreur ; le restaurant et le livreur notent le client |
| Commentaires | **Publics, modérés après coup** (restaurant et livreur notés par le client) |
| Affichage public | **Moyenne et nombre d'avis, à partir de 5 avis** ; en dessous « Nouveau » |
| Conséquences | **Le classement du catalogue tient compte de la note, du prix des plats et de la fréquentation** (précisé le 18 octobre 2026) |

**Garde-fous ajoutés par l'agent, à valider** : la note du **client** reste **privée** (exploitation seulement), **sans commentaire libre** (étiquettes et note) ; le classement n'utilise la note qu'**à partir de 5 avis** et sur une moyenne **lissée**.

## 2. Les notes d'une commande

Une commande **terminée** peut donner lieu à, au plus, ces notes (une de chaque sorte) :

| Cible | Auteur | Quand | Public ? |
|---|---|---|---|
| **Restaurant** | le client | commande terminée (retrait, à table ou livraison) | **Oui** (moyenne, avis, réponse) |
| **Livreur** | le client | livraison livrée | **Non** : le livreur et l'exploitation voient ; aucune note de livreur n'est publique |
| **Client** | le restaurant | commande terminée | **Non** : exploitation seulement |
| **Client** | le livreur | livraison livrée | **Non** : exploitation seulement |

**Pas de note** sur une commande de **test**, **refusée**, **annulée**, ni sur une livraison **échouée**.

## 3. Ce qu'une note contient

- **1 à 5 étoiles** (entier).
- **Étiquettes** choisies dans une **liste fermée** par cible (jamais de texte libre dans les étiquettes) :
  - restaurant : plat chaud, bonnes portions, emballage soigné, prêt à l'heure, bon rapport qualité-prix ; (négatives) plat froid, portions petites, emballage abîmé, erreur dans la commande, long à préparer ;
  - livreur : rapide, aimable, soigneux ; (négatives) en retard, peu aimable, commande abîmée ;
  - client (privé) : agréable ; (négatives) injoignable, adresse incorrecte, impoli, a annulé à la porte.
- **Commentaire** facultatif, 500 caractères au plus, **seulement** pour une note du client sur le restaurant ou le livreur.

## 4. Règles

1. **Une seule note par commande et par cible** ; modifiable **24 heures**, puis figée.
2. **Délai** : 14 jours après la clôture de la commande.
3. **Identité** : l'auteur doit être la personne de la commande (le client connecté qui l'a passée, un membre du restaurant de la commande, le livreur de la course). Un restaurateur ne note jamais son propre restaurant.
4. **Affichage du commentaire** : prénom seulement, jamais téléphone ni adresse. Les notes du livreur et du client ne sont jamais publiques.
5. **Réponse** : le restaurant peut répondre une fois, publiquement, à l'avis d'un client (500 caractères au plus).
6. **Signalement** : le restaurant (ou le livreur) signale un avis qui le concerne ; l'exploitation décide. Deux décisions : **masquer le commentaire** (la note reste) ou **annuler la note** (exclue des calculs, en cas de fraude). Motif obligatoire, journalisé.
7. **Moyenne affichée** : à partir de **5 avis publiés**, moyenne simple arrondie à une décimale ; en dessous, « Nouveau ». **Moyenne lissée** pour le classement : `(10 × 4,0 + somme des notes) ÷ (10 + nombre d'avis)` (5 avis à 5,0 ne devancent donc pas 30 avis à 4,5) (un restaurant avec un seul avis à 5 n'écrase pas les autres).
8. **Classement du catalogue** : voir §9 (note, prix et fréquentation).
9. **Alertes à l'exploitation** (sans effet automatique) : restaurant ou livreur sous 3,5 avec au moins 5 notes ; livreur avec 3 notes de 2 ou moins de suite ; client avec 3 notes de 2 ou moins en 90 jours.
10. **Conservation** : notes du client privées, 12 mois ; avis publics tant que le restaurant existe, anonymisés (prénom effacé) à la suppression du compte du client.

## 5. Données

- `avis` : commande, cible (`restaurant`, `livreur`, `client`), auteur, note, étiquettes, commentaire, prénom affiché, statut (`publie`, `commentaire_masque`, `annule`), réponse du restaurant, copie de « commande de test », dates. Unique par (commande, cible, auteur).
- `avis_signalements` : avis, signalé par, motif, traité.
- `restaurants` : `avis_total` et `avis_somme` (agrégats publics, mis à jour par la base à chaque changement d'avis).
- **Aucune lecture publique directe** de la table : les pages publiques lisent côté serveur, colonnes choisies, sans identifiant de compte.

## 9. Classement du catalogue : note, prix, fréquentation

Ajouté à la demande de la propriétaire (18 octobre 2026) : le classement tient compte de **trois critères**, tous explicables et réglables.

| Critère | Mesure | Score de 0 à 1 |
|---|---|---|
| **Note** | moyenne lissée des avis publics, **à partir de 5 avis** | `(lissée − 1) ÷ 4` ; **0,5** (neutre) en dessous de 5 avis |
| **Prix** | **prix typique** du restaurant = médiane des prix de ses plats disponibles (prix promo compris) | rang centile parmi les restaurants : **le moins cher = 1** ; 0,5 sans plat |
| **Fréquentation** | **commandes terminées** (hors test) sur les 30 derniers jours (réglable) | rang centile : **le plus demandé = 1** ; 0,5 si personne n'a de commande |

**Score global** (0 à 100) = `poids note × note + poids prix × prix + poids fréquentation × fréquentation`, avec des poids réglés par le super administrateur (somme 100 ; **par défaut 50 / 20 / 30**) dans `/system/parametres/classement`.

Règles :
- les restaurants **ouverts** passent toujours avant les fermés, et un plat exact confirmé garde la priorité (règles existantes de `classement.ts`) : le score global ne départage qu'**à l'intérieur** d'un groupe ;
- un critère sans donnée vaut **0,5** : jamais de bonus ni de malus inventé ; à égalité, l'ordre d'origine est conservé ;
- le client peut **changer le tri** : *Recommandés* (score global), *Mieux notés*, *Moins chers*, *Plus populaires* ;
- des **pastilles** expliquent le rang : « Très bien noté » (note forte avec 5 avis au moins), « Prix doux » (parmi les moins chers), « Populaire » (parmi les plus commandés) ;
- aucune promotion payante, aucun signal caché.

**Choix à connaître** : « moins cher = mieux classé » est une hypothèse (les plateformes valorisent souvent l'abordabilité ; elle peut aussi pousser vers le bas de gamme). Le poids du prix est volontairement modéré (20) et réglable ; la note et la fréquentation compensent.

**Limite du début** : avec peu de restaurants et peu de commandes, la fréquentation et la note seront neutres pour presque tous ; le classement ressemblera à l'actuel jusqu'aux premiers volumes.

## 6. Ce qui reste hors de cette version

Photos d'avis, avis vérifiés par achat tiers, notation des délais de préparation mesurés automatiquement, classement par distance pondéré par la note, avis en plusieurs langues.

## 7. Risques déclarés

- **Faible volume** : au début, très peu de restaurants atteindront 5 avis ; le classement par note ne jouera presque pas, c'est voulu.
- **Avis de complaisance ou de représailles** : une note par commande réelle, délai court, signalement et annulation par l'exploitation ; pas de garantie absolue.
- **Note du client** : c'est du profilage ; elle reste privée, sans texte libre, effacée après 12 mois, et le client peut en demander l'effacement (voir `CONSERVATION-ET-CONFIDENTIALITE.md`).

## 8. Étapes

| Étape | Contenu | État |
|---|---|---|
| N1 | Règles pures (validation, étiquettes, moyenne, lissage, fenêtres) et classement composite avec tests ; migration `20261018010000` (avis, signalements, agrégats, fréquentation, réglages du classement) ; 31 contrôles de cloisonnement | **Fait, migration non appliquée** |
| N2 | Le client note après sa commande (suivi) ; moyenne et avis sur les cartes et les fiches des restaurants ; réponse du restaurant ; signalement | **Fait et déployé le 18 oct. (migration appliquée) ; parcours non encore joué en navigateur** |
| N3 | Le restaurant et le livreur notent le client ; console d'exploitation (modération, alertes) ; classement du catalogue (note, prix, fréquentation), tri au choix, réglages `/system/parametres/classement` | **Fait sauf : note du client par le livreur (action prête, pas encore d'écran dans la console livreur)** |
