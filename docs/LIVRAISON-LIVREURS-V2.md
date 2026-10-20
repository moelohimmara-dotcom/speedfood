# Livreurs du restaurant et livreurs indépendants : spécification

**Version :** 0.1, 20 octobre 2026. **Statut : conception validée en discussion avec Malika le 20 octobre 2026 ; rien n'est implémenté.** Complète `docs/LIVRAISON.md` (modèle, dispatch, suivi) et `docs/LIVREURS.md` (fiche, cycle de vie, approbation, lien d'activation). En cas de contradiction, ce document gouverne les points qu'il traite. **Cadre juridique : voir `docs/CADRE-JURIDIQUE-LIVREURS.md` (§13 ci-dessous en reprend les conséquences de conception).**

## 1. Objectif

Faire de la livraison une fonction complète de Speedfood, à la manière des plateformes de livraison, avec deux sources de livreurs :

1. **Livreurs indépendants Speedfood** : toute personne peut déposer une candidature ; l'exploitation vérifie et approuve ; les livreurs approuvés forment un groupe commun qui reçoit les offres de course.
2. **Livreurs du restaurant** : un restaurant inscrit ses propres livreurs, les affecte à ses commandes et, par étapes, leur donne un accès à la console livreur.

## 2. Décisions prises (20 octobre 2026)

| Sujet | Décision | Réserve |
|---|---|---|
| Livreurs du restaurant | **Trois étapes** : (1) registre simple piloté par le restaurant, (2) console livreur par lien WhatsApp, (3) offres en priorité aux livreurs du restaurant | |
| Rémunération des indépendants | **100 % des frais de livraison au livreur** pour le pilote ; le modèle de données prévoit déjà la part de Speedfood pour la changer plus tard | Valeur du pilote, pas une décision définitive |
| Argent du repas | **Au choix du client**, avec plafonds : repas payé d'avance (mobile money au restaurant) ou espèces à la livraison | Option la plus complexe ; **tous les montants et délais sont des valeurs factices de simulation** (voir §6) |
| Frais de livraison | **Toujours payés en espèces au livreur, à la porte**, même si le repas est payé d'avance | Choix de conception de ce document |
| Repli sur le groupe Speedfood | **Désactivé par défaut** pour chaque restaurant | |
| Pièce d'identité des indépendants | **Exigée** (et contact d'urgence), car ils manipulent de l'argent | Valeur de simulation, réglable (voir §6) |
| Option « Livreur Speedfood » | **Masquée tant qu'il n'y a pas de livreur actif dans la zone** | Supprime le risque de commandes bloquées (§8) |
| Filtre « livreurs sérieux » et revenu côté livreur | **Niveaux de confiance** gagnés par la performance. Le **frais de dossier unique** est **conçu mais INACTIF au pilote** et **ne doit pas être activé avant un avis juridique** (art. 110.5 et 523.21 du Code du travail : voir §13). **Pas de système de points payés pour accéder aux courses.** | Décision du 20 octobre 2026, ajustée le même jour après lecture du Code du travail |

## 3. Ce qui existe déjà (ne pas refaire)

- Table `livreurs` avec cycle de vie `cree → invite → candidat → actif ⇄ suspendu → archive`, approbation par l'exploitation, dossier (pièce, contact d'urgence) lisible du seul super administrateur, lien d'activation à usage unique.
- Console `/livreur` : disponibilité, offres chronométrées, navigation, statuts, code de remise ; position envoyée toutes les 8 secondes.
- Répartition par offres au livreur disponible le plus proche (délai 45 s par défaut, rayon 15 km), livreurs simulés pour la démonstration.
- Mode de livraison du restaurant : `restaurants.livraison_mode` = `aucune`, `propre` ou `speedfood`. En mode `propre`, la livraison est créée « assignée » **sans livreur nommé** : c'est le restaurant qui appuie sur « Je pars livrer » puis « Livrée » avec le code du client.

## 4. Ce qui change : modèle de données (proposé)

Chaque migration appliquée en base a son fichier dans `supabase/migrations/` dans le même commit, puis `get_advisors(type: "security")` (règle du projet). Toutes les écritures passent par le serveur (clé de service) ; les policies réservées aux membres portent `to authenticated`.

**`livreurs`** (colonnes ajoutées)
- `restaurant_id uuid null references restaurants(id)` : `null` = groupe Speedfood ; renseigné = livreur du restaurant, qui ne reçoit que ses courses.
- `origine text` : `exploitation`, `auto_inscription`, `restaurant`.
- `verifie_speedfood boolean default false` : vrai seulement après approbation par l'exploitation ; les livreurs d'un restaurant restent « non vérifiés par Speedfood » tant qu'ils ne sont pas approuvés.
- `quartier_base_id uuid null`, `rayon_km numeric null` (zone de travail déclarée).
- `mobile_money_numero text null` (numéro pour recevoir des paiements ; jamais affiché au client).
- `niveau smallint not null default 1` (1 ou 2, indépendants seulement) ; `courses_reussies integer not null default 0` ; `niveau_modifie_le timestamptz null`.
- `dossier_reference text null` (référence de paiement du frais de dossier, ex. `SF-LIV-4F7K`, unique) ; `dossier_paye_le timestamptz null` ; `dossier_paye_par uuid null references auth.users(id)` (l'agent qui a confirmé).
- `dossier_statut text not null default 'aucun'` (`aucun`, `a_payer`, `paye`, `rembourse`, `acquis`) ; `verification_appel_le timestamptz null` ; `verification_par uuid null` ; `decision_le timestamptz null` ; `rembourse_le timestamptz null` ; `rembourse_montant_gnf integer null` ; `motif_remboursement text null` ; `rembourse_par uuid null`.
- Unicité du téléphone : parmi les fiches non archivées **du groupe Speedfood** ; **par restaurant** pour les livreurs d'un restaurant (une même personne peut livrer pour deux restaurants).

**`restaurants`** (colonne ajoutée) : `livraison_repli_speedfood boolean not null default false` (offres du restaurant qui passent au groupe Speedfood si aucun de ses livreurs n'accepte).

**`livraisons`** (colonnes ajoutées) : `paiement_repas text` (`avance` ou `especes`), `frais_encaisses_gnf integer` (confirmé par le livreur à la remise), `bascule_le timestamptz null` (réaffectation vers un livreur du restaurant).

**`livraison_gains`** (nouvelle) : `livraison_id`, `livreur_id`, `frais_gnf`, `part_livreur_gnf`, `part_speedfood_gnf default 0`, `cree_le`. Une ligne par course livrée ; permet de changer la répartition sans reconstruire.

**`livraison_especes`** (nouvelle) : `livraison_id`, `livreur_id`, `restaurant_id`, `montant_gnf` (repas encaissé), `statut` (`a_reverser`, `remis`, `confirme`, `litige`), `remis_le`, `confirme_le`, `echeance_le`. Une ligne par livraison payée en espèces.

**`parametres_livraison`** (colonnes ajoutées) : `livreur_inscription_ouverte boolean default false` ; `independant_piece_requise boolean default true` ; `independant_urgence_requise boolean default true` ; `plafond_panier_especes_gnf integer default 60000` ; `plafond_especes_livreur_gnf integer default 150000` ; `delai_reversement_heures integer default 24` ; `frais_dossier_gnf integer default 10000` ; `frais_dossier_actif boolean default false` ; `paiement_dossier_instructions text null` (texte affiché au candidat : numéro mobile money Speedfood et consigne, **saisi par Malika**, jamais dans le code) ; `politique_remboursement jsonb null` (pourcentages par situation, validé par le serveur) ; `delai_decision_jours integer default 5` ; `delai_remboursement_heures integer default 72` ; `courses_pour_niveau2 integer default 10` ; `valeurs_validees_le timestamptz null` (vide tant que Malika n'a pas validé les valeurs : l'écran des réglages affiche alors « valeurs de simulation »). **Les valeurs par défaut sont des valeurs de simulation (§6).**

## 5. Règles métier

### Inscription du livreur indépendant
1. Page publique **« Devenir livreur »** (`/devenir-livreur`) : nom, téléphone (+224), véhicule, quartier de base, numéro mobile money, pièce d'identité et contact d'urgence (selon les réglages), acceptation des conditions.
2. Protection contre les abus : anti-robot Turnstile et limitation de débit par IP, comme les formulaires existants. Aucun SMS de vérification au pilote (coût) : la vérification est l'**appel de l'exploitation** avant approbation.
3. La candidature crée une fiche `candidat` (`origine = auto_inscription`, `restaurant_id = null`). L'exploitation approuve ou refuse avec motif (refus : archivage). Seul un livreur `actif` peut se mettre en ligne.
4. Le candidat doit avoir un compte Speedfood (connexion ou création) : un compte, une fiche (règle existante).

### Frais de dossier (livreurs indépendants)
4a. Réglage `frais_dossier_actif` : **éteint par défaut et à laisser éteint tant qu'un avocat n'a pas validé** (§13). Le mécanisme est construit pour pouvoir être activé sans développement le jour où le cadre juridique le permet. Allumé, l'inscription affiche le montant (`frais_dossier_gnf`), les **instructions de paiement saisies par Malika** et une **référence unique** (`dossier_reference`) à indiquer dans le transfert mobile money. **Aucun paiement n'est collecté par l'application** : pas d'intégration, pas d'encaissement par Speedfood au sens technique.
4b. L'exploitation, en vérifiant la réception, coche **« dossier payé »** (date et agent enregistrés). Un dossier non payé reste `candidat` et ne peut pas être approuvé tant que le frais est actif.
4c. Le frais couvre la **vérification** (appel, contrôle de la pièce). Il est **unique** : jamais prélevé à la course. Le livreur ne paie rien pour accéder à une offre.
4d. **Politique de remboursement : voir « Politique de remboursement du frais de dossier » ci-dessous.** Elle est affichée AVANT le paiement et se lit dans les réglages ; l'interface n'annonce jamais autre chose que ce qui est réglé.

### Politique de remboursement du frais de dossier
**Ne s'applique que si le frais est un jour activé (voir §13).** Principes : le frais paie un **service réel** (vérification de la pièce, appel). Un candidat ne perd donc de l'argent que si ce travail a été **effectivement fait**, et jamais par la faute ou le silence de Speedfood. Chaque cas est objectif (une date enregistrée), jamais une appréciation au cas par cas.

Jalons enregistrés (colonnes ajoutées, §4) : `dossier_paye_le`, `verification_appel_le` (l'agent a joint ou tenté de joindre le candidat), `decision_le`.

| Situation | Remboursement | Pourquoi |
|---|---|---|
| Paiement en double, mauvaise référence, erreur de montant | **100 %** | Erreur, pas un frais dû |
| Candidat qui renonce **avant** l'appel de vérification | **100 %** | Aucun travail n'a été fait |
| Refus **avant** l'appel (dossier incomplet, pièce illisible, hors zone) | **100 %** | Le service de vérification n'a pas eu lieu |
| Aucune décision de Speedfood dans le délai annoncé (`delai_decision_jours`, simulation : 5 jours) | **100 %**, sur simple demande | Un silence ne doit pas coûter au candidat |
| Candidat qui renonce **après** l'appel | **0 %** (frais acquis) | Le travail de vérification est fait |
| Refus **après** l'appel pour motif lié au candidat (pièce fausse ou ne correspondant pas, comportement) | **0 %** | Vérification faite, motif imputable au candidat |
| Refus **après** l'appel pour un motif **non imputable** (pas de besoin dans sa zone, quota atteint) | **100 %** | Ce n'est pas la faute du candidat |
| Approuvé | **0 %** | Le service a été rendu |

- Les pourcentages et le délai sont des **valeurs de simulation réglables** (colonne `politique_remboursement`, validée côté serveur) ; ils ne sont jamais en dur dans le code.
- **Mode de remboursement :** par mobile money, vers le numéro du candidat, sous `delai_remboursement_heures` (simulation : 72 heures), **frais de transfert à la charge de Speedfood**. Le remboursement est journalisé (`dossier_statut`, `rembourse_le`, `rembourse_montant_gnf`, motif, agent).
- **Reçu :** le candidat reçoit à la confirmation de paiement un récapitulatif (référence, montant, date, politique applicable) qu'il peut conserver, et un second à chaque remboursement.
- **Transparence :** le texte des conditions d'utilisation et l'écran de paiement sont **générés à partir des réglages** : la politique affichée est toujours celle qui s'applique.
- **Variante à garder en tête (non retenue pour le pilote) :** ne rien faire payer à l'avance et prélever le frais sur les premières courses. Elle supprime les remboursements, mais exige de suivre une dette du livreur envers Speedfood (même mécanique que les espèces à reverser).

### Livreurs du restaurant
5. **Étape 1 : registre.** Le restaurateur (permission restaurant) ajoute, modifie, archive des livreurs : nom, téléphone, véhicule. Ces fiches sont créées `actif` avec `origine = restaurant`, `verifie_speedfood = false`. Sans compte : le restaurateur fait avancer la livraison (« Parti », « Livrée » avec le code).
6. **Affectation :** sur la carte de commande, « Livreur : [choix] ». Un livreur n'est proposé que s'il appartient à ce restaurant et n'est pas archivé. L'affectation est journalisée.
7. **Étape 2 : console par lien.** Le restaurateur envoie le lien d'activation (même mécanisme que l'existant, limité au restaurant) ; le livreur active, voit **uniquement** les courses de ce restaurant, partage sa position, et le client suit la carte.
8. **Étape 3 : offres en priorité.** Une livraison `speedfood` d'un restaurant qui a des livreurs actifs propose d'abord aux livreurs du restaurant (même délai) ; si personne n'accepte, repli sur le groupe Speedfood **seulement** si `livraison_repli_speedfood` est vrai ; sinon la livraison reste à assigner et le restaurant peut affecter lui-même.

### Argent
9. Les frais de livraison (calculés par le serveur) sont **payés en espèces au livreur à la remise**. Le livreur confirme le montant encaissé en saisissant le code du client.
10. **Repas payé d'avance** (mobile money confirmé par le restaurant dans sa console) : le livreur ne détient que ses frais ; aucun reversement.
11. **Repas payé en espèces** : proposé seulement si le panier est inférieur ou égal à `plafond_panier_especes_gnf` **et** si le livreur reste sous `plafond_especes_livreur_gnf` avec l'encaissement. Au-delà, la course exige un paiement d'avance ou n'est pas proposée à ce livreur.
12. **Reversement :** après une livraison en espèces, une ligne `a_reverser` est créée ; le livreur déclare « remis » ; le restaurant confirme. Échéance `delai_reversement_heures`. Un livreur dont une échéance est dépassée **ne peut plus se mettre en ligne** jusqu'à régularisation. Un désaccord passe en `litige` et remonte à l'exploitation.
13. **Gains :** chaque course livrée crée une ligne `livraison_gains` (100 % au livreur au pilote). Speedfood **ne paie pas** les livreurs au pilote : les frais sont encaissés en espèces par le livreur ; l'écran de gains est informatif.

### Niveaux de confiance (livreurs indépendants)
13a. **Niveau 1 (nouveau livreur).** N'est proposé que pour des livraisons dont le **repas est payé d'avance** : son plafond d'espèces en poche est **zéro**. Il peut encaisser ses frais de livraison (règle 9), qui sont les siens.
13b. **Niveau 2.** Atteint après `courses_pour_niveau2` livraisons **réussies** (statut `livree`, code de remise saisi) sans litige ni retard de reversement ouvert. Il lève la restriction : les livraisons en espèces lui sont proposées, dans la limite de `plafond_especes_livreur_gnf`.
13c. **Rétrogradation.** Un litige d'espèces non résolu en sa faveur, ou un reversement en retard (règle 12), le remet au niveau 1 ; l'exploitation peut aussi le rétrograder ou le suspendre avec motif (journalisé).
13d. Les niveaux ne s'appliquent qu'aux livreurs du groupe Speedfood : le risque d'espèces d'un livreur de restaurant est celui du restaurant, qui le connaît.
13e. Le niveau est calculé et modifié **par le serveur** ; le livreur le voit (« niveau 1 : encore N courses avant le niveau 2 »), jamais il ne peut le changer.

## 6. Valeurs de simulation (précisé par Malika le 20 octobre 2026)

**Les montants, délais et exigences ci-dessous sont des valeurs FACTICES, à titre de simulation.** Les valeurs réelles seront saisies plus tard par Malika. Conséquences pour la construction :

1. **Aucune de ces valeurs n'est écrite en dur dans le code.** Chacune vit dans `parametres_livraison` (ou `restaurants` pour le repli) et se modifie depuis `/system/parametres/livraison`, sans déploiement ni migration.
2. Les valeurs initiales de la migration sont celles du tableau, **marquées « valeurs de simulation » dans l'écran des réglages** (bandeau visible tant que Malika ne les a pas validées une première fois), pour qu'on ne les prenne pas pour des décisions.
3. Les tests utilisent leurs **propres** valeurs, passées en paramètres : aucun test ne dépend d'un montant du tableau.
4. Le prix d'une course (base + prix au kilomètre) reste réglé comme aujourd'hui dans `/system/parametres/livraison` ; cette spécification n'y touche pas.

| Paramètre | Valeur de simulation | Réglage |
|---|---|---|
| Plafond de panier en espèces | 60 000 GNF | `plafond_panier_especes_gnf` |
| Plafond d'espèces en poche d'un livreur | 150 000 GNF | `plafond_especes_livreur_gnf` |
| Délai de reversement | 24 heures | `delai_reversement_heures` |
| Pièce d'identité des indépendants | Exigée | `independant_piece_requise` |
| Contact d'urgence des indépendants | Exigé | `independant_urgence_requise` |
| Repli sur le groupe Speedfood | Désactivé par défaut | `restaurants.livraison_repli_speedfood` |
| Frais de dossier (indépendants) | 10 000 GNF, désactivé par défaut | `frais_dossier_gnf`, `frais_dossier_actif` |
| Courses réussies pour passer au niveau 2 | 10 | `courses_pour_niveau2` |
| Délai de décision annoncé au candidat | 5 jours | `delai_decision_jours` |
| Délai de remboursement | 72 heures | `delai_remboursement_heures` |
| Remboursements par situation | tableau de la politique ci-dessus | `politique_remboursement` |

## 7. Écrans

- **Public :** `/devenir-livreur`.
- **Restaurant :** `/restaurant/livreurs` (registre, activation, archivage) ; sélecteur « Livreur » dans la carte de commande ; « Espèces à recevoir » (confirmer les reversements) ; réglage du repli.
- **Livreur :** `/livreur` existant, avec « Espèces à reverser », gains du jour, indicateur de plafond.
- **Exploitation :** `/system/livraisons/livreurs` existant (filtre « Candidats à approuver »), avec origine, restaurant de rattachement, litiges d'espèces.

## 8. Garde-fou : option « Livreur Speedfood » masquée sans livreur

Situation actuelle (20 octobre 2026) : l'option est ouverte aux restaurateurs depuis le 17 octobre ; **sans livreur réel en ligne, une commande en livraison reste en « recherche d'un livreur » indéfiniment**, ce qui est inacceptable pour un client réel.

Règle : l'option n'est **sélectionnable** que s'il existe au moins un livreur **actif, non simulé**, à moins de 15 km du restaurant, dont la dernière position date de moins de 7 jours. Un restaurant déjà configuré dont la condition cesse d'être vraie repasse en livraison propre pour les **nouvelles** commandes (message dans sa console). Une livraison déjà créée reste affectable à la main par le restaurateur (**bascule**, `bascule_le` renseigné).

## 9. Sécurité et vie privée

- Pièce d'identité, contact d'urgence, numéro mobile money : lisibles par le **super administrateur** seulement, comme le dossier existant ; jamais envoyés au navigateur d'un restaurant, d'un client ou d'un autre livreur.
- Le restaurant ne voit que ses livreurs et ses livraisons ; un livreur du restaurant ne voit que les courses de ce restaurant ; un indépendant ne voit que ses courses et ses offres.
- La position d'un livreur n'est jamais envoyée avec son téléphone au client (règle existante).
- Durées de conservation des dossiers et des positions à ajouter à `docs/CONSERVATION-ET-CONFIDENTIALITE.md`.
- Tests de cloisonnement à ajouter à `npm run test:cloisonnement` pour chaque nouvelle table et policy ; `get_advisors(security)` après chaque migration.

## 10. Lots (chacun livré, testé et déployé séparément, sur « déploie » de Malika)

| Lot | Contenu | Critère d'acceptation |
|---|---|---|
| **1** | Garde-fou §8 ; colonnes `restaurant_id`, `origine`, `verifie_speedfood` ; registre « Mes livreurs » ; affectation sur la carte de commande ; étape 1 complète | Un restaurateur ajoute un livreur, l'affecte à une commande, la fait avancer jusqu'à « Livrée » ; l'option Speedfood est invisible sans livreur actif |
| **2** | Page `/devenir-livreur` ; protection anti-abus ; réglages d'inscription ; **frais de dossier avec référence et confirmation manuelle, INACTIF par défaut (§13)** ; approbation avec origine visible | Une candidature apparaît chez l'exploitation ; sans frais actif, elle est vérifiée et approuvée gratuitement ; frais actif (hors pilote) : référence de paiement et case « dossier payé » ; approuvée, la personne peut se mettre en ligne |
| **3** | Lien d'activation pour les livreurs du restaurant ; console limitée à ce restaurant ; position et carte pour le client | Un livreur du restaurant active son lien, voit ses seules courses, et le client le suit |
| **4** | Priorité d'offre aux livreurs du restaurant ; repli optionnel ; bascule | Une offre va d'abord aux livreurs du restaurant ; sans acceptation, repli seulement si autorisé |
| **5** | Argent : mode de paiement du repas, plafonds, reversement avec confirmation, gains, blocage en cas de retard ; **niveaux de confiance** (niveau 1 sans espèces, niveau 2 après N courses réussies, rétrogradation) | Un livreur de niveau 1 ne reçoit jamais de course en espèces ; il passe au niveau 2 après N courses réussies ; un reversement en retard empêche la mise en ligne ; un litige remonte à l'exploitation |

## 11. Hors périmètre (à ne pas faire ici)

**Système de points payés pour accéder aux courses** : écarté le 20 octobre 2026 (voir la discussion : revenu faible, freine le recrutement, intérêts mal alignés avec le client, encaissement et réglementation à vérifier). Dépôt de garantie remboursable : possible plus tard, après avis juridique, en lien avec le plafond d'espèces.
Paiement des livreurs par Speedfood, paiement par carte, application native, notation des livreurs par les clients, pourboires, planning des livreurs, assurance. Les livreurs de démonstration restent pour la démonstration et n'entrent pas dans les calculs du garde-fou.

## 12. Questions ouvertes

1. **Cadre juridique et assurance** des livreurs indépendants en Guinée (statut, accidents, responsabilité). À établir par Malika avant de recruter de vrais livreurs ; ce document ne le remplace pas.
2. Conditions d'utilisation à rédiger pour les livreurs (inscription et activation).
3. Valeurs réelles du §6 : **à saisir par Malika quand elles seront connues** (ce sont aujourd'hui des valeurs de simulation, réglables sans déploiement).
4. Vérification du téléphone par message : exclue du pilote pour éviter un coût ; à reconsidérer si la fraude apparaît.
5. Qui contacte les candidats pour l'appel de vérification, et sous quel délai ?
6. **Politique de remboursement :** une proposition complète est écrite ci-dessus ; il reste à **la valider** et à obtenir un **avis juridique** sur le fait de faire payer un travailleur pour s'inscrire (je ne suis pas juriste et n'ai pas vérifié le droit guinéen).
7. **Numéro mobile money de réception des frais de dossier :** fourni par Malika le 20 octobre 2026 ; **volontairement absent de ce document et de tout le dépôt** (le dépôt GitHub est public). Il se saisit dans les réglages de livraison (`paiement_dossier_instructions`) et ne figure jamais dans le code, les migrations ni les tests. Contrôle des réceptions : Malika. À envisager : un compte marchand ou un numéro dédié, et l'affichage du **nom du titulaire** pour que le candidat vérifie à qui il paie.
8. Durée de conservation des dossiers des livreurs archivés (12 mois proposés dans `LIVREURS.md`, à valider).

## 13. Garde-fous juridiques de conception (20 octobre 2026)

Voir `docs/CADRE-JURIDIQUE-LIVREURS.md` pour les textes lus, les limites de ma lecture et les questions pour un avocat. **Je ne suis pas juriste.** Conséquences retenues pour la conception :

1. **Inscription et vérification gratuites pour le livreur au pilote.** Le Code du travail interdit aux services d'emploi privés de faire payer les chercheurs d'emploi (art. 110.5) avec une amende égale au triple de la somme demandée (art. 523.21). Faute de certitude que Speedfood n'en est pas un, le frais est **construit mais inactif**. Le revenu de Speedfood vient du restaurateur (frais par commande, test à blanc) et, plus tard, d'une commission sur les courses livrées.
2. **Ni points d'accès, ni dépôt de garantie, ni kit obligatoire payant** avant avis juridique. Une alternative inspirée de Swiggy et Zomato (un **objet** optionnel, vendu à prix coûtant, déduit des gains) sera examinée avec l'avocat, pas construite.
3. **Indépendance du livreur, pour limiter le risque de requalification en salarié (art. 121.1)** :
   - le livreur peut **refuser** toute offre sans pénalité ; refuser n'abaisse pas son niveau ;
   - **aucune exclusivité** : il peut livrer pour d'autres plateformes ou restaurants ;
   - **aucun horaire imposé**, aucune présence minimale ;
   - il utilise **son propre véhicule et son téléphone** ;
   - les suspensions ne sanctionnent que la **fraude, la sécurité et les espèces non reversées**, avec motif écrit, jamais l'activité insuffisante ;
   - les conditions d'utilisation sont rédigées comme un **contrat de prestation de services** (à faire relire par l'avocat) ;
   - le prix de la course (base + km) est présenté comme **le tarif du service**, visible avant l'acceptation.
4. **Minimisation des données.** Par défaut, le serveur **ne conserve pas le numéro de la pièce d'identité** : il conserve le **résultat** (« pièce vérifiée le [date] par [agent] », type de pièce). Nouveau réglage `conserver_numero_piece` (faux par défaut) et nouvelle colonne `livreur_dossiers.piece_verifiee_le`. Le contact d'urgence est un tiers : il n'est demandé que si le réglage l'exige, et jamais affiché ailleurs que chez le super administrateur.
5. **Information et consentement** : chaque formulaire du livreur affiche **qui collecte, pourquoi, combien de temps** les données sont gardées, et recueille un consentement explicite. Une durée de conservation est écrite dans `docs/CONSERVATION-ET-CONFIDENTIALITE.md` avant l'ouverture des inscriptions.
6. **Formalités sur les données personnelles** : tenir à jour la liste des traitements (pièce, téléphone, position) et leur finalité, pour pouvoir **déclarer** auprès de l'autorité dès qu'elle sera opérationnelle ; l'hébergement de la base est en **Irlande** (`eu-west-1`), à signaler à l'avocat.
7. **Argent** : aucun paiement de livreur à Speedfood sur un **numéro de particulier** ; si un jour un frais est activé, il passe par un compte marchand ou un numéro dédié, avec nom du titulaire affiché. Les espèces du repas restent entre le livreur et le restaurant (reversement confirmé, §5) : Speedfood ne détient pas leur argent.
8. **Aucune activation commerciale** (frais, dépôt, points) sans la **checklist d'avis juridique** du §6 de `CADRE-JURIDIQUE-LIVREURS.md` traitée et la décision de Malika notée dans ce document.
