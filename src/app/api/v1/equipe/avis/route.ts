import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { calculerAlertes, listerSignalementsEnAttente } from "@/lib/notation/gestion";

/**
 * Modération des avis dans l'application de l'équipe : signalements à examiner et alertes de qualité (restaurants ou livreurs sous 3,5 sur 5), comme `/system/avis`.
 * Permission `commande.support`. Lecture seule : les décisions passent par `/api/v1/equipe/avis/moderation` (motif, audit).
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  try {
    const [signalements, alertes] = await Promise.all([listerSignalementsEnAttente(), calculerAlertes()]);
    return repondre({ ok: true, signalements, alertes });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les avis n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
