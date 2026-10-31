import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerZonesAttenteEquipe } from "@/lib/system-admin/attente-equipe-service";

/**
 * Zones de la liste d'attente (« prévenez-moi »), avec le nombre de personnes et le nombre déjà prévenues : permission `attente.gerer`. Aucun
 * contact n'est renvoyé : la suppression des contacts et l'export CSV (données personnelles) restent sur le site `/system/catalogue/liste-attente`.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "attente.gerer");
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, zones: await listerZonesAttenteEquipe() });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les zones n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
