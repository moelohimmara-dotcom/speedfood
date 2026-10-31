import { annulerParClient } from "@/lib/commande/annulation-client";
import { estJetonValide } from "@/lib/commande/jetons";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterAnnulationClient } from "@/lib/securite/limitation-debit";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { relaisSiActif } from "@/lib/api/relais";

/**
 * Annulation de la commande par son client, depuis l'application native. Le jeton de suivi (reçu à la création) est la clé d'accès, dans le corps de la requête. Possible
 * seulement tant que le restaurant n'a pas répondu ; idempotent (une commande déjà annulée répond « ok »). Voir `annulerParClient`.
 */
export async function POST(request: Request) {
  const relais = await relaisSiActif(request, "suivi", { delaiMs: 8000 });
  if (relais) return relais;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const jeton = typeof lu.corps === "object" && lu.corps !== null && "jeton" in lu.corps ? (lu.corps as { jeton: unknown }).jeton : null;
  if (!estJetonValide(jeton)) return repondreErreur({ code: "VALIDATION", message: "Lien de suivi invalide." });

  try {
    await limiterAnnulationClient();
    const { reference } = await annulerParClient(jeton);
    return repondre({ ok: true, reference });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
