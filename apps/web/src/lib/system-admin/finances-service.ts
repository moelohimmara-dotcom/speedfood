import "server-only";
import { calculerReleve, TAUX_COMMISSION_DEFAUT, RYTHME_VERSEMENT_DEFAUT, type LigneReleve, type VenteFinance } from "./finances-regles";

export interface ContratCommission { etablissementId: string; etablissementNom: string; taux: number; effectifLe: string; }
export interface VersementReleve { etablissementId: string; statut: "a_verser" | "verse"; dateVersement: string | null; reference: string | null; operateur: string | null; }

const maintenant = new Date();
const debutDefaut = new Date(maintenant); debutDefaut.setDate(debutDefaut.getDate() - 14); debutDefaut.setHours(0, 0, 0, 0);
const finDefaut = new Date(maintenant); finDefaut.setDate(finDefaut.getDate() + 1); finDefaut.setHours(0, 0, 0, 0);
const ventes: VenteFinance[] = [
  { id: "v-1", etablissementId: "r-speedfood-1", etablissementNom: "Chez Awa, l'essai", reference: "SF-4101", creeLe: new Date(maintenant.getTime() - 2 * 86400000).toISOString(), montantPlatsGnf: 30000, fraisLivraisonGnf: 5000, remboursementGnf: 0 },
  { id: "v-2", etablissementId: "r-speedfood-1", etablissementNom: "Chez Awa, l'essai", reference: "SF-4102", creeLe: new Date(maintenant.getTime() - 8 * 86400000).toISOString(), montantPlatsGnf: 25000, fraisLivraisonGnf: 0, remboursementGnf: 5000 },
  { id: "v-3", etablissementId: "r-speedfood-2", etablissementNom: "Maquis du Port", reference: "SF-4103", creeLe: new Date(maintenant.getTime() - 4 * 86400000).toISOString(), montantPlatsGnf: 40000, fraisLivraisonGnf: 6000, remboursementGnf: 10000 },
  { id: "v-4", etablissementId: "r-speedfood-3", etablissementNom: "Gastronomie 24", reference: "SF-4104", creeLe: new Date(maintenant.getTime() - 20 * 86400000).toISOString(), montantPlatsGnf: 20000, fraisLivraisonGnf: 0, remboursementGnf: 0 },
];
const contrats: ContratCommission[] = [
  { etablissementId: "r-speedfood-1", etablissementNom: "Chez Awa, l'essai", taux: TAUX_COMMISSION_DEFAUT, effectifLe: new Date(maintenant.getTime() - 30 * 86400000).toISOString() },
  { etablissementId: "r-speedfood-2", etablissementNom: "Maquis du Port", taux: 0.12, effectifLe: new Date(maintenant.getTime() - 10 * 86400000).toISOString() },
  { etablissementId: "r-speedfood-3", etablissementNom: "Gastronomie 24", taux: TAUX_COMMISSION_DEFAUT, effectifLe: new Date(maintenant.getTime() - 30 * 86400000).toISOString() },
];
const versements = new Map<string, VersementReleve>();
export const parametresFinances = { rythme: RYTHME_VERSEMENT_DEFAUT, tauxDefaut: TAUX_COMMISSION_DEFAUT, devise: "GNF" } as const;

export function lireFinances(debut = debutDefaut, fin = finDefaut): { lignes: (LigneReleve & { versement: VersementReleve })[]; contrats: ContratCommission[]; parametres: typeof parametresFinances; debut: Date; fin: Date } {
  const taux = Object.fromEntries(contrats.map((c) => [c.etablissementId, c.taux]));
  const lignes = calculerReleve(ventes, debut, fin, taux).map((ligne) => ({ ...ligne, versement: versements.get(ligne.etablissementId) ?? { etablissementId: ligne.etablissementId, statut: "a_verser" as const, dateVersement: null, reference: null, operateur: null } }));
  return { lignes, contrats, parametres: parametresFinances, debut, fin };
}

export function modifierContrat(etablissementId: string, taux: number): ContratCommission {
  if (!contrats.some((c) => c.etablissementId === etablissementId)) throw new Error("Établissement introuvable.");
  if (!Number.isFinite(taux) || taux < 0 || taux > 1) throw new Error("Le taux doit être compris entre 0 % et 100 %.");
  const actuel = contrats.find((c) => c.etablissementId === etablissementId)!;
  actuel.taux = taux; actuel.effectifLe = new Date().toISOString();
  return actuel;
}

export function marquerVersement(etablissementId: string, reference: string, operateur = "opérateur de démonstration"): VersementReleve {
  const ref = reference.trim();
  if (ref.length < 4 || ref.length > 80) throw new Error("La référence factice doit contenir 4 à 80 caractères.");
  if (!contrats.some((c) => c.etablissementId === etablissementId)) throw new Error("Établissement introuvable.");
  const v = { etablissementId, statut: "verse" as const, dateVersement: new Date().toISOString(), reference: ref, operateur };
  versements.set(etablissementId, v); return v;
}

export function ventesPourTests(): VenteFinance[] { return ventes.map((v) => ({ ...v })); }
