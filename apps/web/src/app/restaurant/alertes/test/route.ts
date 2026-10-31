import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterEssaiPush } from "@/lib/securite/limitation-debit";
import { notifierUtilisateur } from "@/lib/push/envoi";
import { obtenirMembreCourant, origineValide, reponseJson } from "@/lib/push/session";

export const dynamic = "force-dynamic";

/**
 * Envoie une notification d'essai aux appareils du membre connecté, pour qu'il vérifie que l'alerte « page
 * fermée » fonctionne avant d'en avoir besoin. Limité à 3 essais par 5 minutes.
 */
export async function POST(requete: Request): Promise<Response> {
  if (!origineValide(requete)) {
    return reponseJson({ code: "NON_AUTORISE" }, 403);
  }
  const resultat = await obtenirMembreCourant();
  if ("erreur" in resultat) {
    return resultat.erreur;
  }
  try {
    await limiterEssaiPush(resultat.membre.utilisateurId);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return reponseJson({ code: "TROP_DE_REQUETES" }, 429);
    }
    throw erreur;
  }
  const bilan = await notifierUtilisateur(resultat.membre.utilisateurId);
  if (bilan === null) {
    return reponseJson({ code: "NON_CONFIGURE" }, 503);
  }
  return reponseJson({ abonnes: bilan.abonnes, envoyes: bilan.envoyes });
}
