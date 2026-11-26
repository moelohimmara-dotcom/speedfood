import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireTout } from "@/lib/db/lecture-complete";
import { agregerPaiementsLiberes, type LigneReleve } from "./finances-regles";

export interface ContratCommission { etablissementId: string; etablissementNom: string; taux: number; effectifLe: string; }
export interface VersementReleve { etablissementId: string; statut: "a_verser" | "verse" | "partiel"; dateVersement: string | null; reference: string | null; operateur: string | null; }
export interface ParametresFinancesReels { tauxDefaut: number; rythme: string; devise: "GNF"; fraisFixeGnf: number; reductionExcellentPermille: number; actif: boolean; fournisseur: string; }

export type LigneFinances = LigneReleve & { versement: VersementReleve; paiements: number };

type LignePaiement = {
  id: string; restaurant_id: string; repas_gnf: number; frais_livraison_gnf: number; livraison_par: string;
  speedfood_brut_gnf: number; restaurant_gnf: number; rembourse_gnf: number; libere_le: string | null;
  restaurants: { nom: string } | { nom: string }[] | null;
};
type LigneVersement = { id: string; paiement_id: string; etat: string; operateur: string | null; reference_externe: string | null; cree_le: string | null };

const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/**
 * Relevé financier RÉEL : les paiements en ligne libérés de la période, regroupés par restaurant.
 * Les montants sont ceux stockés à l'ouverture du paiement (commission déjà calculée, réduction du palier excellent comprise) :
 * on ne recalcule jamais un taux après coup. Aucune donnée de démonstration, aucun état en mémoire.
 */
export async function lireFinances(debut?: Date, fin?: Date): Promise<{ lignes: LigneFinances[]; contrats: ContratCommission[]; parametres: ParametresFinancesReels; debut: Date; fin: Date }> {
  // Période par défaut calculée à chaque appel (14 derniers jours), jamais figée au chargement du module.
  const maintenant = new Date();
  const debutReel = debut ?? (() => { const d = new Date(maintenant); d.setDate(d.getDate() - 14); d.setHours(0, 0, 0, 0); return d; })();
  const finReelle = fin ?? (() => { const d = new Date(maintenant); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d; })();
  if (!(debutReel instanceof Date) || Number.isNaN(debutReel.getTime()) || !(finReelle instanceof Date) || Number.isNaN(finReelle.getTime()) || debutReel >= finReelle) throw new Error("La période doit avoir une date de début antérieure à la date de fin.");
  const db = creerClientAdmin() as unknown as SupabaseClient;

  // Période sur la LIBÉRATION (libere_le), pas sur la création : un paiement créé en septembre et libéré en octobre appartient au relevé d'octobre.
  const { data: lignesBrutes, error, tronque } = await lireTout((de, a) =>
    db.from("paiements")
      .select("id, restaurant_id, repas_gnf, frais_livraison_gnf, livraison_par, speedfood_brut_gnf, restaurant_gnf, rembourse_gnf, libere_le, restaurants(nom)")
      .eq("etat", "libere")
      .gte("libere_le", debutReel.toISOString())
      .lt("libere_le", finReelle.toISOString())
      .order("id")
      .range(de, a) as unknown as PromiseLike<{ data: LignePaiement[] | null; error: unknown }>
  );
  if (error || tronque || !lignesBrutes) throw new Error("finances_illisibles");
  const paiements = lignesBrutes as LignePaiement[];

  const ids = paiements.map((p) => p.id);
  const versementsParPaiement = new Map<string, LigneVersement[]>();
  if (ids.length > 0) {
    const { data: versements, error: erreurVersements, tronque: versementsTronques } = await lireTout((de, a) =>
      db.from("paiement_versements").select("id, paiement_id, etat, operateur, reference_externe, cree_le").eq("beneficiaire_type", "restaurant").in("paiement_id", ids).order("id").range(de, a) as unknown as PromiseLike<{ data: LigneVersement[] | null; error: unknown }>
    );
    if (erreurVersements || versementsTronques || !versements) throw new Error("finances_illisibles");
    for (const v of versements as LigneVersement[]) {
      const liste = versementsParPaiement.get(v.paiement_id) ?? [];
      liste.push(v);
      versementsParPaiement.set(v.paiement_id, liste);
    }
  }

  const agregees = agregerPaiementsLiberes(
    paiements.map((p) => ({ id: p.id, etablissementId: p.restaurant_id, etablissementNom: un(p.restaurants)?.nom ?? "Restaurant inconnu", repasGnf: p.repas_gnf, fraisLivraisonGnf: p.frais_livraison_gnf, livraisonPar: p.livraison_par, commissionGnf: p.speedfood_brut_gnf, netRestaurantGnf: p.restaurant_gnf, remboursementGnf: p.rembourse_gnf, libereLe: p.libere_le })),
    new Map([...versementsParPaiement.entries()].map(([paiementId, liste]) => [paiementId, liste.map((v) => ({ paiementId, etat: v.etat, operateur: v.operateur }))]))
  );
  const lignes: LigneFinances[] = agregees.map((l) => {
    const { statutVersement, operateurVersement, dernierPaiementLe: _dernier, ...reste } = l;
    const confirme = paiements.filter((p) => p.restaurant_id === l.etablissementId).flatMap((p) => versementsParPaiement.get(p.id) ?? []).find((v) => v.etat === "confirme");
    return { ...reste, versement: { etablissementId: l.etablissementId, statut: statutVersement, dateVersement: confirme?.cree_le ?? null, reference: confirme?.reference_externe ?? null, operateur: operateurVersement } };
  });

  const { data: reglagesBruts, error: erreurReglages } = await db.from("parametres_paiement").select("frais_speedfood_commande_gnf, commission_speedfood_permille, commission_reduction_excellent_permille, paiement_en_ligne_actif, fournisseur").maybeSingle();
  if (erreurReglages) throw new Error("finances_illisibles");
  const reglages = (reglagesBruts ?? {}) as Record<string, unknown>;
  const parametres: ParametresFinancesReels = {
    tauxDefaut: Number(reglages.commission_speedfood_permille ?? 0) / 1000,
    rythme: "versements réels (écran Paiements)",
    devise: "GNF",
    // Mêmes replis que le dépôt du paiement (depot-supabase) : jamais une commission « en vigueur » inventée à 0.
    fraisFixeGnf: Number(reglages.frais_speedfood_commande_gnf ?? 1000),
    reductionExcellentPermille: Number(reglages.commission_reduction_excellent_permille ?? 500),
    actif: reglages.paiement_en_ligne_actif === true,
    fournisseur: reglages.fournisseur === "chapchap" ? "chapchap" : "simulation",
  };

  const contrats: ContratCommission[] = lignes.map((l, i) => ({ etablissementId: l.etablissementId, etablissementNom: l.etablissementNom, taux: l.tauxCommission, effectifLe: agregees[i].dernierPaiementLe ?? debutReel.toISOString() }));
  return { lignes, contrats, parametres, debut: debutReel, fin: finReelle };
}
