import { estJetonValide } from "@/lib/commande/jetons";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterLectureSuivi } from "@/lib/securite/limitation-debit";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";

/**
 * Suivi d'une commande par l'application native : le jeton de suivi (reçu à la création) est la clé d'accès, comme sur le site. Il voyage dans le corps de la
 * requête (jamais dans l'adresse, qui finit dans des journaux). Vue publique : AUCUN téléphone ni adresse de client. Plafonné par jeton (relectures de statut).
 */
export async function POST(request: Request) {
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;

  const jeton = typeof lu.corps === "object" && lu.corps !== null && "jeton" in lu.corps ? (lu.corps as { jeton: unknown }).jeton : null;
  if (!estJetonValide(jeton)) return repondreErreur({ code: "VALIDATION", message: "Lien de suivi invalide." });

  try {
    await limiterLectureSuivi(jeton);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  }

  const suivi = await chargerSuiviParJeton(jeton);
  if (!suivi) return repondreErreur({ code: "INTROUVABLE", message: "Commande introuvable." });
  return repondre({ ok: true, suivi });
}

export const dynamic = "force-dynamic";
