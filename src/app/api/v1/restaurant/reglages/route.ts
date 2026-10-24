import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";
import { etatDisponibilite } from "@/lib/disponibilite/etat";
import { obtenirParametresApplication } from "@/lib/parametres/lire";

/**
 * Réglages du poste de travail du restaurateur : les horaires d'ouverture qu'il déclare, l'état du service et les plats à reconfirmer.
 *
 * La règle « plat à reconfirmer » est celle du serveur (`etatDisponibilite` et le seuil de fraîcheur global) : l'application l'affiche, elle ne
 * la recalcule pas. Les horaires sont la seule chose écrite ici ; publier le menu et ses prix engage le client, cela reste sur le site.
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { supabase, restaurantId } = auth.contexte;
  try {
    const [restaurant, plats, parametres] = await Promise.all([
      supabase.from("restaurants").select("horaires, ouvert, accepte_commandes").eq("id", restaurantId).maybeSingle(),
      supabase
        .from("menu_items")
        .select("id, nom, disponible, disponibilite_confirmee_le")
        .eq("restaurant_id", restaurantId)
        .is("archive_le", null)
        .eq("disponible", true),
      obtenirParametresApplication(),
    ]);
    if (restaurant.error || !restaurant.data) {
      return repondreErreur({ code: "ERREUR_SERVEUR", message: "Vos réglages n'ont pas pu être chargés. Réessayez dans un instant." });
    }
    if (plats.error) {
      return repondreErreur({ code: "ERREUR_SERVEUR", message: "Vos plats n'ont pas pu être chargés. Réessayez dans un instant." });
    }
    const maintenant = new Date();
    const aReconfirmer = (plats.data ?? [])
      .map((plat) => ({
        id: plat.id as string,
        nom: plat.nom as string,
        etat: etatDisponibilite(
          { disponible: Boolean(plat.disponible), confirmeLe: (plat.disponibilite_confirmee_le as string | null) ?? null },
          parametres.disponibiliteFraicheurHeures,
          maintenant,
        ),
      }))
      .filter((entree) => entree.etat.type === "a_confirmer")
      .map((entree) => ({
        id: entree.id,
        nom: entree.nom,
        confirmeLe: entree.etat.type === "a_confirmer" ? (entree.etat.confirmeLe?.toISOString() ?? null) : null,
      }));
    return repondre({
      ok: true,
      horaires: (restaurant.data.horaires as string | null) ?? "",
      ouvert: Boolean(restaurant.data.ouvert),
      accepteCommandes: Boolean(restaurant.data.accepte_commandes),
      platsAReconfirmer: aReconfirmer,
    });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Vos réglages n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

/** Enregistre les horaires déclarés par le restaurateur (texte libre, comme sur la console du site). */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { horaires?: unknown };
  if (typeof corps.horaires !== "string") {
    return repondreErreur({ code: "VALIDATION", message: "Horaires invalides." });
  }
  if (corps.horaires.length > 500) {
    return repondreErreur({ code: "VALIDATION", message: "Les horaires ne peuvent pas dépasser 500 caractères." });
  }
  const { supabase, restaurantId } = auth.contexte;
  const { data, error } = await supabase.from("restaurants").update({ horaires: corps.horaires }).eq("id", restaurantId).select("id");
  if (error || !data || data.length === 0) {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer vos horaires. Réessayez dans un instant." });
  }
  return repondre({ ok: true });
}

export const dynamic = "force-dynamic";
