import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { changerStatutPartenariatEquipe } from "@/lib/system-admin/attente-equipe-service";

/**
 * Changement de statut d'une demande de partenariat (permission `attente.gerer`) : la demande avance dans le suivi, écriture tracée dans
 * l'audit sans y écrire les coordonnées. La suppression d'une demande reste sur le site : elle est irréversible.
 */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "attente.gerer");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const resultat = await changerStatutPartenariatEquipe(String(c.id ?? ""), String(c.statut ?? ""));
  if (!resultat.ok) return repondreErreur({ code: "VALIDATION", message: resultat.message });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, resultat.trace);
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, message: resultat.message });
}

export const dynamic = "force-dynamic";
