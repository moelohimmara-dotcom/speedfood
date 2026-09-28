"use server";

import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { verifierPermission } from "./contexte";

/**
 * Annuaire global des comptes utilisateurs (post-bloc 8d).
 *
 * `auth.users` n'est PAS exposé via PostgREST : les emails et dates de création
 * viennent donc de l'API admin Auth (`auth.admin.listUsers`, clé service-role),
 * appelée UNIQUEMENT ici côté serveur — jamais depuis le bundle navigateur
 * (`creerClientAdmin` porte `import "server-only"`). C'est la même contrainte
 * que `fn_lister_membres_restaurant` (bloc 8b), avec l'avantage de lister tous
 * les comptes d'un coup sans migration SQL.
 *
 * Accès : permission `compte.consulter` (super_admin, operations) — défense en
 * profondeur obligatoire avant chaque lecture. Les emails affichés sont des
 * comptes internes (comptes Speedfood) : cette règle ne concerne JAMAIS les
 * coordonnées des clients de commandes, qui restent masquées par
 * `src/lib/system-admin/coordonnees.ts`.
 *
 * Les memberships restaurant sont lus via la session RLS (`lecture_sa_propre_membership`
 * : tout rôle système voit les memberships) ; les rôles système sont lus en
 * service-role car la policy `lecture_son_propre_role_systeme` ne les montre
 * qu'à leur titulaire et à `super_admin` — sans ce détour, l'annuaire afficherait
 * « sans rôle système » à tort pour `operations`. Affichage d'identité en lecture
 * seule : l'attribution des rôles reste réservée à `systeme.roles` (super_admin).
 */

/** Filtres de l'annuaire. `tous` = aucun filtrage par type d'affiliation. */
export type TypeCompteAnnuaire = "tous" | "restaurateur" | "systeme" | "sans_affiliation";

export interface AffiliationRestaurant {
  restaurantId: string;
  nom: string;
  /** `owner` (propriétaire) ou `manager` (équipier) — contrainte SQL de `restaurant_memberships.role`. */
  role: string;
}

export interface CompteAnnuaire {
  utilisateurId: string;
  email: string;
  creeLe: string;
  /** Restaurants possédés ou gérés, triés par nom. */
  restaurants: AffiliationRestaurant[];
  /** Rôle système brut (`super_admin`, `operations`, …), `null` si le compte n'en a pas. */
  roleSysteme: string | null;
}

export interface ResultatAnnuaire {
  comptes: CompteAnnuaire[];
  /** Vrai si la limite de lecture a été atteinte : l'annuaire est alors incomplet. */
  tronque: boolean;
}

/** Bornes de lecture : un annuaire d'exploitation, pas un export de table. */
const UTILISATEURS_PAR_PAGE = 200;
const MAX_PAGES = 10;

export async function listerComptesAnnuaire(filtres: {
  q?: string;
  type?: TypeCompteAnnuaire;
}): Promise<ResultatAnnuaire> {
  await verifierPermission("compte.consulter");

  // 1. Comptes Auth (emails + création) — API admin Auth, serveur uniquement.
  const admin = creerClientAdmin();
  const utilisateurs: { id: string; email: string; creeLe: string }[] = [];
  let tronque = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: UTILISATEURS_PAR_PAGE,
    });
    if (error) {
      return { comptes: [], tronque: false };
    }
    for (const utilisateur of data.users) {
      utilisateurs.push({
        id: utilisateur.id,
        email: utilisateur.email ?? "",
        creeLe: utilisateur.created_at,
      });
    }
    if (data.users.length < UTILISATEURS_PAR_PAGE) {
      break;
    }
    if (page === MAX_PAGES) {
      tronque = true;
    }
  }

  // 2. Affiliations et rôles — trois lectures ciblées, en parallèle.
  const supabase = await creerClientServeur();
  const [{ data: memberships }, { data: rolesSysteme }] = await Promise.all([
    supabase
      .from("restaurant_memberships")
      .select("utilisateur_id, restaurant_id, role, restaurants(id, nom)")
      .order("role", { ascending: true }),
    admin.from("system_admin_memberships").select("utilisateur_id, role"),
  ]);

  const restaurantsParUtilisateur = new Map<string, AffiliationRestaurant[]>();
  for (const membership of memberships ?? []) {
    const restaurant = membership.restaurants;
    const entrees = restaurantsParUtilisateur.get(membership.utilisateur_id) ?? [];
    entrees.push({
      restaurantId: restaurant?.id ?? membership.restaurant_id ?? "",
      nom: restaurant?.nom ?? "Restaurant inconnu",
      role: membership.role,
    });
    restaurantsParUtilisateur.set(membership.utilisateur_id, entrees);
  }

  const roleSystemeParUtilisateur = new Map<string, string>();
  for (const ligne of rolesSysteme ?? []) {
    roleSystemeParUtilisateur.set(ligne.utilisateur_id, ligne.role);
  }

  // 3. Assemblage + filtres (recherche email, type d'affiliation).
  const recherche = filtres.q?.trim().toLowerCase() ?? "";
  const type = filtres.type ?? "tous";

  const comptes: CompteAnnuaire[] = [];
  for (const utilisateur of utilisateurs) {
    const restaurants = (restaurantsParUtilisateur.get(utilisateur.id) ?? []).sort((a, b) =>
      a.nom.localeCompare(b.nom, "fr")
    );
    const roleSysteme = roleSystemeParUtilisateur.get(utilisateur.id) ?? null;

    if (recherche && !utilisateur.email.toLowerCase().includes(recherche)) {
      continue;
    }
    const restaurateur = restaurants.length > 0;
    const compteSysteme = roleSysteme !== null;
    if (type === "restaurateur" && !restaurateur) {
      continue;
    }
    if (type === "systeme" && !compteSysteme) {
      continue;
    }
    if (type === "sans_affiliation" && (restaurateur || compteSysteme)) {
      continue;
    }

    comptes.push({
      utilisateurId: utilisateur.id,
      email: utilisateur.email,
      creeLe: utilisateur.creeLe,
      restaurants,
      roleSysteme,
    });
  }

  comptes.sort((a, b) => a.email.localeCompare(b.email, "fr"));
  return { comptes, tronque };
}
