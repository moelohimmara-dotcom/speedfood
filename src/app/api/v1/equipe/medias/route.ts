import { repondre, repondreErreur } from "@/lib/api/v1";
import { contexteSystemeDepuisApi, equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { listerBannieresEquipe } from "@/lib/system-admin/contenus-equipe-service";
import { MINIMUMS_STUDIO } from "@/lib/system-admin/paliers";
import { verifierPalier } from "@/lib/system-admin/paliers-serveur";

/**
 * La bibliothèque de médias : les images utilisées par les bannières, comme sur `/system/contenu/medias`. Lecture seule, et pas un espace
 * d'upload : l'envoi d'une image reste dans l'écran « Bannières » du site, pour ne pas dupliquer ce flux.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "contenu.editer");
  if (!auth.ok) return auth.reponse;
  try {
    await verifierPalier("contenu:bannieres", MINIMUMS_STUDIO.lire, { contexte: contexteSystemeDepuisApi(auth.contexte) });
    const { bannieres, tronque } = await listerBannieresEquipe(auth.contexte, { seulementAvecImage: true });
    return repondre({ ok: true, bannieres, tronque });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les médias n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
