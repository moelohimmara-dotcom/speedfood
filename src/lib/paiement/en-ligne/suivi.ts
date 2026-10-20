import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaiementEnLigneSuivi } from "@/lib/contracts/commande";
import { estEtatPaiement, estOperateur } from "./types";

/**
 * Ce que le client voit du paiement en ligne de sa commande (page de suivi). Deux lectures légères, et seulement quand le paiement est
 * ouvert : réglages (interrupteur, fournisseur) et ligne de paiement. Aucun montant interne (frais, répartition) n'en sort.
 */
export async function lirePaiementEnLigneSuivi(db: SupabaseClient, orderId: string, paiementOuvert: boolean): Promise<PaiementEnLigneSuivi> {
  const inactif: PaiementEnLigneSuivi = { disponible: false, simulation: false, etat: null, operateur: null, totalGnf: null };
  if (!paiementOuvert) return inactif;
  const [{ data: reglages }, { data: p }] = await Promise.all([
    db.from("parametres_paiement").select("paiement_en_ligne_actif, fournisseur").maybeSingle(),
    db.from("paiements").select("etat, operateur, total_gnf").eq("order_id", orderId).maybeSingle(),
  ]);
  const actif = reglages?.paiement_en_ligne_actif === true;
  const etat = p && estEtatPaiement(p.etat) ? p.etat : null;
  // Un paiement déjà ouvert reste affiché même si l'interrupteur s'éteint entre-temps (le client doit voir où il en est).
  if (!actif && !etat) return inactif;
  return {
    disponible: actif,
    simulation: reglages?.fournisseur !== "chapchap",
    etat,
    operateur: p && estOperateur(p.operateur) ? p.operateur : null,
    totalGnf: p ? Number(p.total_gnf) : null,
  };
}
