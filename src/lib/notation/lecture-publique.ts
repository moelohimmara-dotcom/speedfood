import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import { ETIQUETTES, moyenneAffichee } from "./regles";

/** Ce que la fiche publique d'un restaurant montre de ses avis. Jamais d'identifiant de compte ni de numéro de commande. */
export interface AvisPublic {
  id: string;
  note: number;
  etiquettes: string[];
  commentaire: string | null;
  prenom: string;
  date: string;
  reponse: string | null;
}

export interface AvisPublicsRestaurant {
  moyenne: number | null;
  total: number;
  avis: AvisPublic[];
}

const LIBELLE_ETIQUETTE = new Map(ETIQUETTES.restaurant.map((e) => [e.cle, e.libelle]));

export function libelleEtiquette(cle: string): string {
  return LIBELLE_ETIQUETTE.get(cle) ?? cle;
}

/** Lecture tolérante : sans migration ou en cas de panne, la fiche s'affiche sans avis. */
export async function lireAvisPublics(restaurantId: string, limite = 10): Promise<AvisPublicsRestaurant> {
  const vide: AvisPublicsRestaurant = { moyenne: null, total: 0, avis: [] };
  try {
    const db = clientLivraison();
    const [{ data: resto }, { data: lignes }] = await Promise.all([
      db.from("restaurants").select("avis_somme, avis_total").eq("id", restaurantId).maybeSingle(),
      db
        .from("avis")
        .select("id, note, etiquettes, commentaire, statut, prenom_affiche, cree_le, reponse_texte")
        .eq("restaurant_id", restaurantId)
        .eq("cible", "restaurant")
        .eq("est_test", false)
        .in("statut", ["publie", "commentaire_masque"])
        .order("cree_le", { ascending: false })
        .limit(limite),
    ]);
    const r = resto as { avis_somme: number; avis_total: number } | null;
    if (!r) return vide;
    return {
      moyenne: moyenneAffichee(r.avis_somme ?? 0, r.avis_total ?? 0),
      total: r.avis_total ?? 0,
      avis: ((lignes ?? []) as { id: string; note: number; etiquettes: string[]; commentaire: string | null; statut: string; prenom_affiche: string | null; cree_le: string; reponse_texte: string | null }[]).map((l) => ({
        id: l.id,
        note: l.note,
        etiquettes: l.etiquettes ?? [],
        // Un commentaire masqué par l'exploitation garde sa note mais n'est plus affiché.
        commentaire: l.statut === "commentaire_masque" ? null : l.commentaire,
        prenom: l.prenom_affiche ?? "Client",
        date: l.cree_le,
        reponse: l.statut === "commentaire_masque" ? null : l.reponse_texte,
      })),
    };
  } catch {
    return vide;
  }
}
