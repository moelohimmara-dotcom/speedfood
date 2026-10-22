import { notifierUtilisateursFcm } from "@/lib/push/appareils";
import { compteServiceConfigure } from "@/lib/push/fcm-envoi";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterEssaiPush } from "@/lib/securite/limitation-debit";
import { repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";

/**
 * Notification d'essai vers les appareils du COMPTE connecté seulement : sert à vérifier de bout en bout que l'application reçoit les notifications poussées, sans
 * passer de commande. Texte générique, aucune donnée. Plafonné (3 essais par 5 minutes et par compte).
 */
export async function POST(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous pour tester les notifications." });
  try {
    await limiterEssaiPush(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  }
  if (!compteServiceConfigure()) return repondre({ ok: true, configure: false, appareils: 0, envoyes: 0, expires: 0, echecs: 0 });
  const bilan = await notifierUtilisateursFcm([utilisateur.id], "essai");
  return repondre({ ok: true, configure: true, appareils: bilan?.appareils ?? 0, envoyes: bilan?.envoyes ?? 0, expires: bilan?.expires ?? 0, echecs: bilan?.echecs ?? 0 });
}

export const dynamic = "force-dynamic";
