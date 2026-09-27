/**
 * Matrice de permissions du CMS système (bloc 8a) — CONTRAT VERSIONNÉ.
 *
 * Ce fichier est la source de vérité applicative des permissions des rôles
 * système (ADR-010) : il est lu par le shell `/system` et par les futurs
 * sous-blocs 8b (restaurants/comptes), 8c (contenus) et 8d (support/audit).
 * La version lisible et commentée vit dans `docs/MATRICE-PERMISSIONS.md` :
 * toute modification de la matrice doit mettre à jour les deux fichiers et
 * incrémenter `VERSION_MATRICE` avant le branchement des sous-blocs.
 *
 * Règles non négociables (TDR.md §4, ADR-010) :
 * - Les rôles système sont strictement séparés des memberships restaurant :
 *   un membership restaurant n'accorde JAMAIS une permission d'ici (et un rôle
 *   système ne donne aucun accès à la console `/restaurant`).
 * - Aucun rôle n'est attribué depuis une inscription publique ; seul
 *   `super_admin` peut les attribuer (permission `systeme.roles`), jamais en
 *   auto-attribution.
 * - Refus par défaut : toute permission absente de la liste d'un rôle est
 *   refusée, et un rôle inconnu en base est traité comme « aucun rôle ».
 */

/** Version de la matrice de permissions. À incrémenter à chaque changement. */
export const VERSION_MATRICE = "1.0.0";

/** Rôles système MVP (TDR.md §4) — miroir du CHECK de `system_admin_memberships`. */
export type RoleSysteme = "super_admin" | "operations" | "content_editor" | "support";

export const ROLES_SYSTEME = ["super_admin", "operations", "content_editor", "support"] as const;

/**
 * Garde d'exécution : la colonne `role` est typée `string` côté base, on refuse
 * donc tout rôle qui ne figure pas dans la matrice (refus par défaut).
 */
export function estRoleSysteme(valeur: string): valeur is RoleSysteme {
  return (ROLES_SYSTEME as readonly string[]).includes(valeur);
}

/**
 * Permissions exhaustives du CMS système. Nomination : `domaine.action`.
 * Chaque permission est couverte par une policy RLS correspondante quand une
 * table existe (voir docs/MATRICE-PERMISSIONS.md) ; la vérification serveur
 * ci-dessous reste obligatoire en défense en profondeur.
 */
export type Permission =
  | "restaurant.consulter"
  | "restaurant.moderer"
  | "compte.consulter"
  | "compte.inviter"
  | "contenu.editer"
  | "contenu.mettre_en_avant"
  | "taxonomie.editer"
  | "commande.consulter"
  | "commande.support"
  | "coordonees.voir"
  | "systeme.roles"
  | "systeme.audit";

export const LIBELLES_ROLES: Record<RoleSysteme, string> = {
  super_admin: "Super administrateur",
  operations: "Opérations",
  content_editor: "Éditeur de contenu",
  support: "Support",
};

export const DESCRIPTIONS_ROLES: Record<RoleSysteme, string> = {
  super_admin: "Toutes les permissions, dont l'attribution des rôles système et la révélation des coordonnées.",
  operations: "Onboarding, modération et comptes des restaurants ; mises en avant.",
  content_editor: "Contenus éditoriaux et taxonomie uniquement ; ni commande ni rôle.",
  support: "Recherche d'incidents commandes avec coordonnées masquées par défaut ; révélation possible, motivée et audité.",
};

export const LIBELLES_PERMISSIONS: Record<Permission, string> = {
  "restaurant.consulter": "Consulter les fiches restaurants, y compris non publiées",
  "restaurant.moderer": "Approuver, suspendre, réactiver ou demander une correction",
  "compte.consulter": "Consulter les comptes et memberships restaurant",
  "compte.inviter": "Inviter ou révoquer propriétaires et équipiers",
  "contenu.editer": "Créer, modifier et ordonner pages, FAQ et bannières",
  "contenu.mettre_en_avant": "Gérer les sélections et mises en avant",
  "taxonomie.editer": "Gérer catégories, cuisines, quartiers et tags",
  "commande.consulter": "Rechercher et consulter les commandes (coordonnées masquées)",
  "commande.support": "Agir sur une commande dans le cadre d'une procédure de support explicite",
  "coordonees.voir": "Révéler les coordonnées clients (motif obligatoire et trace d'audit)",
  "systeme.roles": "Attribuer ou retirer les rôles système",
  "systeme.audit": "Consulter le journal d'audit et les indicateurs",
};

/**
 * MATRICE — qui peut quoi. Règle : refuser par défaut, n'ajouter une permission
 * à un rôle que si son travail quotidien l'exige (TDR.md §4 : « sous-ensemble
 * de permissions » pour éditeur/support).
 *
 * `coordonees.voir` est volontairement réservée à `support` et `super_admin`
 * (accès exceptionnel, motivé et audité). `systeme.roles` est réservée à
 * `super_admin` : aucun utilisateur ne s'attribue lui-même un rôle privilégié.
 */
export const PERMISSIONS_PAR_ROLE: Record<RoleSysteme, readonly Permission[]> = {
  super_admin: [
    "restaurant.consulter",
    "restaurant.moderer",
    "compte.consulter",
    "compte.inviter",
    "contenu.editer",
    "contenu.mettre_en_avant",
    "taxonomie.editer",
    "commande.consulter",
    "commande.support",
    "coordonees.voir",
    "systeme.roles",
    "systeme.audit",
  ],
  operations: [
    "restaurant.consulter",
    "restaurant.moderer",
    "compte.consulter",
    "compte.inviter",
    "contenu.mettre_en_avant",
    "systeme.audit",
  ],
  content_editor: ["restaurant.consulter", "contenu.editer", "taxonomie.editer", "systeme.audit"],
  support: [
    "restaurant.consulter",
    "commande.consulter",
    "commande.support",
    "coordonees.voir",
    "systeme.audit",
  ],
};

export function permissionsDuRole(role: RoleSysteme): readonly Permission[] {
  return PERMISSIONS_PAR_ROLE[role];
}

export function roleAPermission(role: RoleSysteme, permission: Permission): boolean {
  return PERMISSIONS_PAR_ROLE[role].includes(permission);
}

export function rolesAvecPermission(permission: Permission): readonly RoleSysteme[] {
  return ROLES_SYSTEME.filter((role) => roleAPermission(role, permission));
}

/** Sections du shell `/system`, chacune rattachée à sa permission d'accès. */
export interface SectionSysteme {
  readonly href: string;
  readonly libelle: string;
  /** Bloc de PLAN-EXECUTION.md qui implémentera l'écran réel derrière ce placeholder. */
  readonly bloc: "8a" | "8b" | "8c" | "8d";
  readonly permission: Permission;
  readonly resume: string;
}

export const SECTIONS_SYSTEME: readonly SectionSysteme[] = [
  {
    href: "/system/restaurants",
    libelle: "Restaurants & comptes",
    bloc: "8b",
    permission: "restaurant.moderer",
    resume: "Demandes et établissements, modération, invitations et révocations de membres.",
  },
  {
    href: "/system/contenus",
    libelle: "Contenus",
    bloc: "8c",
    permission: "contenu.editer",
    resume: "Pages d'aide et FAQ, bannières, contenus d'accueil, taxonomie.",
  },
  {
    href: "/system/mises-en-avant",
    libelle: "Mises en avant",
    bloc: "8c",
    permission: "contenu.mettre_en_avant",
    resume: "Sélection des restaurants mis en avant au catalogue public — décision opérations, pas éditoriale.",
  },
  {
    href: "/system/commandes",
    libelle: "Support commandes",
    bloc: "8d",
    permission: "commande.consulter",
    resume: "Recherche de commandes, historique des transitions, accès exceptionnel aux coordonnées.",
  },
  {
    href: "/system/roles",
    libelle: "Rôles système",
    bloc: "8a",
    permission: "systeme.roles",
    resume: "Attribution et retrait des rôles système — réservée à super_admin.",
  },
  {
    href: "/system/audit",
    libelle: "Journal d'audit",
    bloc: "8d",
    permission: "systeme.audit",
    resume: "Journal filtrable des actions sensibles et indicateurs d'activité.",
  },
];
