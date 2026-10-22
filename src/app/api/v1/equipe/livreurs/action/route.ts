import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { actionLivreurEquipe } from "@/lib/system-admin/livraisons-service";

/** Action sur un livreur : en ligne, hors ligne, approuver, refuser, suspendre, réactiver, archiver (motif de 5 caractères au moins pour refuser, suspendre, archiver). */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await actionLivreurEquipe(auth.contexte.utilisateurId, c);
  if (!r.ok) return repondreErreur({ code: "VALIDATION", message: r.message });
  if (r.trace) {
    try {
      await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, r.trace);
    } catch (erreur) {
      if (!(erreur instanceof ErreurMetier)) throw erreur;
    }
  }
  return repondre({ ok: true, message: r.message });
}

export const dynamic = "force-dynamic";
