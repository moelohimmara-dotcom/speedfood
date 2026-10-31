import { repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";
import { lireRolesCompte } from "@/lib/api/moi-service";
import { limiterClientApplication } from "@/lib/securite/limitation-debit";
import { ErreurMetier } from "@/lib/contracts/erreurs";

/**
 * Quels espaces ce compte peut-il ouvrir dans l'application ? Le client est l'espace de tout le monde ; les espaces professionnels (restaurateur, livreur, équipe
 * Speedfood) n'apparaissent QUE pour les comptes qui en ont le droit : l'application n'affiche rien d'autre. Information d'affichage seulement : chaque route
 * d'un espace revérifie le droit elle-même. Un compte sans rôle reçoit trois valeurs vides, jamais une erreur (la route ne révèle rien sur l'existence des espaces).
 */
export async function GET(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous avec votre compte." });
  try {
    await limiterClientApplication(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  }

  return repondre({ ok: true, roles: await lireRolesCompte(utilisateur.id) });
}

export const dynamic = "force-dynamic";
