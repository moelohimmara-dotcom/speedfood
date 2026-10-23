import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { modifierProfilSimpleEquipe } from "@/lib/system-admin/restaurants-equipe-service";

/**
 * Modification SIMPLE d'un établissement : horaires d'ouverture et numéro interne à joindre pour confirmer les commandes. Permission `restaurant.moderer`, écriture tracée
 * dans l'audit. La publication, la suspension et la suppression restent sur le site : ce sont des décisions qui changent ce que voient les clients.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const resultat = await modifierProfilSimpleEquipe(id, String(c.horaires ?? ""), String(c.telephone ?? ""));
  if (!resultat.ok) return repondreErreur({ code: "VALIDATION", message: resultat.message });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, resultat.trace);
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, message: resultat.message });
}

export const dynamic = "force-dynamic";
