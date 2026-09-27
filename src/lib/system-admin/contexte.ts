import "server-only";
import { notFound } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { estRoleSysteme, roleAPermission, type Permission, type RoleSysteme } from "./permissions";

/**
 * Vérifications serveur centralisées du CMS système (bloc 8a).
 *
 * Le rôle est lu via la session utilisateur (`creerClientServeur()`, clé anon)
 * et la policy RLS existante `lecture_son_propre_role_systeme` sur
 * `system_admin_memberships` : la base reste la seule source d'autorité, le code
 * ne duplique aucune logique d'adhésion.
 *
 * SÉPARATION STRICTE DES SURFACES (ADR-010) : cette lecture ne touche JAMAIS à
 * `restaurant_memberships` — un propriétaire de restaurant ne peut pas obtenir
 * d'accès `/system`, et rien ici ne lit les memberships restaurant.
 *
 * Politique de refus (« jamais de fuite sur l'existence de /system ») :
 * - visiteur anonyme ou sans rôle système → `notFound()` (404 identique à une
 *   URL inexistante) ;
 * - rôle système sans la permission demandée → `ErreurMetier("NON_AUTORISE")`
 *   via `verifierPermission` (Server Actions / route handlers), ou `notFound()`
 *   via `exigerPermissionPage` (pages), pour ne pas révéler les sections internes.
 *
 * Ces fonctions ne remplacent pas la RLS : elles orientent l'interface et
 * cadrent les actions serveur, la RLS applique elle-même les mêmes rôles.
 */

export interface ContexteSysteme {
  supabase: Awaited<ReturnType<typeof creerClientServeur>>;
  utilisateurId: string;
  role: RoleSysteme;
}

/** Charge le contexte système, ou `null` si la session n'a aucun rôle système. */
async function chargerContexteSysteme(): Promise<ContexteSysteme | null> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Lecture RLS : l'utilisateur ne voit que sa propre ligne (les super_admin
  // voient aussi celles des autres, inutile ici).
  const { data: membership, error } = await supabase
    .from("system_admin_memberships")
    .select("role")
    .eq("utilisateur_id", user.id)
    .maybeSingle();

  // Refus par défaut en cas d'erreur, d'absence de ligne ou de rôle hors matrice.
  if (error || !membership || !estRoleSysteme(membership.role)) {
    return null;
  }

  return { supabase, utilisateurId: user.id, role: membership.role };
}

/**
 * Contexte du CMS pour un utilisateur à rôle système. Sans rôle système → 404
 * (aucune fuite d'information). À appeler en tête de chaque page `/system`.
 */
export async function obtenirContexteSysteme(): Promise<ContexteSysteme> {
  const contexte = await chargerContexteSysteme();
  if (!contexte) {
    notFound();
  }
  return contexte;
}

/**
 * Vérifie une permission pour le rôle courant et renvoie le contexte.
 * - sans rôle système → 404 (`notFound()`) ;
 * - rôle système sans la permission → `ErreurMetier("NON_AUTORISE", ...)`.
 *
 * Usage : Server Actions (catch `ErreurMetier` → `erreur.toApi()`) et route
 * handlers. Pour une page, préférer `exigerPermissionPage`.
 */
export async function verifierPermission(permission: Permission): Promise<ContexteSysteme> {
  const contexte = await obtenirContexteSysteme();
  if (!roleAPermission(contexte.role, permission)) {
    throw new ErreurMetier(
      "NON_AUTORISE",
      "Votre rôle système ne permet pas cette action.",
      { permission: "Accès refusé pour ce rôle." }
    );
  }
  return contexte;
}

/**
 * Variante « page » de `verifierPermission` : même contrôle, mais un refus
 * produit une 404 plutôt qu'une page d'erreur, pour ne pas révéler quelles
 * sections existent derrière `/system`.
 */
export async function exigerPermissionPage(permission: Permission): Promise<ContexteSysteme> {
  const contexte = await obtenirContexteSysteme();
  if (!roleAPermission(contexte.role, permission)) {
    notFound();
  }
  return contexte;
}
