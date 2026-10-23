import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerDemandesReferencement } from "@/lib/system-admin/referencements-lecture";

/**
 * Demandes de référencement dans l'application de l'équipe (comme `/system/catalogue/referencements`) : permission `restaurant.moderer`. Le numéro de téléphone du
 * responsable est envoyé parce que l'équipe doit le rappeler ; son e-mail ne l'est pas (inutile sur un téléphone). Création de la fiche et suppression : sur le site.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  try {
    const demandes = await listerDemandesReferencement();
    return repondre({
      ok: true,
      demandes: demandes.map((d) => ({
        id: d.id,
        type: d.type,
        organisation: d.organisation,
        commune: d.commune,
        quartier: d.quartier,
        indications: d.indications,
        categories: d.categories,
        specialites: d.specialites,
        responsable: d.responsable,
        telephone: d.telephone,
        statut: d.statut,
        etablissementCree: d.restaurantId !== null,
        creeLe: d.creeLe,
      })),
    });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les demandes n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
