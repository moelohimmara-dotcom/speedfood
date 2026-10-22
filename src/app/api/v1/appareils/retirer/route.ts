import { retirerAppareil } from "@/lib/push/appareils";
import { jetonAppareilValide } from "@/lib/push/fcm";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterAppareil } from "@/lib/securite/limitation-debit";
import { lireCorpsJson, repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";

/** Retire l'appareil du compte (déconnexion) : il ne reçoit plus de notifications de ce compte. Sans effet si le jeton d'appareil appartient à un autre compte. */
export async function POST(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous pour gérer les notifications." });
  try {
    await limiterAppareil(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  }
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { jeton?: unknown };
  if (!jetonAppareilValide(corps.jeton)) return repondreErreur({ code: "VALIDATION", message: "Appareil invalide." });
  await retirerAppareil(utilisateur.id, corps.jeton);
  return repondre({ ok: true });
}

export const dynamic = "force-dynamic";
