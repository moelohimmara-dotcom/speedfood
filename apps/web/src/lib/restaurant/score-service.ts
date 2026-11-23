import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { calculerScore, etapeDegradation, pourcentage, type IndicateursScore } from "./score-qualite";

/**
 * Calcul mensuel des scores qualité, côté serveur seulement. Lit les commandes du mois écoulé
 * (hors commandes de test), les plats et la fiche de chaque restaurant publié, calcule les six
 * indicateurs avec les règles pures, et écrit l'instantané du mois. Relancer le calcul du même
 * mois réécrit la même ligne (clé unique restaurant et mois).
 */

type Admin = ReturnType<typeof creerClientAdmin>;
const DELAI_ACCEPTATION_MS = 11.5 * 60_000;

interface LigneCommande {
  id: string;
  restaurant_id: string;
  statut: string;
  cree_le: string;
}

interface LigneEvenement {
  order_id: string;
  statut_suivant: string;
  acteur: string;
  horodatage: string;
}

export async function calculerScoresMois(moisConcerne = new Date()): Promise<{ restaurants: number }> {
  const admin = creerClientAdmin() as unknown as Admin;
  const debut = new Date(Date.UTC(moisConcerne.getUTCFullYear(), moisConcerne.getUTCMonth() - 1, 1));
  const fin = new Date(Date.UTC(moisConcerne.getUTCFullYear(), moisConcerne.getUTCMonth(), 1));
  const moisTexte = debut.toISOString().slice(0, 10);

  const { data: restos, error: erreurRestos } = await admin
    .from("restaurants")
    .select("id, ouvert, accepte_commandes, avis_somme, avis_total")
    .eq("publie", true)
    .is("suspendu_le", null)
    .limit(1000);
  if (erreurRestos || !restos) throw new Error("scores_lecture_restaurants_impossible");

  const { data: evenementsBruts, error: erreurEvenements } = await admin
    .from("order_status_events")
    .select("order_id, statut_suivant, acteur, horodatage")
    .gte("horodatage", debut.toISOString())
    .lt("horodatage", fin.toISOString())
    .limit(50000);
  if (erreurEvenements || !evenementsBruts) throw new Error("scores_lecture_evenements_impossible");
  const evenements = evenementsBruts as unknown as LigneEvenement[];

  const { data: commandesBrutes, error: erreurCommandes } = await admin
    .from("orders")
    .select("id, restaurant_id, statut, cree_le")
    .eq("est_test", false)
    .gte("cree_le", debut.toISOString())
    .lt("cree_le", fin.toISOString())
    .limit(10000);
  if (erreurCommandes || !commandesBrutes) throw new Error("scores_lecture_commandes_impossible");
  const commandes = commandesBrutes as unknown as LigneCommande[];

  const { data: plats, error: erreurPlats } = await admin.from("menu_items").select("restaurant_id, photo_url, description").is("archive_le", null).limit(10000);
  if (erreurPlats || !plats) throw new Error("scores_lecture_plats_impossible");

  const { data: precedents } = await admin
    .from("scores_qualite_mensuels" as never)
    .select("restaurant_id, palier, mois_bas_consecutifs")
    .eq("mois", new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() - 1, 1)).toISOString().slice(0, 10));
  const moisBasAvant = new Map<string, number>();
  for (const p of (precedents ?? []) as unknown as Array<{ restaurant_id: string; palier: string; mois_bas_consecutifs: number }>) {
    if (p.palier === "mauvais") moisBasAvant.set(p.restaurant_id, p.mois_bas_consecutifs);
  }

  let ecrits = 0;
  for (const resto of restos as unknown as Array<{ id: string; ouvert: boolean; accepte_commandes: boolean; avis_somme: number; avis_total: number }>) {
    const duMois = commandes.filter((c) => c.restaurant_id === resto.id);
    const evenementsDuMois = evenements.filter((e) => duMois.some((c) => c.id === e.order_id));
    // Acceptation : première réponse (acceptee ou refusee) lue dans l'historique des transitions, datée par horodatage.
    const repondues: Array<{ cree: number; repondu: number }> = [];
    for (const c of duMois) {
      const rep = evenementsDuMois
        .filter((e) => e.order_id === c.id && (e.statut_suivant === "acceptee" || e.statut_suivant === "refusee"))
        .sort((a, b) => a.horodatage.localeCompare(b.horodatage))[0];
      if (rep) repondues.push({ cree: new Date(c.cree_le).getTime(), repondu: new Date(rep.horodatage).getTime() });
    }
    const dansDelai = repondues.filter((r) => r.repondu - r.cree <= DELAI_ACCEPTATION_MS);
    const aAcceptee = new Set(evenementsDuMois.filter((e) => e.statut_suivant === "acceptee").map((e) => e.order_id));
    const aMenee = new Set(evenementsDuMois.filter((e) => e.statut_suivant === "prete" || e.statut_suivant === "terminee").map((e) => e.order_id));
    const annuleesApresAcceptation = new Set(evenementsDuMois.filter((e) => e.statut_suivant === "annulee" && aAcceptee.has(e.order_id)).map((e) => e.order_id));
    const accepteesFinalisees = [...aAcceptee].filter((id) => !annuleesApresAcceptation.has(id));
    const menees = accepteesFinalisees.filter((id) => aMenee.has(id));
    // Exactitude : annulations dont l'acteur identifié n'est pas le client (les annulations client ne punissent pas le restaurant).
    const annuleesNonClient = new Set(
      evenementsDuMois.filter((e) => e.statut_suivant === "annulee" && e.acteur && !e.acteur.startsWith("client")).map((e) => e.order_id),
    );
    const platsDuResto = (plats as unknown as Array<{ restaurant_id: string; photo_url: string | null; description: string | null }>).filter((p) => p.restaurant_id === resto.id);
    const documentes = platsDuResto.filter((p) => (p.photo_url ?? "") !== "" && (p.description ?? "").trim() !== "");
    const aucuneActivite = duMois.length === 0 && platsDuResto.length === 0;
    const indicateurs: IndicateursScore = {
      acceptationDelai: pourcentage(dansDelai.length, repondues.length),
      preparationTenue: pourcentage(menees.length, accepteesFinalisees.length),
      exactitude: pourcentage(duMois.length - annuleesNonClient.size, duMois.length),
      // Note mensuelle impossible en base (seuls les cumuls avis_somme et avis_total existent, sans historique mensuel) : absente, jamais inventée.
      note: null,
      ficheComplete: pourcentage(documentes.length, platsDuResto.length),
      disponibilite: aucuneActivite ? null : resto.ouvert && resto.accepte_commandes ? 100 : resto.ouvert ? 50 : 0,
    };
    if (Object.values(indicateurs).every((v) => v === null)) continue;
    const resultat = calculerScore(indicateurs);
    const moisBas = resultat.palier === "mauvais" ? (moisBasAvant.get(resto.id) ?? 0) + 1 : 0;
    const { error } = await admin.from("scores_qualite_mensuels" as never).upsert(
      {
        restaurant_id: resto.id,
        mois: moisTexte,
        score: resultat.score,
        palier: resultat.palier,
        indicateurs: { ...indicateurs, etapeDegradation: etapeDegradation(moisBas), avantages: resultat.avantages },
        mois_bas_consecutifs: moisBas,
        calcule_le: new Date().toISOString(),
      } as never,
      { onConflict: "restaurant_id,mois" } as never,
    );
    if (error) throw new Error("scores_ecriture_impossible");
    ecrits += 1;
  }
  return { restaurants: ecrits };
}
