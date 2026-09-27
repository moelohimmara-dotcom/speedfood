"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Gestion des équipiers d'un restaurant (bloc 8b). Volontairement PAS
 * d'invitation par email : aucun canal de notification n'est choisi
 * (ADR-007, bloc 10 bloqué). Un compte doit déjà exister (créé via
 * /inscription) pour être ajouté ici — voir fn_trouver_utilisateur_par_email.
 */

export interface EtatActionCompte {
  erreur?: string;
  succes?: boolean;
}

export interface MembreRestaurant {
  utilisateur_id: string;
  email: string;
  role: string;
  cree_le: string;
}

export async function listerMembresAdmin(restaurantId: string): Promise<MembreRestaurant[]> {
  await verifierPermission("compte.consulter");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase.rpc("fn_lister_membres_restaurant", {
    p_restaurant_id: restaurantId,
  });

  if (error || !data) {
    return [];
  }
  return data;
}

export async function inviterEquipierAction(
  _etatPrecedent: EtatActionCompte,
  formData: FormData
): Promise<EtatActionCompte> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }
  if (!email) {
    return { erreur: "L'email est obligatoire." };
  }

  const contexte = await verifierPermission("compte.inviter");
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
        "Aucun compte Speedfood n'existe avec cet email. La personne doit d'abord créer un compte via /inscription, puis vous pourrez l'ajouter ici.",
    };
  }

  const { data: dejaMembre } = await supabase
    .from("restaurant_memberships")
    .select("utilisateur_id")
    .eq("restaurant_id", restaurantId)
    .eq("utilisateur_id", utilisateur.id)
    .maybeSingle();
  if (dejaMembre) {
    return { erreur: "Cette personne fait déjà partie de l'équipe de ce restaurant." };
  }

  const { error: erreurInsertion } = await supabase.from("restaurant_memberships").insert({
    restaurant_id: restaurantId,
    utilisateur_id: utilisateur.id,
    role: "manager",
  });

  if (erreurInsertion) {
    return { erreur: "Impossible d'ajouter ce compte à l'équipe. Réessayez dans un instant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "compte.invitation",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif: `Ajout de ${email} comme équipier`,
  });

  revalidatePath(`/system/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function revoquerEquipierAction(
  restaurantId: string,
  utilisateurId: string
): Promise<void> {
  const contexte = await verifierPermission("compte.inviter");
  const supabase = await creerClientServeur();

  // Le propriétaire (role "owner") ne se révoque pas depuis cet écran : seuls
  // les équipiers ("manager") le peuvent, pour ne jamais retirer accidentellement
  // le seul compte propriétaire d'un restaurant.
  await supabase
    .from("restaurant_memberships")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("utilisateur_id", utilisateurId)
    .eq("role", "manager");

  await journaliserActionSysteme(contexte, {
    action: "compte.revocation",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif: `Retrait de l'équipier ${utilisateurId}`,
  });

  revalidatePath(`/system/restaurants/${restaurantId}`);
}
