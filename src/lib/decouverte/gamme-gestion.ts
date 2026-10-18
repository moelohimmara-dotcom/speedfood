import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import { GAMMES, estGamme, type Gamme } from "./aide-choix";

/**
 * Demandes de changement de gamme (restaurateur) et décisions (exploitation). Chaque fonction reçoit une identité DÉJÀ vérifiée par
 * l'appelant (appartenance au restaurant, permission) et revérifie ici le lien avec la demande ou le restaurant.
 */

export type Resultat = { ok: true } | { ok: false; erreur: string };

export interface DemandeGamme {
  id: string;
  restaurantId: string;
  restaurantNom: string;
  gammeDemandee: Gamme;
  motif: string;
  statut: "en_attente" | "acceptee" | "refusee";
  motifDecision: string | null;
  creeLe: string;
  decideLe: string | null;
}

const MOTIF_MIN = 10;
const MOTIF_MAX = 300;

function nettoyer(texte: unknown): string {
  return typeof texte === "string" ? texte.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim() : "";
}

export async function demanderGamme(args: { restaurantId: string; utilisateurId: string; gamme: unknown; motif: unknown; gammeActuelle: Gamme | null }): Promise<Resultat> {
  if (!estGamme(args.gamme)) return { ok: false, erreur: "Choisissez une gamme parmi " + GAMMES.length + " propositions." };
  const motif = nettoyer(args.motif);
  if (motif.length < MOTIF_MIN) return { ok: false, erreur: `Expliquez votre demande en ${MOTIF_MIN} caractères au moins (cadre, service, qualité des produits…).` };
  if (motif.length > MOTIF_MAX) return { ok: false, erreur: `Explication trop longue (${MOTIF_MAX} caractères au plus).` };
  if (args.gammeActuelle === args.gamme) return { ok: false, erreur: "C'est déjà la gamme affichée pour votre restaurant." };
  const { error } = await clientLivraison().from("gamme_demandes").insert({
    restaurant_id: args.restaurantId,
    gamme_demandee: args.gamme,
    motif,
    demande_par: args.utilisateurId,
  });
  if (error) return { ok: false, erreur: error.code === "23505" ? "Une demande est déjà en attente pour votre restaurant." : "Envoi impossible, réessayez." };
  return { ok: true };
}

type Brute = {
  id: string;
  restaurant_id: string;
  gamme_demandee: string;
  motif: string;
  statut: string;
  motif_decision: string | null;
  cree_le: string;
  decide_le: string | null;
  restaurants: { nom: string } | { nom: string }[] | null;
};

function versDemande(b: Brute): DemandeGamme | null {
  if (!estGamme(b.gamme_demandee) || !["en_attente", "acceptee", "refusee"].includes(b.statut)) return null;
  const r = Array.isArray(b.restaurants) ? b.restaurants[0] : b.restaurants;
  return {
    id: b.id,
    restaurantId: b.restaurant_id,
    restaurantNom: r?.nom ?? "—",
    gammeDemandee: b.gamme_demandee,
    motif: b.motif,
    statut: b.statut as DemandeGamme["statut"],
    motifDecision: b.motif_decision,
    creeLe: b.cree_le,
    decideLe: b.decide_le,
  };
}

const COLONNES = "id, restaurant_id, gamme_demandee, motif, statut, motif_decision, cree_le, decide_le, restaurants(nom)";

export async function demandesDuRestaurant(restaurantId: string): Promise<DemandeGamme[]> {
  const { data } = await clientLivraison().from("gamme_demandes").select(COLONNES).eq("restaurant_id", restaurantId).order("cree_le", { ascending: false }).limit(10);
  return ((data ?? []) as unknown as Brute[]).map(versDemande).filter((d): d is DemandeGamme => d !== null);
}

export async function demandesEnAttente(): Promise<DemandeGamme[]> {
  const { data } = await clientLivraison().from("gamme_demandes").select(COLONNES).eq("statut", "en_attente").order("cree_le", { ascending: true }).limit(100);
  return ((data ?? []) as unknown as Brute[]).map(versDemande).filter((d): d is DemandeGamme => d !== null);
}

/** Accepte (la gamme demandée devient la gamme validée) ou refuse (motif obligatoire) une demande en attente. */
export async function deciderDemande(args: { demandeId: string; accepter: boolean; motif: string; adminId: string }): Promise<Resultat & { restaurantId?: string; gamme?: Gamme }> {
  const motif = nettoyer(args.motif).slice(0, MOTIF_MAX);
  if (!args.accepter && motif.length < 5) return { ok: false, erreur: "Indiquez le motif du refus (5 caractères au moins)." };
  const db = clientLivraison();
  const { data } = await db.from("gamme_demandes").select("id, restaurant_id, gamme_demandee, statut").eq("id", args.demandeId).maybeSingle();
  const d = data as { restaurant_id: string; gamme_demandee: string; statut: string } | null;
  if (!d || d.statut !== "en_attente" || !estGamme(d.gamme_demandee)) return { ok: false, erreur: "Cette demande n'est plus en attente." };

  const { data: maj, error } = await db
    .from("gamme_demandes")
    .update({ statut: args.accepter ? "acceptee" : "refusee", motif_decision: motif || null, decide_par: args.adminId, decide_le: new Date().toISOString() })
    .eq("id", args.demandeId)
    .eq("statut", "en_attente")
    .select("id");
  if (error || !maj || maj.length === 0) return { ok: false, erreur: "Décision impossible, réessayez." };

  if (args.accepter) {
    const { error: erreurResto } = await db.from("restaurants").update({ gamme_validee: d.gamme_demandee }).eq("id", d.restaurant_id);
    if (erreurResto) return { ok: false, erreur: "La demande est marquée acceptée mais la gamme n'a pas pu être appliquée : réessayez." };
  }
  return { ok: true, restaurantId: d.restaurant_id, gamme: d.gamme_demandee };
}

/** Retour au calcul automatique. */
export async function retirerGammeValidee(restaurantId: string): Promise<Resultat> {
  const { error } = await clientLivraison().from("restaurants").update({ gamme_validee: null }).eq("id", restaurantId);
  return error ? { ok: false, erreur: "Impossible de retirer la validation, réessayez." } : { ok: true };
}
