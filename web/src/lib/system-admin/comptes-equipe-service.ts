import "server-only";
import type { ContexteEquipeApi } from "@/lib/api/v1-equipe";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireTout } from "@/lib/db/lecture-complete";
import { compteEquipeDeTest, filtrerComptesEquipe } from "./comptes-equipe-regles";

/**
 * Annuaire global des comptes dans l'application (`/api/v1/equipe/comptes`).
 *
 * Lecture seule, comme la page `/system/acces/comptes` : l'application montre qui existe (e-mail, rôle système, restaurants, date de
 * création), l'équipe filtre et recherche. Les écritures irréversibles (suppression d'un compte, suppression groupée, réinitialisation des
 * questions de sécurité) et l'attribution des rôles restent sur le site.
 *
 * `auth.users` n'est pas exposé par PostgREST : les e-mails et les dates de création viennent de l'API d'administration Auth, appelée
 * UNIQUEMENT ici, côté serveur. Les memberships restaurant sont lues avec le client lié au jeton de la personne (RLS appliquée comme sur
 * le site : tout rôle système voit les memberships) ; les rôles système sont lus en clé d'administration, sinon l'annuaire afficherait « sans
 * rôle système » à tort pour `operations`.
 */

/** Bornes de lecture : un annuaire d'exploitation, pas un export de table. */
const UTILISATEURS_PAR_PAGE = 200;
const MAX_PAGES = 10;
/** Nombre de comptes renvoyés à l'application : protège le téléphone d'un annuaire démesuré. */
const LIMITE_COMPTES_EQUIPE = 500;

export interface AffiliationRestaurantEquipe {
  restaurantId: string;
  nom: string;
  /** `owner` (propriétaire) ou `manager` (équipier) — contrainte SQL de `restaurant_memberships.role`. */
  role: string;
}

export interface CompteEquipe {
  utilisateurId: string;
  email: string;
  creeLe: string;
  /** Rôle système brut (`super_admin`, `operations`, …), `null` si le compte n'en a pas. */
  roleSysteme: string | null;
  /** Restaurants possédés ou gérés, triés par nom. */
  restaurants: AffiliationRestaurantEquipe[];
  /** Le compte ressemble à un compte de test (aide au nettoyage, jamais une décision automatique). */
  test: boolean;
}

export interface ResultatComptesEquipe {
  comptes: CompteEquipe[];
  /** Vrai si la liste est incomplète : borne de lecture atteinte ou plus de comptes que l'application n'en affiche. */
  tronque: boolean;
}

/**
 * Les comptes de l'annuaire, filtrés par e-mail et par type d'affiliation. La permission `compte.consulter` est vérifiée par la route
 * (`equipeAuthentifiee`) ; ici on ne fait que lire.
 */
export async function listerComptesEquipe(contexte: ContexteEquipeApi, filtres: { q?: string; type?: unknown }): Promise<ResultatComptesEquipe> {
  const admin = creerClientAdmin();

  // 1. Comptes Auth (e-mails + création) — API d'administration Auth, serveur uniquement.
  const utilisateurs: { id: string; email: string; creeLe: string }[] = [];
  let tronque = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: UTILISATEURS_PAR_PAGE });
    if (error) throw new Error("Comptes illisibles.");
    for (const utilisateur of data.users) {
      utilisateurs.push({ id: utilisateur.id, email: utilisateur.email ?? "", creeLe: utilisateur.created_at });
    }
    if (data.users.length < UTILISATEURS_PAR_PAGE) break;
    if (page === MAX_PAGES) tronque = true;
  }

  // 2. Affiliations et rôles — deux lectures complètes (par pages), en parallèle.
  const [{ data: memberships }, { data: rolesSysteme }] = await Promise.all([
    lireTout((de, a) =>
      contexte.supabase
        .from("restaurant_memberships")
        .select("utilisateur_id, restaurant_id, role, restaurants(id, nom)")
        .order("restaurant_id", { ascending: true })
        .order("utilisateur_id", { ascending: true })
        .range(de, a),
    ),
    lireTout((de, a) =>
      admin
        .from("system_admin_memberships")
        .select("utilisateur_id, role")
        .order("utilisateur_id", { ascending: true })
        .range(de, a),
    ),
  ]);

  const restaurantsParUtilisateur = new Map<string, AffiliationRestaurantEquipe[]>();
  for (const membership of (memberships ?? []) as unknown as Array<{
    utilisateur_id: string;
    restaurant_id: string;
    role: string;
    restaurants: { id: string; nom: string } | null;
  }>) {
    const entrees = restaurantsParUtilisateur.get(membership.utilisateur_id) ?? [];
    entrees.push({
      restaurantId: membership.restaurants?.id ?? membership.restaurant_id ?? "",
      nom: membership.restaurants?.nom ?? "Restaurant inconnu",
      role: membership.role,
    });
    restaurantsParUtilisateur.set(membership.utilisateur_id, entrees);
  }

  const roleSystemeParUtilisateur = new Map<string, string>();
  for (const ligne of (rolesSysteme ?? []) as unknown as Array<{ utilisateur_id: string; role: string }>) {
    roleSystemeParUtilisateur.set(ligne.utilisateur_id, ligne.role);
  }

  // 3. Assemblage : un compte par e-mail, avec son rôle système et ses restaurants.
  const comptes: CompteEquipe[] = utilisateurs.map((utilisateur) => {
    const restaurants = (restaurantsParUtilisateur.get(utilisateur.id) ?? []).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return {
      utilisateurId: utilisateur.id,
      email: utilisateur.email,
      creeLe: utilisateur.creeLe,
      roleSysteme: roleSystemeParUtilisateur.get(utilisateur.id) ?? null,
      restaurants,
      test: compteEquipeDeTest(utilisateur.email),
    };
  });

  // 4. Filtres (recherche par e-mail, type d'affiliation) — règles pures, testées seules.
  const avecNombre: (CompteEquipe & { nombreRestaurants: number })[] = comptes.map((compte) => ({
    ...compte,
    nombreRestaurants: compte.restaurants.length,
  }));
  const retenus: CompteEquipe[] = filtrerComptesEquipe(avecNombre, filtres).map((compte) => ({
    utilisateurId: compte.utilisateurId,
    email: compte.email,
    creeLe: compte.creeLe,
    roleSysteme: compte.roleSysteme,
    restaurants: compte.restaurants,
    test: compte.test,
  }));

  // 5. Borne de renvoi : au-delà, l'application affiche « liste incomplète » plutôt que de saturer le téléphone.
  if (retenus.length > LIMITE_COMPTES_EQUIPE) {
    tronque = true;
    return { comptes: retenus.slice(0, LIMITE_COMPTES_EQUIPE), tronque };
  }

  retenus.sort((a, b) => a.email.localeCompare(b.email, "fr"));
  return { comptes: retenus, tronque };
}
