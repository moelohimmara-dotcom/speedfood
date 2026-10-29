import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { rattacherCompteCandidat } from "@/lib/system-admin/referencements-service";

/** Rattache le compte du candidat à son établissement créé, comme propriétaire (décision humaine, jamais automatique) : permission `restaurant.moderer`, tracé dans l'audit. */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await rattacherCompteCandidat(c.id);
  if (!r.ok) return repondreErreur({ code: "VALIDATION", message: r.message });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, r.trace);
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, message: "Compte rattaché à l'établissement." });
}

export const dynamic = "force-dynamic";
