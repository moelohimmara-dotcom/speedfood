import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { definirDisponibilitePlatEquipe } from "@/lib/system-admin/menus-equipe-service";

/** Action sur le menu d'un établissement tenu par l'équipe (plat épuisé ou remis en vente) : permission `restaurant.moderer`, tracée dans le journal d'audit. */
export async function POST(request: Request) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await definirDisponibilitePlatEquipe(c.restaurantId, c.platId, c.disponible);
  if (!r.ok) return repondreErreur({ code: "VALIDATION", message: r.message });
  if (r.trace) {
    try {
      await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, r.trace);
    } catch (erreur) {
      if (!(erreur instanceof ErreurMetier)) throw erreur;
    }
  }
  return repondre({ ok: true, message: r.message });
}

export const dynamic = "force-dynamic";
