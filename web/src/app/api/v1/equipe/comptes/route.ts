import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerComptesEquipe } from "@/lib/system-admin/comptes-equipe-service";

/**
 * Annuaire global des comptes : permission `compte.consulter`. Lecture seule depuis l'application ; la suppression d'un compte, la
 * suppression groupée, la réinitialisation des questions de sécurité (toutes irréversibles) et l'attribution des rôles restent sur le site
 * `/system/acces/comptes`.
 *
 * Filtres : `q` (recherche par e-mail) et `type` (`tous`, `restaurateur`, `systeme`, `sans_affiliation`, `test`).
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "compte.consulter");
  if (!auth.ok) return auth.reponse;
  try {
    const url = new URL(request.url);
    const { comptes, tronque } = await listerComptesEquipe(auth.contexte, {
      q: url.searchParams.get("q") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
    });
    return repondre({ ok: true, comptes, tronque });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les comptes n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
