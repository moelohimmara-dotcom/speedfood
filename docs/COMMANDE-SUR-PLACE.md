# Commande sur place : ardoise de table, comptoir, convive sans compte

Version 0.1 (lot S1) — 18 octobre 2026. Objectif de la propriétaire : faire de Speedfood l'outil par lequel les restaurants (fast-food, milieu de gamme, haut de gamme) laissent leurs convives **sur place** commander depuis leur téléphone. Réalité décrite par la propriétaire : on **paie après avoir mangé**, et la plupart des restaurants ont des **serveurs**.

## 1. Décisions (18 octobre 2026)

| Sujet | Décision |
|---|---|
| Validation par le personnel | Par défaut : **la première commande de chaque table**. Réglable par restaurant : aucune, première, toutes. |
| Fast-food | **Inclus dès S1** : mode « comptoir » avec numéro d'appel du jour. |
| Mode serveur (le serveur prend la commande d'un client sans smartphone) | **S2**, après le socle. |
| Compte | **Selon le restaurant** : compte exigé par défaut ; chaque restaurant peut autoriser un convive **sans compte**. |

### Dérogation au TDR v0.2 §5.1
Le TDR dit « aucune action en écriture sans compte identifié ; la commande invitée est supprimée ». La propriétaire a décidé le 18 octobre 2026 d'une **exception limitée** : commande **à table uniquement**, et **seulement** dans les restaurants qui l'ont activée (`restaurants.table_sans_compte`, désactivée par défaut). Garde-fous : un convive sans compte est **toujours validé par le personnel** au moins à la première commande de la table (même si le restaurant a choisi « aucune validation ») ; les plafonds par adresse et par restaurant restent ; l'anti-robot reste ; la commande est marquée `invite` (pastille « Sans compte » dans la console) ; le serveur **revérifie** le réglage à l'envoi (jamais lu du navigateur). Le téléphone devient facultatif **pour toute commande à table** (avec ou sans compte).

## 2. Le modèle : l'ardoise de table

- Quand un convive envoie une commande à table, il **ouvre ou rejoint la session de la table** (`table_sessions`) : une seule session ouverte par table (casse ignorée). Deux convives qui scannent le même QR arrivent sur la **même ardoise** (table partagée).
- **L'addition** = somme des sous-totaux des commandes de la session, hors commandes refusées ou annulées. Montants en GNF entiers.
- Le convive voit l'ardoise dans son suivi (articles et prénom des commandes de la table, **jamais le téléphone ni l'adresse**), et peut **Appeler le serveur** ou **Demander l'addition** (une fois par minute et par table).
- Le personnel clôture avec **« Table réglée »** et le mode de règlement (espèces, Orange Money, MTN MoMo). **Speedfood n'encaisse rien.** La clôture passe les commandes servies à « terminée », marque leur règlement « reçu » et rend possible la notation. Une commande encore **en attente** bloque la clôture (il faut l'accepter ou la refuser). « Annuler la table » n'est possible que sans commande acceptée.
- Un convive qui tente une 2ᵉ commande après clôture ouvre une **nouvelle session** de la même table.

## 3. Trois façons de servir (réglage du restaurant : `QR de tables`)

| | Fast-food (comptoir) | Milieu de gamme (table) | Haut de gamme (table) |
|---|---|---|---|
| `service_table` | `comptoir` | `table` | `table` |
| QR | Un seul QR « Comptoir » | Un QR par table | Un QR par table |
| Validation conseillée | aucune | première commande | toutes |
| Ce que voit le client | **Numéro d'appel** (gros) ; « prête : présentez ce numéro » | Ardoise de la table, appel serveur, addition | idem |

Comptoir : pas de session ; chaque commande reçoit un **numéro d'appel unique par restaurant et par jour** (Conakry est à l'heure UTC), recalculé en cas de collision. « Première commande » n'a pas de sens au comptoir : seule « toutes » valide tout, le convive sans compte est toujours validé.

## 4. Validation par le personnel (`src/lib/table/regles.ts`, testé)

`validationRequise({ reglage, tableDejaValidee, sansCompte })` : un convive sans compte avec « aucune » retombe sur « première » ; « toutes » valide toujours ; « première » valide tant que la table n'a pas été validée. **Validée** = un membre a accepté une commande de la table (hook dans `appliquerTransitionStatut`) ou a utilisé « Valider et envoyer en cuisine » dans la Salle. Sans validation requise, la commande est créée puis **acceptée automatiquement** (`systeme:table_sans_validation`) et arrive en cuisine ; un échec de cette étape annule la commande plutôt que de la laisser à moitié créée.

## 5. Écrans

- **Convive** : `/commande` (formulaire adapté : à table seulement, prénom et téléphone facultatifs) puis `/suivi#…` (ardoise, appel, addition ; numéro d'appel au comptoir).
- **Restaurateur** : **Salle** (`/restaurant/salle`, entrée de la colonne de gauche) : tables ouvertes triées par urgence (à valider, appel, addition demandée), détail, addition, « Valider et envoyer en cuisine », « J'y vais », mode de règlement + « Table réglée », « Annuler la table » ; rafraîchie toutes les 10 s, bip quand une table demande quelque chose de plus. Les commandes à valider déclenchent aussi le carillon et la pastille « à traiter » existants. **QR de tables** : réglages (service, sans compte, validation) et QR « Comptoir ». **Commandes** : pastilles « N° 42 » et « Sans compte ».
- **Administration** : la fonctionnalité reste pilotée par l'interrupteur global `commande_a_table` (Paramètres) ; le restaurant doit en plus avoir activé « Service à table ». Pas de nouvel écran admin dans ce lot (voir §8).

## 6. Données (migration `20261018180000_commande_a_table_ardoise.sql`)

`restaurants.service_table / table_sans_compte / table_validation` (modifiables par le restaurant, contraintes en base) ; `table_sessions` (RLS : le restaurant concerné et l'exploitation lisent ; **écritures par le serveur seulement**) ; `orders.session_id / numero_appel / invite` (protégées contre toute modification par un membre : déclencheur étendu, avec `table_numero` et `client_user_id`) ; index unique du numéro d'appel par jour. 19 contrôles de cloisonnement.

## 7. Sécurité et vie privée

- Écritures de session uniquement par le serveur, après vérification : appartenance au restaurant (salle), jeton de suivi de la commande (convive).
- Un convive ne voit que l'ardoise de SA table (via le jeton de sa commande) ; limites de débit : 30 appels / 10 min / adresse, un appel par minute et par table.
- Données du convive sans compte : prénom (ou « Table N ») et téléphone facultatif ; même conservation que les autres commandes (`CONSERVATION-ET-CONFIDENTIALITE.md`).
- **Risque connu** : les convives d'un restaurant partagent souvent la même connexion Wi-Fi, donc la même adresse ; le plafond par adresse (10 commandes / 10 min) peut gêner un service chargé. À surveiller au pilote ; relevable dans `limitation-debit.ts`.

## 8. Limites et suite (lots suivants)

- **S2 (fait, voir §9)** : mode serveur (prise de commande sur le téléphone du serveur). **Reste de S2** : validation par table plus fine dans la Salle, hors-ligne.
- **S3** : services du haut de gamme (entrée, plat, dessert « lancés » par le serveur), allergies et notes.
- **S4** : partage de l'addition entre convives, pourboire des serveurs, tampons de fidélité, tableau de bord du gérant.
- Écran admin dédié (restaurants avec service sur place, sessions ouvertes, convives sans compte) : à ajouter.
- **Essai du 18 octobre 2026** (restaurant de démonstration « barbie food », réglages rétablis et données de test supprimées ensuite) : commande à table SANS compte envoyée depuis un QR (`?table=7`), session ouverte, commande « en attente » car table non validée ; appel du serveur et demande d'addition enregistrés, répétition refusée avant 60 s ; table validée (simulée en base) : 2ᵉ convive sur la MÊME session, commande acceptée automatiquement (historique `systeme:table_sans_validation`), addition 65 000 GNF affichée aux deux ; mode comptoir : numéro d'appel 1, aucune session. **Non essayé** : toutes les actions du personnel (Salle : valider, « J'y vais », « Table réglée », annuler ; réglages), qui demandent une connexion de restaurateur, et l'affichage du gros numéro d'appel côté client. Parcours **à jouer** avec de vrais comptes et un vrai restaurant ; à faire pendant le pilote d'un restaurant milieu de gamme (mesurer : part des tables qui commandent par QR, temps de service, commandes par table).

## 9. Mode serveur (lot S2)

Le serveur ouvre **Salle → Prendre une commande** (`/restaurant/salle/saisie`) : il indique la table (suggestion des tables ouvertes ; au comptoir, aucun numéro à saisir), un prénom facultatif, choisit les plats avec quantités et suppléments, et envoie.

- **Rattachée au compte du serveur** : colonne `orders.saisie_par` (migration `20261018220000_commande_saisie_personnel.sql`, protégée contre toute modification par un membre). Même traçabilité qu'une commande de client.
- **Vraie commande, pas un test** : contrairement à une commande passée avec un compte de l'équipe (qui est marquée « test » et exclue des chiffres), une commande saisie en salle compte dans les chiffres du restaurant.
- **Directement en cuisine** : le personnel est la validation ; la commande est acceptée aussitôt (historique `restaurant:<compte>`) et valide la table.
- **Mêmes garde-fous qu'un client** : prix, disponibilité et suppléments recalculés côté serveur ; le total vu à l'écran est comparé au total recalculé (écart signalé, rien créé) ; clé d'idempotence (un double envoi ne crée pas deux commandes) ; plafond de débit ; le serveur revérifie que le compte est bien membre du restaurant, que la commande est à table, et que le service à table est activé.
- **Rejoint l'ardoise** : la commande s'ajoute à la session de la table, comme celles des convives.

Limites : pas de téléphone du convive (pas de suivi sur son téléphone, sauf s'il scanne le QR) ; pas de modification ni d'annulation d'une ligne après envoi (à passer par la console Commandes) ; pas de saisie hors connexion.

**Essai du 18 octobre 2026 (S2)** — la logique de création a été appelée directement, avec un vrai membre du restaurant de démonstration (route temporaire locale, supprimée ensuite ; données de test supprimées et réglages rétablis) :
- commande valide table 12 (1 riz + 2 poulets, 105 000 GNF) : créée, **acceptée tout de suite**, `est_test` faux, `saisie_par` = le membre, historique `restaurant:<membre>`, table **validée** ;
- même clé rejouée : même commande, marquée idempotente (pas de doublon) ;
- total affiché faux (1 000 au lieu de 105 000) : refusé, le vrai total est renvoyé ;
- saisie au nom d'un compte qui n'est PAS membre : refusée (`NON_AUTORISE`) ;
- 2ᵉ commande sur la même table : même session, acceptée, 2 commandes, 1 seule session ouverte.
**Non essayé** : l'écran de saisie lui-même et la Salle (connexion de restaurateur nécessaire) ; les suppléments et le mode comptoir en saisie serveur.

## 10. Salle : requêtes regroupées

`tablesOuvertes` lit toutes les tables ouvertes et leurs commandes en **deux requêtes** quel que soit le nombre de tables (avant : deux par table, ce qui aurait dépassé la limite de sous-requêtes d'un Worker au-delà d'une vingtaine de tables, avec un rafraîchissement toutes les 10 s). Vérifié le 18 octobre 2026 avec 3 tables et 4 commandes : totaux 50 000 / 65 000 / 120 000 GNF corrects.

## 11. Écran « Service et QR » repensé (18 octobre 2026)

`/restaurant/tables` devient **Service et QR**, en trois étapes sur une seule page, dans un jeu d'onglets avec **Salle** et **Prendre une commande** (la page fait partie de la section Salle de la navigation).

1. **Activer** : un vrai interrupteur « Service sur place » ; désactivé, les réglages sont grisés (« Activez le service pour régler ces options »).
2. **Choisir** : trois **profils en un clic** (Fast-food : comptoir et aucune validation ; Restaurant : à table et première commande validée ; Haut de gamme : à table et toutes les commandes validées), puis deux grandes cartes « À table » / « Au comptoir » avec ce que voit le client, « Faut-il un compte ? » (détail replié) et la validation. **Un profil ne touche jamais à « commander sans compte »** : c'est une dérogation au TDR que le restaurateur décide lui-même ; avec « sans compte » et « aucune validation », l'écran rappelle que la première commande de chaque table sera quand même validée. Les réglages qui ne correspondent à aucun profil sont signalés « Personnalisé ».
3. **Imprimer** : nombre de tables avec − et + (la planche suit, sans bouton), exemple affiché tant qu'aucun nombre n'est choisi, QR « Comptoir » unique en mode comptoir.

**Un seul enregistrement** : barre fixe (« Modifications non enregistrées », Annuler, Enregistrer ; Ctrl/Cmd + S ; confirmation avant de fermer l'onglet), au-dessus de la barre de navigation du bas sur téléphone. Une ligne de synthèse en tête résume l'état enregistré. Avant un changement de mode ou une désactivation, l'écran indique combien de tables sont ouvertes et ce qui leur arrive (elles gardent leur fonctionnement, seules les nouvelles commandes changent). Action serveur unique : `enregistrerServiceSurPlaceAction` (remplace deux actions et deux composants).

**Essai** (page temporaire avec données factices, supprimée) : interrupteur et réglages grisés, profils, carte choisie, rappel de validation, « Personnalisé », message sur les tables ouvertes, annulation. **Non essayé** : l'enregistrement réel et l'écran avec une session de restaurateur.
