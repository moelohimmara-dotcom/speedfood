import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/** Commandes terminées, refusées ou annulées : ce qui est fini et n'attend plus rien. */
const STATUTS_FINAUX = ["terminee", "refusee", "annulee"];

/** Plafond de sécurité : au-delà, l'application ne demande jamais une page de cette taille. */
const TAILLE_MAX = 100;

/**
 * L'historique des commandes du restaurant, page par page (la plus récente d'abord).
 *
 * La page demandée est portée par le corps de la requête : la fenêtre demandée ne dépend d'aucun état de session, et le serveur répond toujours
 * par la page exactement demandée. Les commandes d'essai sont exclues : elles ne comptent pas dans les chiffres réels du restaurant.
 */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { page?: unknown; taille?: unknown };
  const page = typeof corps.page === "number" && Number.isInteger(corps.page) && corps.page >= 1 ? corps.page : 1;
  const tailleDemandee = typeof corps.taille === "number" && Number.isInteger(corps.taille) ? corps.taille : 20;
  const taille = Math.max(1, Math.min(tailleDemandee, TAILLE_MAX));
  const debut = (page - 1) * taille;

  const { supabase, restaurantId } = auth.contexte;
  const [lignes, compte] = await Promise.all([
    supabase
      .from("orders")
      .select("id, reference, mode, sous_total, frais_livraison_estime, statut, cree_le, order_items(nom)")
      .eq("restaurant_id", restaurantId)
      .eq("est_test", false)
      .in("statut", STATUTS_FINAUX)
      .order("cree_le", { ascending: false })
      .range(debut, debut + taille - 1),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("est_test", false)
      .in("statut", STATUTS_FINAUX),
  ]);
  if (lignes.error || compte.error) {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "L'historique n'a pas pu être chargé. Réessayez dans un instant." });
  }

  const commandes = (lignes.data ?? []).map((ligne) => ({
    id: ligne.id as string,
    reference: ligne.reference as string,
    statut: ligne.statut as string,
    mode: (ligne.mode as string) ?? "retrait",
    sousTotal: (ligne.sous_total as number) ?? 0,
    fraisLivraisonEstime: (ligne.frais_livraison_estime as number) ?? 0,
    creeLe: ligne.cree_le as string,
    nbLignes: ((ligne.order_items as unknown[] | null) ?? []).length,
  }));
  const total = compte.count ?? 0;
  const pageSuivante = debut + commandes.length < total ? page + 1 : null;
  return repondre({ ok: true, commandes, page, total, pageSuivante });
}

export const dynamic = "force-dynamic";
