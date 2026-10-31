import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerPartenariatsEquipe } from "@/lib/system-admin/attente-equipe-service";

/**
 * Demandes de partenariat reçues par la page « Devenir partenaire » : permission `attente.gerer`. Lecture seule depuis l'application ; la
 * suppression d'une demande (irréversible) et l'export des contacts (données personnelles) restent sur le site `/system/catalogue/partenariats`.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "attente.gerer");
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, partenariats: await listerPartenariatsEquipe() });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les demandes n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
