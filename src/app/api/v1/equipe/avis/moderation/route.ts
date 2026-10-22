import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { modererAvis, type ActionModeration } from "@/lib/notation/gestion";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";

const ACTIONS: ActionModeration[] = ["masquer_commentaire", "annuler_note", "retablir", "classer_sans_suite"];

/**
 * Décision de modération d'un avis (masquer le commentaire, annuler la note, rétablir, classer sans suite), mêmes règles que le site : un motif est exigé pour
 * retirer du contenu public, la décision est journalisée dans l'audit. Permission `commande.support`.
 */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const avisId = typeof c.avisId === "string" ? c.avisId : "";
  const action = ACTIONS.find((a) => a === c.action);
  const motif = typeof c.motif === "string" ? c.motif : "";
  if (!estUuid(avisId) || !action) return repondreErreur({ code: "VALIDATION", message: "Demande invalide." });
  const r = await modererAvis({ avisId, action, motif, adminId: auth.contexte.utilisateurId });
  if (!r.ok) return repondreErreur({ code: "VALIDATION", message: r.erreur });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, { action: `avis.${action}`, cibleType: "avis", cibleId: avisId, motif: motif.slice(0, 300) || undefined });
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, message: "Décision enregistrée." });
}

export const dynamic = "force-dynamic";
