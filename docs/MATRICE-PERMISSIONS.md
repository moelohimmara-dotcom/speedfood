# Matrice de permissions du CMS système — v1.1.0

**Statut :** livrée (blocs 8a-8d) et étendue lors de la refonte de la console
d'administration (navigation groupée par domaine + `parametres.editer`).
**Source de vérité applicative :** `src/lib/system-admin/permissions.ts` (constante
`VERSION_MATRICE`). Ce document est sa traduction lisible : les deux doivent évoluer
ensemble, et toute modification incrémenté `VERSION_MATRICE` (semver : correctif =
clarification de libellé, mineur = permission ajoutée, majeur = suppression ou
changement de périmètre d'une permission).

Cadrage : `docs/cadrage/PLAN-EXECUTION.md` (bloc 8a), `docs/cadrage/ADR.md`
(ADR-010), `docs/cadrage/TDR.md` §4.

## Principes non négociables

1. **Séparation stricte des surfaces (ADR-010).** Un membership restaurant
   (`restaurant_memberships`) n'accorde jamais un rôle système ; un rôle système
   n'ouvre jamais la console `/restaurant`. Le code de `/system` ne lit jamais
   `restaurant_memberships` — vérifié dans `src/lib/system-admin/contexte.ts`.
2. **Jamais d'attribution auto.** Seul `super_admin` (permission `systeme.roles`)
   attribue ou retire un rôle système. Aucune inscription publique ne crée un
   rôle système ; l'attribution initiale passe par la `service_role` côté serveur
   (procédure documentée dans `docs/STATUT-PROJET.md`).
3. **Refus par défaut.** Un rôle inconnu en base est traité comme « aucun rôle » ;
   une permission absente de la liste d'un rôle est refusée ; un visiteur sans
   rôle système reçoit une **404** (aucune fuite sur l'existence de `/system`).
4. **Coordonnées clients masquées par défaut**, pour tout rôle, avec accès
   exceptionnel motivé et audité (voir plus bas).
5. **Défense en profondeur.** Le proxy (`src/proxy.ts`) refuse les sessions
   absentes sur `/system`, et chaque page refait son contrôle
   (`exigerPermissionPage`) ; les Server Actions utilisent `verifierPermission`.
   La RLS Supabase applique les mêmes rôles en dernière ligne de défense.

## Rôles

| Rôle | Libellé | Périmètre |
|---|---|---|
| `super_admin` | Super administrateur | Toutes les permissions, attribution des rôles, révélation des coordonnées |
| `operations` | Opérations | Onboarding, modération et comptes des restaurants ; mises en avant |
| `content_editor` | Éditeur de contenu | Contenus éditoriaux et taxonomie ; **ni commande ni rôle** |
| `support` | Support | Recherche d'incidents commandes ; coordonnées masquées par défaut |

## Matrice (rôle → permissions)

✓ = accordée, — = refusée.

| Permission | Description | super_admin | operations | content_editor | support |
|---|---|:---:|:---:|:---:|:---:|
| `restaurant.consulter` | Consulter les fiches restaurants, y compris non publiées | ✓ | ✓ | ✓ | ✓ |
| `restaurant.moderer` | Approuver, suspendre, réactiver ou demander une correction | ✓ | ✓ | — | — |
| `compte.consulter` | Consulter les comptes et memberships restaurant | ✓ | ✓ | — | — |
| `compte.inviter` | Inviter ou révoquer propriétaires et équipiers | ✓ | ✓ | — | — |
| `contenu.editer` | Créer, modifier et ordonner pages, FAQ et bannières | ✓ | — | ✓ | — |
| `contenu.mettre_en_avant` | Gérer les sélections et mises en avant | ✓ | ✓ | — | — |
| `taxonomie.editer` | Gérer catégories, cuisines, quartiers et tags | ✓ | — | ✓ | — |
| `commande.consulter` | Rechercher et consulter les commandes (coordonnées masquées) | ✓ | — | — | ✓ |
| `commande.support` | Agir sur une commande dans le cadre d'une procédure de support explicite | ✓ | — | — | ✓ |
| `coordonees.voir` | Révéler les coordonnées clients (motif + audit) | ✓ | — | — | ✓ |
| `systeme.roles` | Attribuer ou retirer les rôles système | ✓ | — | — | — |
| `systeme.audit` | Consulter le journal d'audit et les indicateurs | ✓ | ✓ | ✓ | ✓ |
| `parametres.editer` | Modifier les paramètres globaux de l'application | ✓ | — | — | — |

Justifications de périmètre :

- `coordonees.voir` est réservée à `support` et `super_admin` (TDR.md §4 :
  « données personnelles minimisées et journalisées » ; ADR-010 : accès
  exceptionnel avec permission dédiée, motif et trace d'audit).
- `systeme.roles` est réservée à `super_admin` : aucun utilisateur ne s'attribue
  lui-même un rôle privilégié (ADR-010).
- `parametres.editer` est réservée à `super_admin`, même périmètre que
  `systeme.roles` : les réglages globaux (délai de proposition, plafond de prix)
  ne se délèguent pas. `COMMANDE_JETON_SECRET` reste hors de ce périmètre —
  jamais éditable depuis l'admin, car changer sa valeur invaliderait tous les
  jetons de suivi déjà émis (reste un secret Cloudflare).
- `content_editor` ne modifie ni commande ni rôle (critère d'acceptation 8c).
- `contenu.mettre_en_avant` suit la policy RLS existante
  `operations_gestion_mises_en_avant` (operations + super_admin), même si
  PLAN-EXECUTION 8c range les « sélections/mises en avant » du côté éditorial —
  voir « Écarts connus » plus bas.

## Correspondance avec les policies RLS existantes

Le code applicatif vérifie les permissions ci-dessus **et** la RLS les applique
en base. Correspondance (migration `20260927150300_rls.sql`, non modifiée) :

| Permission | Policy RLS de référence |
|---|---|
| `restaurant.consulter` | `admins_lecture_tous_restaurants` (`fn_est_admin_systeme()`, tout rôle système) |
| `restaurant.moderer` | `admins_creation_restaurants` / `admins_maj_restaurants` (operations, super_admin) |
| `compte.consulter` | `lecture_sa_propre_membership` (clause admin) |
| `compte.inviter` | `admins_gestion_memberships` (operations, super_admin) |
| `contenu.editer` | `editeurs_gestion_contenu` / `editeurs_gestion_bannieres` (content_editor, super_admin) |
| `contenu.mettre_en_avant` | `operations_gestion_mises_en_avant` (operations, super_admin) |
| `taxonomie.editer` | aucune policy d'écriture à ce jour (voir « Écarts connus ») |
| `commande.consulter` / `commande.support` | aucune policy admin sur `orders` (voir « Écarts connus ») |
| `coordonees.voir` | aucune policy admin sur `orders` (voir « Écarts connus ») |
| `systeme.roles` | `super_admin_gestion_roles_systeme` (super_admin) |
| `systeme.audit` | `admins_lecture_audit` (tout rôle système) ; `admins_ecriture_audit` pour l'écriture |

## Coordonnées clients : masquage et révélation

Règle d'affichage (helpers `masquerTelephone()` / `masquerAdresse()` /
`afficherCoordonnees()` dans `src/lib/system-admin/coordonnees.ts`), **masquées
par défaut pour tous les rôles** :

- **Téléphone** : l'indicatif international (`+224`) reste visible ; dans le
  numéro local, le premier chiffre et les deux derniers restent visibles, les
  autres deviennent `*` (ex. `+224 622 34 56 78` → `+224 6** ** ** 78`). Si le
  numéro local compte moins de 5 chiffres, seul le dernier reste visible. Les
  séparateurs d'origine sont conservés.
- **Adresse** : seul le quartier est conservé — le dernier segment de l'adresse
  (après la dernière virgule), sans chiffres (ex. `12 rue du Marché, Madina` →
  `Quartier : Madina`). Sans quartier identifiable, affichage `Adresse masquée`.

Révélation (helper `revelerCoordonneesCommande()` dans
`src/lib/system-admin/audit.ts`) — conditions **cumulatives** :

1. permission `coordonees.voir` (support et super_admin uniquement) ;
2. motif explicite saisi par l'opérateur (obligatoire, 500 caractères max) ;
3. trace écrite dans `audit_events` **avant** l'affichage (action
   `coordonnees.revelation`, `acteur_id`, `cible_type: commande`, `cible_id`,
   `motif`, `horodatage`). Si la trace ne peut pas être écrite, la révélation est
   refusée : jamais de donnée en clair sans trace.

La table `audit_events` est append-only (aucune policy de modification ni de
suppression) : les traces ne sont pas altérables depuis l'application.

## Shell `/system`

Navigation groupée par domaine (refonte post-8d) : chaque **groupe** ne
s'affiche que si le rôle a au moins une permission parmi celles de ses
sous-écrans (`entreesNavPourRole`) ; chaque **sous-item** ne s'affiche que si
sa propre permission est accordée (`sousSectionsAccessibles`, généralisation de
l'ancien `SousNavContenus` en `SousNav`). Purement une réorganisation visuelle
— aucun changement de permission réelle.

| Route | Contenu | Permission vérifiée dans la page |
|---|---|---|
| `/system` | Centre de commandement (indicateurs, file prioritaire) | tout rôle système |
| `/system/catalogue/restaurants` | Restaurants & comptes | `restaurant.moderer` |
| `/system/catalogue/taxonomie` | Taxonomie (catégories, quartiers) | `taxonomie.editer` |
| `/system/catalogue/mises-en-avant` | Mises en avant | `contenu.mettre_en_avant` |
| `/system/contenu/pages` | Pages | `contenu.editer` |
| `/system/contenu/bannieres` | Bannières | `contenu.editer` |
| `/system/commandes` | Support commandes | `commande.consulter` |
| `/system/acces/comptes` | Annuaire des comptes (lecture seule) | `compte.consulter` |
| `/system/acces/roles` | Rôles système | `systeme.roles` |
| `/system/audit` | Journal d'audit | `systeme.audit` |

`/system/acces/roles` et `/system/audit` restent deux routes distinctes,
chacune portant sa propre permission — un `support` consulte le journal sans
accéder à la gestion des rôles.

## Écarts connus

Les écarts d'origine du bloc 8a (policies d'écriture manquantes sur
`menu_categories`/`neighborhoods` et sur `orders`) sont résolus depuis les
blocs 8b/8d : les écritures passent par `service_role` après
`verifierPermission(...)` et une trace d'audit, comme prévu. Aucun écart connu
actuellement — la « Mises en avant » reste alignée sur la policy RLS existante
`operations_gestion_mises_en_avant`, pas sur un découpage éditorial, choix
assumé et documenté dans la matrice ci-dessus.

## Validation

Toute permission ajoutée ou modifiée passe par une révision de ce document,
de `src/lib/system-admin/permissions.ts` et un incrément de `VERSION_MATRICE`
(semver : correctif = clarification de libellé, mineur = permission ajoutée,
majeur = suppression ou changement de périmètre d'une permission).
