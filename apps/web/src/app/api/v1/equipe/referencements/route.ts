import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerDemandesReferencement } from "@/lib/system-admin/referencements-lecture";

/**
 * Demandes de référencement dans l'application de l'équipe (comme `/system/catalogue/referencements`) : permission `restaurant.moderer`. Le numéro de téléphone du
 * responsable est envoyé parce que l'équipe doit le rappeler ; son e-mail ne l'est pas (inutile sur un téléphone). La création de la fiche et le rattachement du compte du candidat se font aussi ici (routes voisines) ; la suppression reste sur le site.
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
        // Dossier déposé depuis l'application : jamais de chemin de fichier ni d'identifiant de compte, seulement ce qu'il faut pour décider.
        candidature: d.candidature
          ? {
              horaires: d.candidature.horaires,
              moyensPaiement: d.candidature.moyensPaiement,
              services: d.candidature.services,
              nombrePlats: d.candidature.nombrePlats,
              avecLogo: d.candidature.logoChemin !== null,
              avecPhoto: d.candidature.photoChemin !== null,
              motifRefus: d.candidature.motifRefus,
              compteRattachable: d.candidature.utilisateurId !== null && d.restaurantId !== null && !d.candidature.compteRattache,
              compteRattache: d.candidature.compteRattache,
            }
          : null,
      })),
    });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les demandes n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
