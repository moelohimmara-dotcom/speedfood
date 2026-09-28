import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { LigneCommande, LigneCommandeClient } from "@/lib/contracts/commande";
import type { ClientCommandeDb } from "./commun";
import { PRIX_MAX_GNF } from "./validation";

/**
 * Recalcul serveur de la commande (TDR.md §6, ADR-006) : les prix et totaux
 * envoyés par le navigateur sont systématiquement ignorés. Tout vient de
 * `menu_items` au moment de la création.
 */

export interface LignesRecalculees {
  lignes: LigneCommande[];
  sousTotal: number;
}

/**
 * Vérifie que le restaurant est commandable (publié, non suspendu, ouvert) et
 * renvoie son nom. Une 404 volontaire en cas d'indisponibilité : pas de fuite
 * d'information sur un restaurant non publié.
 */
export async function verifierRestaurantCommandable(
  db: ClientCommandeDb,
  restaurantId: string
): Promise<{ nom: string }> {
  const { data: restaurant, error } = await db
    .from("restaurants")
    .select("id, nom, publie, ouvert, suspendu_le")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de vérifier le restaurant. Réessayez.");
  }
  if (!restaurant || !restaurant.publie || restaurant.suspendu_le !== null) {
    throw new ErreurMetier("INTROUVABLE", "Ce restaurant n'est pas disponible à la commande.");
  }
  if (!restaurant.ouvert) {
    throw new ErreurMetier(
      "VALIDATION",
      "Ce restaurant est actuellement fermé : impossible de passer commande pour le moment.",
      { restaurant: "Restaurant fermé." }
    );
  }
  return { nom: restaurant.nom };
}

/**
 * Recalcule les lignes et le sous-total depuis le menu courant.
 * Un plat introuvable, archivé, indisponible ou appartenant à un autre
 * restaurant entraîne le rejet complet de la commande (aucun total approximatif).
 */
export async function recalculerLignes(
  db: ClientCommandeDb,
  restaurantId: string,
  lignesClient: LigneCommandeClient[]
): Promise<LignesRecalculees> {
  const ids = lignesClient.map((l) => l.menuItemId);
  const optionIds = [...new Set(lignesClient.flatMap((l) => l.optionIds))];

  const [{ data: plats, error }, { data: options, error: erreurOptions }] = await Promise.all([
    db
      .from("menu_items")
      .select("id, nom, prix, prix_promo, disponible, archive_le, restaurant_id")
      .in("id", ids),
    optionIds.length > 0
      ? db.from("menu_item_options").select("id, nom, prix, disponible, menu_item_id").in("id", optionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (error || erreurOptions) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de vérifier le menu. Réessayez.");
  }

  const parId = new Map((plats ?? []).map((p) => [p.id, p]));
  const optionsParId = new Map((options ?? []).map((o) => [o.id, o]));
  const lignes: LigneCommande[] = [];
  let sousTotal = 0;

  for (const ligne of lignesClient) {
    const plat = parId.get(ligne.menuItemId);
    if (
      !plat ||
      plat.restaurant_id !== restaurantId ||
      plat.archive_le !== null ||
      !plat.disponible
    ) {
      throw new ErreurMetier(
        "VALIDATION",
        "Un ou plusieurs plats de votre panier ne sont plus disponibles. Mettez à jour votre panier avant de commander.",
        { lignes: `Plat indisponible : ${plat?.nom ?? ligne.menuItemId}` }
      );
    }
    if (!Number.isInteger(plat.prix) || plat.prix < 0 || plat.prix > PRIX_MAX_GNF) {
      throw new ErreurMetier("ERREUR_SERVEUR", "Prix de plat invalide en base.");
    }
    if (
      plat.prix_promo !== null &&
      (!Number.isInteger(plat.prix_promo) || plat.prix_promo < 0 || plat.prix_promo > plat.prix)
    ) {
      throw new ErreurMetier("ERREUR_SERVEUR", "Prix promo invalide en base.");
    }

    // Suppléments choisis : chacun doit appartenir à CE plat et être encore
    // disponible — jamais faire confiance à un optionId envoyé par le
    // navigateur sans revérifier son rattachement (sinon un client pourrait
    // s'attribuer le supplément d'un autre plat, moins cher ou gratuit).
    const optionsChoisies: { id: string; nom: string; prix: number }[] = [];
    for (const optionId of ligne.optionIds) {
      const option = optionsParId.get(optionId);
      if (!option || option.menu_item_id !== plat.id || !option.disponible) {
        throw new ErreurMetier(
          "VALIDATION",
          "Un ou plusieurs suppléments de votre panier ne sont plus disponibles. Mettez à jour votre panier avant de commander.",
          { lignes: `Supplément indisponible pour : ${plat.nom}` }
        );
      }
      if (!Number.isInteger(option.prix) || option.prix < 0 || option.prix > PRIX_MAX_GNF) {
        throw new ErreurMetier("ERREUR_SERVEUR", "Prix de supplément invalide en base.");
      }
      optionsChoisies.push({ id: option.id, nom: option.nom, prix: option.prix });
    }

    // Prix effectif = prix promo s'il existe, sinon prix normal, plus la
    // somme des suppléments. Instantané (ADR-006) : nom et prix copiés tels
    // quels au moment de l'envoi — un changement ultérieur du prix, du promo
    // ou d'un supplément ne modifie jamais une commande déjà créée.
    const prixPlatEffectif = plat.prix_promo ?? plat.prix;
    const prixOptions = optionsChoisies.reduce((total, o) => total + o.prix, 0);
    const prixLigne = prixPlatEffectif + prixOptions;

    lignes.push({
      menuItemId: plat.id,
      nom: plat.nom,
      prix: prixLigne,
      quantite: ligne.quantite,
      options: optionsChoisies,
    });
    sousTotal += prixLigne * ligne.quantite;
  }

  return { lignes, sousTotal };
}
