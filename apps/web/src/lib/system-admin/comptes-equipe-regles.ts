import { estCompteDeTest } from "./comptesTest";

/**
 * Règles pures de l'espace équipe « Comptes » (application) : l'annuaire global des comptes, en lecture seule. Module sans base ni
 * serveur, donc testable seul (voir `scripts/tests/comptes-equipe.test.mts`).
 *
 * Les e-mails affichés sont des comptes internes (comptes Speedfood) : cette règle ne concerne JAMAIS les coordonnées des clients de
 * commandes, qui restent masquées par `src/lib/system-admin/coordonnees.ts`.
 */

/** Filtres de l'annuaire. `tous` = aucun filtrage. */
export type TypeCompteEquipe = "tous" | "restaurateur" | "systeme" | "sans_affiliation" | "test";

/** Ordre d'affichage des filtres (comme sur le site). */
export const TYPES_COMPTE_EQUIPE: readonly TypeCompteEquipe[] = ["tous", "restaurateur", "systeme", "sans_affiliation", "test"];

export const LIBELLES_TYPE_COMPTE: Record<TypeCompteEquipe, string> = {
  tous: "Tous",
  restaurateur: "Restaurateurs",
  systeme: "Rôles système",
  sans_affiliation: "Sans affiliation",
  test: "Comptes de test",
};

/** Un filtre inconnu retombe sur « Tous » : jamais de valeur devinée, jamais de liste vide surprise. */
export function typeCompteEquipeValide(brut: unknown): TypeCompteEquipe {
  return TYPES_COMPTE_EQUIPE.includes(brut as TypeCompteEquipe) ? (brut as TypeCompteEquipe) : "tous";
}

export function libelleTypeCompteEquipe(type: string): string {
  return LIBELLES_TYPE_COMPTE[type as TypeCompteEquipe] ?? LIBELLES_TYPE_COMPTE.tous;
}

/** Rôles système de la matrice (`src/lib/system-admin/permissions.ts`), avec leur libellé lisible. */
export const LIBELLES_ROLE_SYSTEME_EQUIPE: Record<string, string> = {
  super_admin: "Super administrateur",
  operations: "Opérations",
  content_editor: "Éditeur de contenu",
  support: "Support",
};

/** Libellé d'un rôle système, ou `null` si le compte n'en a pas. Un rôle hors matrice est affiché tel quel (refus par défaut côté droits). */
export function libelleRoleSystemeEquipe(role: string | null | undefined): string | null {
  if (!role) return null;
  return LIBELLES_ROLE_SYSTEME_EQUIPE[role] ?? role;
}

/** Rôle du compte dans un restaurant : `owner` = propriétaire, sinon équipier. */
export function libelleAffiliationEquipe(role: string): string {
  return role === "owner" ? "Propriétaire" : "Équipier";
}

/** Ce qu'il faut pour filtrer un compte : son e-mail, son rôle système, son nombre d'affiliations et son caractère de test. */
export interface CompteEquipeFiltrable {
  email: string;
  roleSysteme: string | null;
  nombreRestaurants: number;
  test: boolean;
}

/**
 * Filtre l'annuaire : recherche par e-mail (sous-chaîne, insensible à la casse) puis filtre de type. Le tri par e-mail est fait par
 * l'appelant ; ici on ne fait que retirer ce qui ne correspond pas.
 */
export function filtrerComptesEquipe<T extends CompteEquipeFiltrable>(comptes: readonly T[], filtres: { q?: string; type?: unknown }): T[] {
  const recherche = (filtres.q ?? "").trim().toLowerCase();
  const type = typeCompteEquipeValide(filtres.type);
  return comptes.filter((compte) => {
    if (recherche && !compte.email.toLowerCase().includes(recherche)) return false;
    if (type === "restaurateur") return compte.nombreRestaurants > 0;
    if (type === "systeme") return compte.roleSysteme !== null;
    if (type === "sans_affiliation") return compte.nombreRestaurants === 0 && compte.roleSysteme === null;
    if (type === "test") return compte.test;
    return true;
  });
}

/** Ce compte ressemble-t-il à un compte de test ? (aide au nettoyage, jamais une décision automatique) */
export function compteEquipeDeTest(email: string | null | undefined): boolean {
  return estCompteDeTest(email);
}

/**
 * Ce que l'équipe peut faire depuis l'application, et ce qui reste sur le site.
 * - L'annuaire, la recherche et les filtres : dans l'application (lecture seule).
 * - La suppression d'un compte, la suppression groupée et la réinitialisation des questions de sécurité sont **irréversibles** : elles restent
 *   sur le site.
 * - L'attribution des rôles système reste sur le site `/system/acces/roles` (réservée à `super_admin`).
 */
export interface ActionsEquipeComptes {
  /** Consulter l'annuaire, rechercher, filtrer : dans l'application. */
  lireAnnuaire: boolean;
  /** Supprimer un compte : sur le site seulement (irréversible). */
  suppressionCompteSurLeSiteSeulement: boolean;
  /** Supprimer plusieurs comptes d'un coup : sur le site seulement (irréversible). */
  suppressionGroupeeSurLeSiteSeulement: boolean;
  /** Réinitialiser les questions de sécurité : sur le site seulement (destructif). */
  reinitialisationQuestionsSurLeSiteSeulement: boolean;
  /** Attribuer ou retirer un rôle système : sur le site seulement (réservé à `super_admin`). */
  attributionRolesSurLeSiteSeulement: boolean;
}

export const ACTIONS_EQUIPE_COMPTES: ActionsEquipeComptes = {
  lireAnnuaire: true,
  suppressionCompteSurLeSiteSeulement: true,
  suppressionGroupeeSurLeSiteSeulement: true,
  reinitialisationQuestionsSurLeSiteSeulement: true,
  attributionRolesSurLeSiteSeulement: true,
};
