import { repondre, repondreErreur } from "@/lib/api/v1";
import { bilansJourEtSemaine, repartitionStatuts } from "@/lib/api/bilans";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/**
 * Activité du restaurant du compte : commandes et chiffre d'aujourd'hui et des 7 derniers jours, répartition par issue, dernières commandes terminées. Lecture avec
 * l'identité du membre (la RLS décide de ce qui est visible) ; les commandes de test sont exclues. Le chiffre est la somme des plats des commandes TERMINÉES (hors frais
 * de livraison, hors commandes refusées ou annulées).
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { supabase, restaurantId } = auth.contexte;
  const maintenant = Date.now();
  const depuis = new Date(maintenant - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("reference, statut, sous_total, mode, cree_le")
    .eq("restaurant_id", restaurantId)
    .eq("est_test", false)
    .gte("cree_le", depuis)
    .order("cree_le", { ascending: false })
    .limit(500);
  if (error) return repondreErreur({ code: "ERREUR_SERVEUR", message: "L'activité n'a pas pu être chargée. Réessayez dans un instant." });
  const lignes = (data ?? []) as Array<{ reference: string; statut: string; sous_total: number; mode: string; cree_le: string }>;
  const terminees = lignes.filter((l) => l.statut === "terminee");
  const bilans = bilansJourEtSemaine(
    terminees.map((l) => ({ quand: l.cree_le, montantGnf: l.sous_total })),
    maintenant
  );
  const jour = bilansJourEtSemaine(lignes.map((l) => ({ quand: l.cree_le, montantGnf: 0 })), maintenant);
  return repondre({
    ok: true,
    aujourdhui: { recues: jour.aujourdhui.nombre, terminees: bilans.aujourdhui.nombre, chiffreGnf: bilans.aujourdhui.montantGnf },
    semaine: { recues: jour.semaine.nombre, terminees: bilans.semaine.nombre, chiffreGnf: bilans.semaine.montantGnf },
    repartition: repartitionStatuts(lignes.map((l) => l.statut)),
    recentes: terminees.slice(0, 15).map((l) => ({ reference: l.reference, mode: l.mode, totalGnf: l.sous_total, creeLe: l.cree_le })),
  });
}

export const dynamic = "force-dynamic";
