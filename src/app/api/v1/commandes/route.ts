import { executerCreationCommande } from "@/lib/commande/creation-service";
import { validerCreationCommande } from "@/lib/commande/validation";
import { listerMesCommandes } from "@/lib/client/mes-commandes";
import { lireCorpsJson, repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";

/**
 * Commandes de l'application native (ADR-019). Authentification : jeton porteur uniquement ; sans compte identifié, aucune commande ne se crée (TDR v0.2 §5.1).
 *
 *  - POST : crée une commande, MÊME chemin que le site (`executerCreationCommande`) : validation, plafonds de débit, prix et frais recalculés côté serveur,
 *    idempotence par `cleIdempotence`. La réponse porte le jeton de suivi, clé d'accès du client à son suivi.
 *  - GET : les commandes du compte (sans jeton de suivi : l'application garde celui reçu à la création, ou rouvre le suivi depuis le site).
 */
export async function POST(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous pour envoyer votre commande." });

  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;

  // Pas de commande à table sans compte ni par cette porte : l'application commande en retrait ou en livraison.
  const corps = lu.corps as { mode?: unknown } | null;
  if (typeof corps === "object" && corps !== null && corps.mode === "sur_place") {
    return repondreErreur({ code: "VALIDATION", message: "La commande à table se fait en scannant le QR de la table, depuis le site." });
  }

  const validation = validerCreationCommande(lu.corps);
  if (!validation.ok) return repondreErreur(validation.erreur);

  const resultat = await executerCreationCommande(validation.valeurs, utilisateur.id, { antiRobot: false });
  if (!resultat.ok) return repondreErreur(resultat.erreur);
  return repondre(resultat, resultat.idempotent ? 200 : 201);
}

export async function GET(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous pour voir vos commandes." });
  const commandes = await listerMesCommandes(utilisateur.id);
  return repondre({ ok: true, commandes });
}

export const dynamic = "force-dynamic";
