import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerRestaurantsEquipe } from "@/lib/system-admin/restaurants-equipe-service";

/**
 * Établissements de l'équipe dans l'application (comme `/system/catalogue/restaurants`) : permission `restaurant.moderer`. Lecture seule — la publication,
 * la suspension et la suppression restent sur le site, parce qu'elles rendent l'établissement visible par les clients ou qu'elles sont irréversibles.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, restaurants: await listerRestaurantsEquipe() });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les établissements n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
