import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { calculerRelevePaie, type CoursePaie, type LignePaieLivreur } from "./paie-livreurs-regles";

type Ligne = Record<string, unknown>;
const un = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Lecture bornée des courses livrées. Aucun calcul financier en base et aucun doublon de paiement. */
export async function lireRelevePaieLivreurs(debut: Date, fin: Date, livreurId?: string): Promise<{ lignes: LignePaieLivreur[]; livreurs: { id: string; nom: string }[] }> {
  const db = creerClientAdmin() as unknown as SupabaseClient;
  const { data: livreurs } = await db.from("livreurs").select("id, nom").order("nom").limit(300);
  const requete = db.from("livraisons").select("id, order_id, livreur_id, cree_le, distance_m, livreurs(id, nom)").eq("statut", "livree").gte("cree_le", debut.toISOString()).lt("cree_le", fin.toISOString()).not("livreur_id", "is", null).order("cree_le", { ascending: false }).limit(500);
  const { data } = livreurId ? await requete.eq("livreur_id", livreurId) : await requete;
  const coursesBrutes = (data ?? []) as unknown as Ligne[];
  const orderIds = coursesBrutes.map((l) => String(l.order_id)).filter(Boolean);
  const paiements = orderIds.length === 0 ? [] : ((await db.from("paiements").select("id, order_id").in("order_id", orderIds).limit(500)).data ?? []) as Ligne[];
  const paiementIds = paiements.map((p) => String(p.id));
  const versements = paiementIds.length === 0 ? [] : ((await db.from("paiement_versements").select("id, paiement_id, beneficiaire_type, etat").eq("beneficiaire_type", "livreur").in("paiement_id", paiementIds).limit(500)).data ?? []) as Ligne[];
  const paiementParCommande = new Map(paiements.map((p) => [String(p.order_id), String(p.id)]));
  const versementParPaiement = new Map(versements.map((v) => [String(v.paiement_id), v]));
  const courses: CoursePaie[] = [];
  for (const ligne of coursesBrutes) {
    const livreur = un(ligne.livreurs as Ligne | Ligne[] | null);
    const versement = versementParPaiement.get(paiementParCommande.get(String(ligne.order_id)) ?? "");
    courses.push({ id: String(ligne.id), livreurId: String(ligne.livreur_id), livreurNom: String(livreur?.nom ?? "Livreur inconnu"), creeLe: String(ligne.cree_le), distanceKm: ligne.distance_m === null || ligne.distance_m === undefined ? null : Number(ligne.distance_m) / 1000, statut: "livree", versementId: versement ? String(versement.id) : null, versementEtat: versement ? (versement.etat as CoursePaie["versementEtat"]) : null });
  }
  return { lignes: calculerRelevePaie(courses, debut, fin, livreurId), livreurs: ((livreurs ?? []) as Ligne[]).map((l) => ({ id: String(l.id), nom: String(l.nom) })) };
}
