import { repondre } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerMenusEquipe } from "@/lib/system-admin/menus-equipe-service";

/** Fraîcheur des menus des établissements tenus par l'équipe (plats à reconfirmer, épuisés, dernière confirmation) : permission `restaurant.moderer`. */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  return repondre({ ok: true, ...(await listerMenusEquipe()) });
}

export const dynamic = "force-dynamic";
