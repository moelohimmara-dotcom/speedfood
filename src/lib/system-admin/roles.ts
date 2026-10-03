"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { ROLES_SYSTEME, type RoleSysteme } from "./permissions";

/**
 * Attribution/retrait des rôles système (`system_admin_memberships`), écran
 * `/system/acces/roles` — réservé à `super_admin` (permission `systeme.roles`).
 * `auth.users` n'étant pas exposé via PostgREST, les emails viennent de l'API
 * admin Auth (service-role), comme dans `annuaire.ts`.
 */

export interface EtatActionRole {
  erreur?: string;
  succes?: boolean;
}

export interface MembreRoleSysteme {
  utilisateurId: string;
  email: string;
  role: RoleSysteme;
  creeLe: string;
}

export async function listerRolesSysteme(): Promise<MembreRoleSysteme[]> {
  await verifierPermission("systeme.roles");
  const admin = creerClientAdmin();

  const { data: memberships, error } = await admin
    .from("system_admin_memberships")
    .select("utilisateur_id, role, cree_le")
    .order("cree_le", { ascending: true });

  if (error || !memberships) {
    return [];
  }

  const membres: MembreRoleSysteme[] = [];
  for (const membership of memberships) {
    const { data } = await admin.auth.admin.getUserById(membership.utilisateur_id);
    if (!data?.user?.email) {
      continue;
    }
    membres.push({
      utilisateurId: membership.utilisateur_id,
      email: data.user.email,
      role: membership.role as RoleSysteme,
      creeLe: membership.cree_le,
    });
  }

  return membres;
}

/**
 * Le garde-fou « dernier super_admin » est appliqué EN BASE par le trigger
 * `fn_garder_dernier_super_admin` (revue de sécurité, point 5) : suppression ou
 * rétrogradation du dernier super_admin refusée, même par appel direct à l'API ou
 * en cas de demandes simultanées. Ces messages ne servent qu'à l'expliquer.
 */
const MESSAGE_DERNIER_SUPER_ADMIN =
  "Impossible de retirer le dernier super_admin : au moins un compte doit conserver ce rôle.";

function estRefusDernierSuperAdmin(erreur: { message?: string } | null): boolean {
  return Boolean(erreur?.message?.includes("Dernier super_admin"));
}

export async function attribuerRoleAction(
  _etatPrecedent: EtatActionRole,
  formData: FormData
): Promise<EtatActionRole> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleBrut = String(formData.get("role") ?? "");

  if (!email) {
    return { erreur: "L'email est obligatoire." };
  }
  if (!ROLES_SYSTEME.includes(roleBrut as RoleSysteme)) {
    return { erreur: "Rôle invalide." };
  }
  const role = roleBrut as RoleSysteme;

  const contexte = await verifierPermission("systeme.roles");
  const supabase = await creerClientServeur();

  const { data: trouve, error: erreurRecherche } = await supabase.rpc(
    "fn_trouver_utilisateur_par_email",
    { p_email: email }
  );
  if (erreurRecherche) {
    return { erreur: "Impossible de rechercher ce compte. Réessayez dans un instant." };
  }
  const utilisateur = trouve?.[0];
  if (!utilisateur) {
    return {
      erreur:
        "Aucun compte Speedfood n'existe avec cet email. La personne doit d'abord créer un compte via /inscription, puis vous pourrez lui attribuer un rôle.",
    };
  }

  const admin = creerClientAdmin();
  const { error: erreurUpsert } = await admin
    .from("system_admin_memberships")
    .upsert({ utilisateur_id: utilisateur.id, role }, { onConflict: "utilisateur_id" });

  if (erreurUpsert) {
    if (estRefusDernierSuperAdmin(erreurUpsert)) {
      return { erreur: MESSAGE_DERNIER_SUPER_ADMIN.replace("retirer", "rétrograder") };
    }
    return { erreur: "Impossible d'attribuer ce rôle. Réessayez dans un instant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "systeme.attribution_role",
    cibleType: "utilisateur",
    cibleId: utilisateur.id,
    motif: `Attribution du rôle ${role} à ${email}`,
  });

  revalidatePath("/system/acces/roles");
  return { succes: true };
}

export async function retirerRoleAction(
  utilisateurId: string,
  email: string
): Promise<{ erreur?: string }> {
  const contexte = await verifierPermission("systeme.roles");

  // Le rôle est relu en base : jamais pris d'un paramètre envoyé par le navigateur.
  const admin = creerClientAdmin();
  const { data: existant } = await admin
    .from("system_admin_memberships")
    .select("role")
    .eq("utilisateur_id", utilisateurId)
    .maybeSingle();
  if (!existant) {
    return { erreur: "Ce compte n'a pas de rôle système." };
  }
  const role = existant.role;

  const { error } = await admin
    .from("system_admin_memberships")
    .delete()
    .eq("utilisateur_id", utilisateurId);

  if (error) {
    if (estRefusDernierSuperAdmin(error)) {
      return { erreur: MESSAGE_DERNIER_SUPER_ADMIN };
    }
    return { erreur: "Impossible de retirer ce rôle. Réessayez dans un instant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "systeme.retrait_role",
    cibleType: "utilisateur",
    cibleId: utilisateurId,
    motif: `Retrait du rôle ${role} de ${email}`,
  });

  revalidatePath("/system/acces/roles");
  return {};
}
