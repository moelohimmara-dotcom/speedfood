import { NextResponse } from "next/server";
import { creerClientPublic } from "@/lib/db/public";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { proposerComplements, type LigneDuPanier, type PlatSuggestion } from "@/lib/panier/complements";

/**
 * Compléments du panier. Route publique en lecture seule : elle ne renvoie que
 * des plats déjà publiés du restaurant concerné, exactement ce que la page du
 * restaurant montre — donc rien à protéger, et aucune donnée de commande.
 *
 * Le panier vit dans le navigateur ; cette route ne fait que le lire pour
 * répondre « que proposer avec ce que vous avez choisi ? ». Aucun état n'est
 * écrit, aucun prix n'est calculé ici : le serveur recalcule tout à la
 * création de la commande.
 */

export const dynamic = "force-dynamic";

/** Garde-fou : un panier déraisonnable ne doit pas faire un travail inutile. */
const LIGNES_MAX = 50;

function lireLignes(brut: string | null): LigneDuPanier[] {
  if (!brut) return [];
  try {
    const valeur: unknown = JSON.parse(brut);
    if (!Array.isArray(valeur)) return [];
    const lignes: LigneDuPanier[] = [];
    for (const entree of valeur.slice(0, LIGNES_MAX)) {
      if (typeof entree !== "object" || entree === null) continue;
      const l = entree as Partial<LigneDuPanier>;
      if (typeof l.menuItemId !== "string" || typeof l.nom !== "string") continue;
      lignes.push({ menuItemId: l.menuItemId.slice(0, 64), nom: l.nom.slice(0, 120) });
    }
    return lignes;
  } catch {
    return [];
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId") ?? "";
  if (!/^[0-9a-f-]{8,64}$/i.test(restaurantId)) {
    return NextResponse.json({ suggestions: [] });
  }

  const lignes = lireLignes(url.searchParams.get("panier"));
  if (lignes.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const supabase = creerClientPublic();
    const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
    const { data } = await supabase
      .from("menu_items")
      .select("id, nom, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url")
      .eq("restaurant_id", restaurantId)
      .is("archive_le", null)
      .limit(200);

    if (!data) {
      return NextResponse.json({ suggestions: [] });
    }

    // On ne propose que ce que le restaurant confirme comme disponible : voir le
    // composant pour la règle de fraîcheur, identique à celle du catalogue.
    const limite = new Date(Date.now() - disponibiliteFraicheurHeures * 3600_000);
    const plats: PlatSuggestion[] = [];
    for (const p of data) {
      const confirmeLe = p.disponibilite_confirmee_le
        ? new Date(p.disponibilite_confirmee_le)
        : null;
      const disponible =
        Boolean(p.disponible) && confirmeLe !== null && confirmeLe > limite;
      if (!disponible) continue;
      plats.push({
        id: p.id,
        nom: p.nom,
        prix: typeof p.prix_promo === "number" && p.prix_promo > 0 ? p.prix_promo : p.prix,
        photoUrl: p.photo_url ?? null,
      });
    }

    return NextResponse.json(
      { suggestions: proposerComplements(lignes, plats) },
      { headers: { "cache-control": "private, max-age=60" } }
    );
  } catch {
    // Une suggestion manquante ne doit jamais empêcher de commander : on
    // renvoie silencieusement une liste vide, comme le footer le fait.
    return NextResponse.json({ suggestions: [] });
  }
}