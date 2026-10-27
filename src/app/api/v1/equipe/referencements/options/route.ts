import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { optionsCreationEtablissement } from "@/lib/system-admin/referencements-service";

/** Catégories et quartiers proposés pour créer l'établissement d'une demande (listes officielles) : permission `restaurant.moderer`. */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, ...(await optionsCreationEtablissement()) });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les listes n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
