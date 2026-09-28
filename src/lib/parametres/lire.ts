import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Lecture des paramètres globaux (`parametres_application`, table singleton).
 * Via `creerClientAdmin()` (service-role, bypass RLS) : ces valeurs sont
 * consommées par du code qui n'a souvent aucune session de rôle système
 * (un restaurateur qui crée un plat, un client qui envoie une commande) — la
 * policy `admins_lecture_parametres` ne gouverne que l'écran d'administration
 * `/system/parametres`, pas cette lecture applicative.
 *
 * Valeurs de repli si la ligne est introuvable (ne devrait jamais arriver,
 * la migration insère la ligne unique) : mêmes valeurs que les anciennes
 * constantes en dur, pour ne jamais durcir une règle par accident si la
 * lecture échoue.
 */

export interface ParametresApplication {
  commandePropositionDelaiMinutes: number;
  prixPlatMaxGnf: number;
}

const VALEURS_REPLI: ParametresApplication = {
  commandePropositionDelaiMinutes: 30,
  prixPlatMaxGnf: 5_000_000,
};

export async function obtenirParametresApplication(): Promise<ParametresApplication> {
  const admin = creerClientAdmin();
  const { data, error } = await admin
    .from("parametres_application")
    .select("commande_proposition_delai_minutes, prix_plat_max_gnf")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    return VALEURS_REPLI;
  }

  return {
    commandePropositionDelaiMinutes: data.commande_proposition_delai_minutes,
    prixPlatMaxGnf: data.prix_plat_max_gnf,
  };
}
