import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { lireMisesAJourEquipe } from "@/lib/system-admin/contenus-equipe-service";

/**
 * L'état des mises à jour : version publiée, dernière annonce aux téléphones, interrupteurs pilotables et journal des nouveautés livrées.
 * Permission `parametres.editer` (réservée à `super_admin`), comme sur `/system/mises-a-jour`.
 *
 * Lecture seule : basculer un interrupteur ou annoncer une version change ce que voit le public et envoie des notifications ; cela reste
 * sur le site.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "parametres.editer");
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, ...(await lireMisesAJourEquipe(auth.contexte)) });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les mises à jour n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
