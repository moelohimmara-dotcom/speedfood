import { ajouterOption, archiverPlat, basculerDisponibilite, confirmerDisponibilite, confirmerToutesDisponibilites, creerPlat, modifierPlat, retirerOption } from "@/lib/menu/service-menu";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/**
 * Modifications du menu depuis l'application : disponibilité d'un plat, reconfirmation (un plat ou tous), création, modification, archivage d'un plat, ajout et
 * retrait d'un supplément. Chaque écriture passe par le service du menu, avec l'identité du membre (RLS) et le restaurant du compte. Les photos se gèrent sur le site.
 */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const { supabase, restaurantId } = auth.contexte;

  let resultat;
  switch (c.action) {
    case "disponibilite":
      resultat = await basculerDisponibilite(supabase, restaurantId, c.platId, c.disponible);
      break;
    case "confirmer":
      resultat = await confirmerDisponibilite(supabase, restaurantId, c.platId);
      break;
    case "confirmer_tout":
      resultat = await confirmerToutesDisponibilites(supabase, restaurantId);
      break;
    case "creer":
      resultat = await creerPlat(supabase, restaurantId, c);
      break;
    case "modifier":
      resultat = await modifierPlat(supabase, restaurantId, c.platId, c);
      break;
    case "archiver":
      resultat = await archiverPlat(supabase, restaurantId, c.platId);
      break;
    case "option_ajouter":
      resultat = await ajouterOption(supabase, restaurantId, c.platId, c);
      break;
    case "option_retirer":
      resultat = await retirerOption(supabase, restaurantId, c.optionId);
      break;
    default:
      return repondreErreur({ code: "VALIDATION", message: "Action inconnue." });
  }
  return resultat.ok ? repondre({ ok: true }) : repondreErreur({ code: "VALIDATION", message: resultat.message });
}

export const dynamic = "force-dynamic";
