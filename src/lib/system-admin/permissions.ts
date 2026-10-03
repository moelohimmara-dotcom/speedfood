/**
 * Matrice de permissions du CMS système (bloc 8a) — CONTRAT VERSIONNÉ.
 *
 * Ce fichier est la source de vérité applicative des permissions des rôles
 * système (ADR-010) : il est lu par le shell `/system` et par tous les
 * écrans de la console. La version lisible et commentée vit dans
 * `docs/MATRICE-PERMISSIONS.md` : toute modification de la matrice doit
 * mettre à jour les deux fichiers et incrémenter `VERSION_MATRICE`.
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
export const VERSION_MATRICE = "1.2.0";

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
  | "compte.supprimer"
  | "contenu.editer"
  | "contenu.mettre_en_avant"
  | "taxonomie.editer"
  | "commande.consulter"
  | "commande.support"
  | "coordonees.voir"
  | "systeme.roles"
  | "systeme.audit"
  | "parametres.editer";

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
  "compte.supprimer": "Supprimer définitivement un compte (comptes de test, comptes à fermer)",
  "contenu.editer": "Créer, modifier et ordonner pages, FAQ, bannières et médias",
  "contenu.mettre_en_avant": "Gérer les sélections et mises en avant",
  "taxonomie.editer": "Gérer catégories, cuisines, quartiers et tags",
  "commande.consulter": "Rechercher et consulter les commandes (coordonnées masquées)",
  "commande.support": "Agir sur une commande dans le cadre d'une procédure de support explicite",
  "coordonees.voir": "Révéler les coordonnées clients (motif obligatoire et trace d'audit)",
  "systeme.roles": "Attribuer ou retirer les rôles système",
  "systeme.audit": "Consulter le journal d'audit et les indicateurs",
  "parametres.editer": "Modifier les paramètres globaux de l'application",
};

/**
 * MATRICE — qui peut quoi. Règle : refuser par défaut, n'ajouter une permission
 * à un rôle que si son travail quotidien l'exige (TDR.md §4 : « sous-ensemble
 * de permissions » pour éditeur/support).
 *
 * `coordonees.voir` est volontairement réservée à `support` et `super_admin`
 * (accès exceptionnel, motivé et audité). `systeme.roles` et
 * `parametres.editer` sont réservées à `super_admin` : ni l'attribution des
 * rôles ni les réglages globaux ne se délèguent.
 */
export const PERMISSIONS_PAR_ROLE: Record<RoleSysteme, readonly Permission[]> = {
  super_admin: [
    "restaurant.consulter",
    "restaurant.moderer",
    "compte.consulter",
    "compte.inviter",
    "compte.supprimer",
    "contenu.editer",
    "contenu.mettre_en_avant",
    "taxonomie.editer",
    "commande.consulter",
    "commande.support",
    "coordonees.voir",
    "systeme.roles",
    "systeme.audit",
    "parametres.editer",
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

/**
 * Navigation groupée du shell `/system` : chaque **groupe** représente un
 * domaine métier (pas une permission) ; chaque **sous-section** à l'intérieur
 * porte sa propre permission. Un groupe n'apparaît dans la nav de premier
 * niveau (`SystemNav`) que si au moins une de ses sous-sections est
 * accessible au rôle ; chaque page d'un groupe affiche ensuite sa propre
 * sous-navigation (`SousNav`) filtrée de la même façon — un rôle peut donc
 * voir un groupe sans voir toutes ses sous-sections (ex. `operations` voit
 * "Catalogue" mais pas la sous-section Taxonomie).
 */
export interface SousSectionSysteme {
  readonly href: string;
  readonly libelle: string;
  readonly permission: Permission;
}

export interface GroupeSysteme {
  readonly libelle: string;
  readonly sousSections: readonly SousSectionSysteme[];
}

export const GROUPES_SYSTEME: readonly GroupeSysteme[] = [
  {
    libelle: "Catalogue",
    sousSections: [
      { href: "/system/catalogue/restaurants", libelle: "Restaurants", permission: "restaurant.moderer" },
      { href: "/system/catalogue/taxonomie", libelle: "Taxonomie", permission: "taxonomie.editer" },
      {
        href: "/system/catalogue/mises-en-avant",
        libelle: "Mises en avant",
        permission: "contenu.mettre_en_avant",
      },
    ],
  },
  {
    libelle: "Contenu",
    sousSections: [
      { href: "/system/contenu/pages", libelle: "Pages", permission: "contenu.editer" },
      { href: "/system/contenu/bannieres", libelle: "Bannières", permission: "contenu.editer" },
      { href: "/system/contenu/medias", libelle: "Médias", permission: "contenu.editer" },
    ],
  },
  {
    libelle: "Commandes",
    sousSections: [
      { href: "/system/commandes", libelle: "Support commandes", permission: "commande.consulter" },
    ],
  },
  {
    libelle: "Accès",
    sousSections: [
      { href: "/system/acces/comptes", libelle: "Comptes utilisateurs", permission: "compte.consulter" },
      { href: "/system/acces/roles", libelle: "Rôles système", permission: "systeme.roles" },
    ],
  },
  {
    libelle: "Paramètres",
    sousSections: [
      { href: "/system/parametres", libelle: "Paramètres", permission: "parametres.editer" },
    ],
  },
  {
    libelle: "Audit",
    sousSections: [{ href: "/system/audit", libelle: "Journal d'audit", permission: "systeme.audit" }],
  },
];

/** Entrées de premier niveau (une par groupe accessible), pour `SystemNav`. */
export function entreesNavPourRole(role: RoleSysteme): { href: string; libelle: string }[] {
  const entrees: { href: string; libelle: string }[] = [];
  for (const groupe of GROUPES_SYSTEME) {
    const premiereAccessible = groupe.sousSections.find((s) => roleAPermission(role, s.permission));
    if (premiereAccessible) {
      entrees.push({ href: premiereAccessible.href, libelle: groupe.libelle });
    }
  }
  return entrees;
}

/** Sous-sections accessibles d'un groupe donné, pour la sous-nav locale d'une page. */
export function sousSectionsAccessibles(
  libelleGroupe: string,
  role: RoleSysteme
): SousSectionSysteme[] {
  const groupe = GROUPES_SYSTEME.find((g) => g.libelle === libelleGroupe);
  if (!groupe) {
    return [];
  }
  return groupe.sousSections.filter((s) => roleAPermission(role, s.permission));
}
