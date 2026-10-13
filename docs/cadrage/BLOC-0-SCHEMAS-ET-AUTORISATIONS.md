# Bloc 0 : schémas de données et matrice d'autorisations (phase 2)

**Date :** 13 octobre 2026
**Référence :** `docs/cadrage/PLAN-PHASE-2.md` (bloc 0), `docs/cadrage/TDR-v0.2-proposition.md`
**Statut :** proposition à relire. **Aucune migration n'est écrite ni appliquée** ; ce document ne touche ni la production ni un service externe.

---

## 1. Principes

- **Identification obligatoire** (TDR §5.1) : toute écriture porte l'identifiant d'un compte (`auth.users`) et une trace d'audit. Aucune commande invitée.
- **Connexion** : Facebook (présent), Google (à construire), téléphone (SMS prévu, non lancé). Période provisoire : numéro déclaré, indicateur `telephone_verifie = false` (décision du 13 octobre 2026).
- **Montants en GNF entiers** (`bigint`, jamais de flottant).
- **Recalcul serveur** : prix, remise, frais de livraison et répartition sont calculés côté serveur.
- **Isolation** : chaque ligne multi-acteurs est liée à un restaurant, un livreur ou une entreprise ; la RLS vérifie l'appartenance, pas un identifiant envoyé par le navigateur.
- **Réutilisation** : les tables existantes sont listées en §2 et ne sont pas recréées.

## 2. Existant réutilisé

| Table existante | Rôle actuel | Usage en phase 2 |
|---|---|---|
| `neighborhoods` | Quartiers | Base du bloc 1 (ajouter ville et commune au-dessus) |
| `restaurants` | Restaurants | Mode(s) de livraison acceptés, quartier, statut de publication |
| `restaurant_memberships` | Membres d'un restaurant | Équipiers et propriétaire, inchangé |
| `restaurant_identite_documents` | Identité fiscale du restaurant (raison sociale, NIF, RCCM, texte) : **une ligne par restaurant, aucun fichier** | Pas de modèle pour les pièces : le stockage chiffré des pièces des livreurs est nouveau |
| `client_profils` | Profil client : `pseudo` et `avatar` uniquement (`utilisateur_id` clé vers `auth.users`) | **Étendu** (nom, prénom, téléphone, indicateur de vérification) plutôt que recréé |
| `orders`, `order_items`, `order_item_options` | Commandes. Colonne `mode` existante limitée à `retrait` / `livraison`; `statut` limité à six valeurs; aucune colonne de compte (`client_telephone` seul) | Ajout de `client_user_id`, extension de `mode` et de `statut` (voir §3.7) |
| `order_status_events` | Historique des états (`acteur` en texte libre, pas un identifiant de compte) | Trace de chaque transition ; `acteur` devient un identifiant de compte pour les nouvelles écritures |
| `order_proposals` | Propositions de révision | Inchangé |
| `push_subscriptions` | Abonnements push | Inchangé |
| `rate_limits` | Limitation de débit | Ajout des actions avis et commande |
| `audit_events` | Journal d'audit | Toute action sensible y est écrite |

## 3. Nouvelles tables

Toutes les tables ont `id uuid`, `created_at`, et les colonnes d'audit `cree_par` (compte) lorsque l'écriture vient d'un utilisateur.

### 3.1 Géographie (bloc 1)
- **`villes`** : `id`, `nom`, `slug` unique, `actif`.
- **`communes`** : `id`, `ville_id` → `villes`, `nom`, `slug`, `actif`. Unique `(ville_id, slug)`.
- **`neighborhoods`** (existante) : ajouter `commune_id` → `communes` (nullable pendant la migration, puis obligatoire).
- **`zones_livraison`** : `id`, `restaurant_id`, `quartier_id` → `neighborhoods`, `frais_livraison_gnf bigint`, `actif`. Unique `(restaurant_id, quartier_id)`.

### 3.2 Comptes acteurs (blocs 2 et 3)
- **`client_profils`** (étendue, pas de nouvelle table) : ajouter `nom`, `prenom`, `telephone`, `telephone_verifie boolean default false`, `methode_connexion` (`facebook`, `google`, `telephone`), `age_declare_ge_18 boolean`, `statut` (`actif`, `suspendu`), `motif_suspension`. Les contraintes existantes (`pseudo`, `avatar`) restent en vigueur ; un profil incomplet ne doit jamais bloquer la création (leçon du 10 octobre sur `client_profils`).
- **`orders`** (extension) : `client_user_id uuid` nullable pendant la migration puis obligatoire pour toute nouvelle commande ; `mode` étendu à `retrait`, `livraison` ; `statut` étendu aux quatre états du §4.
- **`livreurs`** : `id`, `user_id` unique, `zone_id` → `communes`, `vehicule` (texte court), `statut` (`en_attente`, `actif`, `suspendu`, `radie`), `verifie_par`, `verifie_le`, `entreprise_id` nullable.
- **`entreprises_livraison`** : `id`, `nom`, `rccm`, `nif`, `responsable_user_id`, `statut` (`en_attente`, `active`, `suspendue`), `verifie_par`, `verifie_le`.
- **`livreur_documents`** : `id`, `livreur_id` ou `entreprise_id`, `type` (`piece_identite`, `justificatif`), `stockage_chemin` (fichier chiffré dans un stockage privé, hors bucket public), `statut_verification`, `verifie_par`. Ce modèle est **nouveau** : `restaurant_identite_documents` ne stocke pas de fichier. Le mécanisme de chiffrement reste à concevoir et à faire relire. Accès : service de vérification uniquement. Durée de conservation : pendant l'activité, puis 12 mois après la fin du compte, avec purge automatique (décision du 13 octobre 2026, à confirmer juridiquement ; TDR §14). Colonne `purge_le` à prévoir pour déclencher la suppression.

### 3.3 Livraison et courses (blocs 2, 3, 5, 6)
- **`courses`** : `id`, `commande_id` → `orders`, `mode_livraison` (`restaurant`, `client_choisit`, `prestataire`, `retrait`), `livreur_id` nullable, `entreprise_id` nullable, `statut` (`proposee`, `acceptee`, `en_cours`, `livree`, `annulee`), `code_remise_chiffres` (haché, jamais en clair), `code_valide_le`, `cree_par`.
- **`courses_positions`** (bloc 5) : `course_id`, `lat`, `lng`, `enregistre_le`. Purge automatique à la fin de la course.
- **`litiges`** : `id`, `commande_id`, `ouvert_par`, `motif`, `statut` (`ouvert`, `en_examen`, `clos`), `decision`, `decide_par`, `decide_le`.

### 3.4 Avis (bloc 7)
- **`avis`** : `id`, `commande_id` unique (un avis par commande), `auteur_user_id`, `restaurant_id`, `note smallint` (1 à 5), `commentaire` (longueur bornée), `statut` (`publie`, `en_moderation`, `retire`), `moderation_par`, `moderation_motif`.
- **`avis_signalements`** : `id`, `avis_id`, `signale_par`, `motif`, `traite_le`.

### 3.5 Promotions (bloc 8)
- **`codes_promo`** : `id`, `code` unique (majuscules), `restaurant_id` nullable (null = plateforme), `type` (`pourcentage`, `montant_gnf`), `valeur`, `plafond_gnf bigint` nullable, `utilisations_max`, `utilisations_faites`, `valide_du`, `valide_jusqu_au`, `premier_achat_seulement boolean`, `actif`, `financement` (`restaurant`, `plateforme`, `mixte`).
- **`utilisations_promo`** : `id`, `code_id`, `commande_id` unique, `client_user_id`, `remise_gnf bigint`. Contrainte : un code par commande.

### 3.6 Répartition financière (préparation phase 3)
- **`ecritures_repartition`** : `id`, `commande_id`, `beneficiaire_type` (`restaurant`, `livreur`, `entreprise`, `plateforme`), `beneficiaire_id`, `montant_gnf bigint`, `sens` (`credit`, `debit`), `motif`. Écrites par le serveur uniquement. Pas de flux réel en phase 2 (espèces et code marchand).

### 3.7 Contraintes à migrer (à noter avant le bloc 1)
- `orders.mode` : la contrainte actuelle n'accepte que `retrait` et `livraison`. Le mode de la courte liste du §3.3 (`restaurant`, `client_choisit`, `prestataire`) se traduit donc par une colonne séparée `mode_livraison`, sans toucher à `mode`. Choix à valider.
- `orders.statut` : la contrainte `check` est à remplacer par la liste élargie du §4 dans la même migration.
- `order_status_events.acteur` : texte libre aujourd'hui. Les nouvelles lignes écriront l'identifiant du compte ; les anciennes restent telles quelles.
- Toute migration de ce type doit être accompagnée de son fichier dans `supabase/migrations/` et d'un `get_advisors(security)` (règles du projet).

## 4. Machine d'états de la commande (extension)

États existants : `en_attente`, `acceptee`, `refusee`, `prete`, `terminee`, `annulee`.

Ajouts : `en_preparation`, `en_livraison`, `livree`, `retiree`.

| De | Vers | Qui | Condition |
|---|---|---|---|
| `en_attente` | `acceptee` / `refusee` | restaurant (membre) | compte identifié |
| `acceptee` | `en_preparation` | restaurant | — |
| `en_preparation` | `prete` | restaurant | — |
| `prete` | `en_livraison` | livreur assigné ou restaurant | mode livraison |
| `prete` | `retiree` | restaurant | mode retrait, client identifié |
| `en_livraison` | `livree` | livreur | code de remise valide |
| `livree` / `retiree` | `terminee` | système | sans litige ouvert pendant la fenêtre |
| toute étape non terminale | `annulee` | restaurant, client (avant acceptation), support | motif obligatoire |

Toute transition est écrite dans `order_status_events` avec l'acteur et l'horodatage. Une transition absente de ce tableau est rejetée.

## 5. Matrice d'autorisations

Légende : **L** lire, **E** écrire, **—** aucun accès, **P** propre ligne seulement, **R** restaurant concerné seulement, **Z** zone de livraison seulement.

| Donnée | Visiteur | Client | Membre restaurant | Livreur actif | Entreprise livraison | Support | Modération | Opérations/finance | Super admin |
|---|---|---|---|---|---|---|---|---|---|
| Restaurants publiés | L | L | L (R) | L | L | L | L | L | L |
| Menus et plats | L | L | E (R) | L | — | L | — | — | L |
| Commandes | — | P (ses commandes) | E (R, ses commandes) | Z (courses acceptées) | Z (courses de ses livreurs) | L (dossier ouvert) | — | L | L |
| Transitions de commande | — | P (annulation avant acceptation) | E (R) | E (`en_livraison`, `livree` sur ses courses) | E (sur ses livreurs) | E (annulation, motif) | — | L | E |
| Courses | — | P | R | P | R | L (dossier) | — | L | L |
| Code de remise | — | — | — | E (saisie) | — | — | — | — | — |
| Position du livreur | — | L (sa course active) | — | E (sa course active) | — | — | — | — | — |
| Pièces d'identité livreur/entreprise | — | — | — | P (envoi) | P (envoi) | — | — | — | L (vérification) |
| Profil utilisateur | — | P | P | P | P | L (minimisé) | — | — | L |
| Avis | L (publiés) | E (sa commande livrée) | L (ses restaurants) | — | — | L | E (modération) | L | L |
| Signalement d'avis | — | E | — | — | — | — | L/E | — | L |
| Codes promo | — | L (actifs) | E (R, ses codes) | — | — | L | — | E (plateforme) | L |
| Écritures de répartition | — | — | L (R) | L (P) | L (R) | — | — | L | L |
| Litiges | — | P (ses commandes) | R | P (ses courses) | R | E (traitement) | — | E | L |
| Journal d'audit | — | — | — | — | — | L (minimisé) | L | L | L |

**Règles transverses**
- Un visiteur non identifié ne peut rien écrire ; toute écriture passe par une session authentifiée.
- Un compte `telephone_verifie = false` ne peut pas payer en ligne (mobile money, carte). **Décision du 13 octobre 2026.** Le paiement en ligne reste fermé tant que la vérification SMS n'est pas en service.
- **Mode démonstration** : environnement séparé, clés de test uniquement, données fictives, bandeau « DÉMONSTRATION : aucun paiement réel ». Jamais relié à la production (TDR v0.2 §5.2).
- Un livreur `en_attente` ou `suspendu` ne voit aucune course.
- Une entreprise voit seulement les courses de ses livreurs rattachés.
- Le support ne voit jamais le téléphone complet d'un client sans motif journalisé (même principe que `masquerTelephone`).
- Toute action d'écriture produit une ligne dans `audit_events`.

## 6. Ce qui reste à faire pour la validation du bloc 0

1. Relire les tables et la matrice.
2. Trancher les points ouverts :
   - durée de conservation des pièces d'identité des livreurs (TDR §14) ;
   - la restriction du paiement pour les comptes non vérifiés (règle transverse ci-dessus) ;
   - le champ `age_declare_ge_18` : **déclaratif, sans document** (décision du 13 octobre 2026, TDR §9.3). Seul le seuil de 18 ans reste à confirmer juridiquement.
3. Une fois validé, écrire les migrations du bloc 1, sans les appliquer tant que vous ne l'avez pas autorisé.

## 7. Ce que ce document ne fait pas

Il n'écrit aucune migration, n'applique rien à la base, ne crée aucun compte chez un fournisseur et ne modifie pas le code de production.
