import { repondre, repondreErreur } from "@/lib/api/v1";
import { contexteSystemeDepuisApi, equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { listerBannieresEquipe } from "@/lib/system-admin/contenus-equipe-service";
import { MINIMUMS_STUDIO } from "@/lib/system-admin/paliers";
import { verifierPalier } from "@/lib/system-admin/paliers-serveur";

/**
 * Les bannières diffusées sur les écrans publics : permission `contenu.editer` ET palier `contenu:bannieres` (lecture), exactement comme
 * sur `/system/contenu/bannieres`. Lecture seule : créer, publier ou supprimer une bannière reste sur le site, parce qu'une bannière
 * publiée change ce que voit le public.
 *
 * Filtre : `statut` (`tous`, `publie`, `brouillon` ; une valeur inconnue retombe sur « toutes »).
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "contenu.editer");
  if (!auth.ok) return auth.reponse;
  try {
    await verifierPalier("contenu:bannieres", MINIMUMS_STUDIO.lire, { contexte: contexteSystemeDepuisApi(auth.contexte) });
    const url = new URL(request.url);
    const { bannieres, tronque } = await listerBannieresEquipe(auth.contexte, {
      statut: url.searchParams.get("statut") ?? undefined,
    });
    return repondre({ ok: true, bannieres, tronque });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les bannières n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
