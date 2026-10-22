import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { creerClientAdmin } from "@/lib/db/admin";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { appliquerActionRepartition } from "@/lib/system-admin/repartition-service";

/**
 * Fait avancer une commande d'un établissement tenu par l'équipe : accepter, refuser, prête, remise (« terminee »), annuler. Même chemin que le site
 * (`appliquerActionRepartition`) ; permission `commande.support` ; l'action est tracée dans le journal d'audit.
 */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;

  const resultat = await appliquerActionRepartition(creerClientAdmin(), auth.contexte.utilisateurId, c.commandeId, c.action);
  if (!resultat.ok) return repondreErreur({ code: "VALIDATION", message: resultat.message });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, {
      action: "repartition.commande",
      cibleType: "commande",
      cibleId: String(c.commandeId),
      motif: `${resultat.de} -> ${resultat.vers}`,
    });
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, statut: resultat.vers });
}

export const dynamic = "force-dynamic";
