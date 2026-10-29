import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { lireParametresEquipe } from "@/lib/system-admin/contenus-equipe-service";

/**
 * Les réglages globaux de l'application, en lecture seule. Permission `parametres.editer` (réservée à `super_admin`), comme sur
 * `/system/parametres`.
 *
 * L'application permet de consulter un réglage (utile en assistance : quel délai de proposition ? quel plafond de prix ?) ; le modifier
 * reste sur le site, où le formulaire est validé, tracé au journal d'audit et borné par les règles de la base.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "parametres.editer");
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, parametres: await lireParametresEquipe(auth.contexte) });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les paramètres n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
