import { estJetonValide } from "@/lib/commande/jetons";
import { repondreProposition } from "@/lib/commande/propositions";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterReponseProposition } from "@/lib/securite/limitation-debit";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { relaisSiActif } from "@/lib/api/relais";

/**
 * Réponse du client à une proposition révisée du restaurant (nouveau total ou nouvelles conditions), depuis l'application native. Même règle que
 * l'action du site : seul le porteur du jeton de suivi peut répondre ; la réponse est idempotente ; rien n'est préparé avant elle.
 */
export async function POST(request: Request) {
  const relais = await relaisSiActif(request, "suivi", { delaiMs: 8000 });
  if (relais) return relais;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { jeton?: unknown; propositionId?: unknown; reponse?: unknown };

  if (!estJetonValide(corps.jeton)) return repondreErreur({ code: "VALIDATION", message: "Lien de suivi invalide." });
  if (corps.reponse !== "acceptee" && corps.reponse !== "refusee") return repondreErreur({ code: "VALIDATION", message: "Réponse invalide." });
  if (typeof corps.propositionId !== "string" || corps.propositionId.length === 0 || corps.propositionId.length > 64) {
    return repondreErreur({ code: "VALIDATION", message: "Proposition invalide." });
  }

  try {
    await limiterReponseProposition();
    await repondreProposition(corps.jeton, corps.propositionId, corps.reponse);
    return repondre({ ok: true });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
