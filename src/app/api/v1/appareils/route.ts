import { enregistrerAppareil } from "@/lib/push/appareils";
import { jetonAppareilValide } from "@/lib/push/fcm";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterAppareil } from "@/lib/securite/limitation-debit";
import { lireCorpsJson, repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";

/**
 * Enregistre l'appareil du compte connecté pour les notifications poussées de l'application native. Compte identifié par le jeton porteur ; le jeton d'appareil
 * est borné et contrôlé avant tout enregistrement ; un appareil déjà connu change de propriétaire (dernière personne connectée dessus). Plafonné par compte.
 */
export async function POST(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous pour activer les notifications." });
  try {
    await limiterAppareil(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  }
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { jeton?: unknown; plateforme?: unknown; versionApp?: unknown };
  if (!jetonAppareilValide(corps.jeton) || (corps.plateforme !== "android" && corps.plateforme !== "ios")) {
    return repondreErreur({ code: "VALIDATION", message: "Appareil invalide." });
  }
  const version = typeof corps.versionApp === "string" && corps.versionApp.length <= 40 ? corps.versionApp : null;
  const ok = await enregistrerAppareil(utilisateur.id, corps.jeton, corps.plateforme, version);
  return ok ? repondre({ ok: true }) : repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer l'appareil. Réessayez dans un instant." });
}

export const dynamic = "force-dynamic";
