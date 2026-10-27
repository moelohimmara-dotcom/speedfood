import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { creerEtablissementDepuisDemande } from "@/lib/system-admin/referencements-service";

/**
 * Crée l'établissement d'une demande (mêmes règles que le site) : non publié, catégorie et quartier choisis par l'équipe. Reprend le dossier d'une candidature
 * de l'application (plats, images) et prévient le candidat. Permission `restaurant.moderer`, tracé dans l'audit.
 */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await creerEtablissementDepuisDemande(c.id, c.categorieId, c.quartierId);
  if (!r.ok) return repondreErreur({ code: "VALIDATION", message: r.message });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, r.trace);
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, restaurantId: r.restaurantId, message: "Établissement créé (non publié)." });
}

export const dynamic = "force-dynamic";
