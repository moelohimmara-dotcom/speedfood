import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Lectures de l'écran d'administration des paiements (clé de service). Les numéros de compte ne sortent JAMAIS d'ici en clair : on lit
 * la version masquée des versements et seulement l'état (absent, non vérifié, vérifié) des comptes. Chaque lecture est bornée.
 */

export interface VersementAdmin {
  id: string;
  beneficiaire: "restaurant" | "livreur";
  etat: "a_verser" | "envoye" | "confirme" | "echoue";
  montantGnf: number;
  numeroMasque: string;
  tentatives: number;
  erreurCode: string | null;
}

export interface LitigeAdmin {
  id: string;
  situation: string;
  etat: "ouvert" | "decide_auto" | "a_humain" | "clos";
  regle: string | null;
  decision: string | null;
}

export interface PaiementAdmin {
  id: string;
  commandeReference: string;
  restaurantNom: string;
  etat: string;
  operateur: string;
  fournisseur: string;
  totalGnf: number;
  restaurantGnf: number;
  livreurGnf: number;
  speedfoodBrutGnf: number;
  fraisMobileGnf: number;
  rembourseGnf: number;
  creeLe: string;
  versements: VersementAdmin[];
  litiges: LitigeAdmin[];
}

export interface ReglagesAdmin {
  actif: boolean;
  fournisseur: "simulation" | "chapchap";
  fraisMobilePermilleOrange: number;
  fraisMobilePermilleMtn: number;
  fraisSpeedfoodCommandeGnf: number;
  fraisVersementGnf: number;
  fraisMobileFixeGnf: number;
  delaiExpirationMinutes: number;
  plafondPaiementGnf: number;
  plafondRemboursementAutoPermille: number;
  seuilLitigeHumainGnf: number;
  valeursValideesLe: string | null;
  cleSimulationConfiguree: boolean;
}

export interface CompteAdmin {
  proprietaireType: "restaurant" | "livreur";
  proprietaireId: string;
  nom: string;
  etat: "absent" | "non_verifie" | "verifie";
  operateur: string | null;
}

type Ligne = Record<string, unknown>;
const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function client(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

export async function lireReglagesAdmin(): Promise<ReglagesAdmin> {
  const { data } = await client().from("parametres_paiement").select("*").maybeSingle();
  const r = (data ?? {}) as Ligne;
  return {
    actif: r.paiement_en_ligne_actif === true,
    fournisseur: r.fournisseur === "chapchap" ? "chapchap" : "simulation",
    fraisMobilePermilleOrange: Number(r.frais_mobile_permille_orange ?? 15),
    fraisMobilePermilleMtn: Number(r.frais_mobile_permille_mtn ?? 17),
    fraisSpeedfoodCommandeGnf: Number(r.frais_speedfood_commande_gnf ?? 1000),
    fraisVersementGnf: Number(r.frais_versement_gnf ?? 0),
    fraisMobileFixeGnf: Number(r.frais_mobile_fixe_gnf ?? 0),
    delaiExpirationMinutes: Number(r.delai_expiration_minutes ?? 15),
    plafondPaiementGnf: Number(r.plafond_paiement_gnf ?? 500000),
    plafondRemboursementAutoPermille: Number(r.plafond_remboursement_auto_permille ?? 300),
    seuilLitigeHumainGnf: Number(r.seuil_litige_humain_gnf ?? 50000),
    valeursValideesLe: typeof r.valeurs_validees_le === "string" ? r.valeurs_validees_le : null,
    cleSimulationConfiguree: (process.env.PAIEMENT_SIMULATION_CLE ?? "").length >= 16,
  };
}

export async function listerPaiementsAdmin(): Promise<PaiementAdmin[]> {
  const db = client();
  const { data } = await db
    .from("paiements")
    .select(
      "id, etat, operateur, fournisseur, total_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, frais_mobile_gnf, rembourse_gnf, cree_le, orders(reference), restaurants(nom)"
    )
    .order("cree_le", { ascending: false })
    .limit(60);
  const lignes = (data ?? []) as Ligne[];
  if (lignes.length === 0) return [];
  const ids = lignes.map((l) => String(l.id));
  const [{ data: versements }, { data: litiges }] = await Promise.all([
    db.from("paiement_versements").select("id, paiement_id, beneficiaire_type, etat, montant_gnf, numero_masque, tentatives, erreur_code").in("paiement_id", ids).limit(200),
    db.from("litiges_paiement").select("id, paiement_id, situation, etat, regle, decision").in("paiement_id", ids).limit(200),
  ]);
  return lignes.map((l) => {
    const id = String(l.id);
    return {
      id,
      commandeReference: String(un(l.orders as Ligne | Ligne[] | null)?.reference ?? "—"),
      restaurantNom: String(un(l.restaurants as Ligne | Ligne[] | null)?.nom ?? "—"),
      etat: String(l.etat),
      operateur: String(l.operateur),
      fournisseur: String(l.fournisseur),
      totalGnf: Number(l.total_gnf),
      restaurantGnf: Number(l.restaurant_gnf),
      livreurGnf: Number(l.livreur_gnf),
      speedfoodBrutGnf: Number(l.speedfood_brut_gnf),
      fraisMobileGnf: Number(l.frais_mobile_gnf),
      rembourseGnf: Number(l.rembourse_gnf),
      creeLe: String(l.cree_le),
      versements: ((versements ?? []) as Ligne[])
        .filter((v) => v.paiement_id === id)
        .map((v) => ({
          id: String(v.id),
          beneficiaire: v.beneficiaire_type === "livreur" ? ("livreur" as const) : ("restaurant" as const),
          etat: v.etat as VersementAdmin["etat"],
          montantGnf: Number(v.montant_gnf),
          numeroMasque: String(v.numero_masque),
          tentatives: Number(v.tentatives),
          erreurCode: typeof v.erreur_code === "string" ? v.erreur_code : null,
        })),
      litiges: ((litiges ?? []) as Ligne[])
        .filter((x) => x.paiement_id === id)
        .map((x) => ({
          id: String(x.id),
          situation: String(x.situation),
          etat: x.etat as LitigeAdmin["etat"],
          regle: typeof x.regle === "string" ? x.regle : null,
          decision: typeof x.decision === "string" ? x.decision : null,
        })),
    };
  });
}

/** Comptes de versement des restaurants publiés et des livreurs réels : seulement l'état, jamais le numéro. */
export async function listerComptesAdmin(): Promise<CompteAdmin[]> {
  const db = client();
  const [{ data: restaurants }, { data: livreurs }, { data: comptes }] = await Promise.all([
    db.from("restaurants").select("id, nom").eq("publie", true).order("nom").limit(200),
    db.from("livreurs").select("id, nom").eq("simule", false).order("nom").limit(200),
    db.from("comptes_versement").select("restaurant_id, livreur_id, operateur, verifie_le").eq("actif", true).limit(500),
  ]);
  const parRestaurant = new Map<string, Ligne>();
  const parLivreur = new Map<string, Ligne>();
  for (const c of (comptes ?? []) as Ligne[]) {
    if (typeof c.restaurant_id === "string") parRestaurant.set(c.restaurant_id, c);
    if (typeof c.livreur_id === "string") parLivreur.set(c.livreur_id, c);
  }
  const etat = (c: Ligne | undefined): CompteAdmin["etat"] => (!c ? "absent" : c.verifie_le ? "verifie" : "non_verifie");
  return [
    ...((restaurants ?? []) as Ligne[]).map((r) => ({ proprietaireType: "restaurant" as const, proprietaireId: String(r.id), nom: String(r.nom), etat: etat(parRestaurant.get(String(r.id))), operateur: (parRestaurant.get(String(r.id))?.operateur as string | undefined) ?? null })),
    ...((livreurs ?? []) as Ligne[]).map((l) => ({ proprietaireType: "livreur" as const, proprietaireId: String(l.id), nom: String(l.nom), etat: etat(parLivreur.get(String(l.id))), operateur: (parLivreur.get(String(l.id))?.operateur as string | undefined) ?? null })),
  ];
}
