import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";
import { lireDelaiPreparation } from "@/lib/commande/estimation";
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
      supabase.from("restaurants").select("horaires, ouvert, accepte_commandes, delai_preparation_minutes").eq("id", restaurantId).maybeSingle(),
      supabase
        .from("menu_items")
        .select("id, nom, disponible, disponibilite_confirmee_le")
        .eq("restaurant_id", restaurantId)
        .is("archive_le", null)
        .eq("disponible", true)
        .limit(500),
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
      delaiPreparationMinutes: (restaurant.data.delai_preparation_minutes as number | null) ?? null,
      platsAReconfirmer: aReconfirmer,
    });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Vos réglages n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

/**
 * Enregistre les réglages déclarés par le restaurateur : les horaires (texte libre, comme sur la console du site) et/ou le délai habituel de préparation (minutes, 5 à 240,
 * ou vide pour ne rien annoncer au client). Chaque champ est facultatif ; au moins un est attendu. Les anciennes versions de l'application n'envoient que les horaires.
 */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { horaires?: unknown; delaiPreparationMinutes?: unknown };
  const maj: { horaires?: string; delai_preparation_minutes?: number | null } = {};
  if (corps.horaires !== undefined) {
    if (typeof corps.horaires !== "string") return repondreErreur({ code: "VALIDATION", message: "Horaires invalides." });
    if (corps.horaires.length > 500) return repondreErreur({ code: "VALIDATION", message: "Les horaires ne peuvent pas dépasser 500 caractères." });
    maj.horaires = corps.horaires;
  }
  if ("delaiPreparationMinutes" in corps) {
    const delai = lireDelaiPreparation(corps.delaiPreparationMinutes);
    if (!delai.ok) return repondreErreur({ code: "VALIDATION", message: delai.message });
    maj.delai_preparation_minutes = delai.valeur;
  }
  if (Object.keys(maj).length === 0) return repondreErreur({ code: "VALIDATION", message: "Horaires invalides." });
  const { supabase, restaurantId } = auth.contexte;
  const { data, error } = await supabase.from("restaurants").update(maj).eq("id", restaurantId).select("id");
  if (error || !data || data.length === 0) {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer vos réglages. Réessayez dans un instant." });
  }
  return repondre({ ok: true });
}

export const dynamic = "force-dynamic";
