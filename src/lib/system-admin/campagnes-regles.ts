// Règles pures L11 : codes promotionnels et campagnes factices.
export const DEFAUTS_CAMPAGNE = {
  plafondMontantGnf: 1_000_000,
  plafondUtilisations: 100,
  dureeJours: 30,
  remisePourcentageMax: 100,
  remiseFixeMaxGnf: 500_000,
} as const;

export type TypeRemise = "pourcentage" | "montant";
export type EtatCampagne = "brouillon" | "active" | "expirée" | "suspendue";
export interface RegleRemise { type: TypeRemise; valeur: number; minimumAchatGnf: number; }
export interface Campagne { id: string; code: string; nom: string; regle: RegleRemise; plafondMontantGnf: number; plafondUtilisations: number; utilisations: number; debut: string; fin: string; etat: EtatCampagne; ciblage: string; }
export type ResultatRemise = { ok: true; remiseGnf: number; totalGnf: number } | { ok: false; erreur: string; action: string };

export function normaliserCode(brut: unknown): string { return String(brut ?? "").normalize("NFKC").trim().toUpperCase().replace(/[\s-]+/g, ""); }
export function validerCode(brut: unknown): { ok: true; code: string } | { ok: false; erreur: string; action: string } {
  const code = normaliserCode(brut);
  if (!code) return { ok: false, erreur: "Code manquant : saisissez un code promotionnel.", action: "Renseignez un code." };
  if (!/^[A-Z0-9]{3,32}$/.test(code)) return { ok: false, erreur: "Code invalide : 3 à 32 lettres ou chiffres, sans accent.", action: "Corrigez le code puis réessayez." };
  return { ok: true, code };
}
export function validerRegle(regle: Partial<RegleRemise>): { ok: true; regle: RegleRemise } | { ok: false; erreur: string; action: string } {
  if (regle.type !== "pourcentage" && regle.type !== "montant") return { ok: false, erreur: "Type de remise invalide.", action: "Choisissez un pourcentage ou un montant fixe." };
  const valeur = Number(regle.valeur); const minimum = Number(regle.minimumAchatGnf ?? 0);
  const max = regle.type === "pourcentage" ? DEFAUTS_CAMPAGNE.remisePourcentageMax : DEFAUTS_CAMPAGNE.remiseFixeMaxGnf;
  if (!Number.isInteger(valeur) || valeur <= 0 || valeur > max) return { ok: false, erreur: `Remise invalide : entier entre 1 et ${max.toLocaleString("fr-FR")} GNF${regle.type === "pourcentage" ? " (pourcentage)" : ""}.`, action: "Corrigez le montant de remise." };
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > 50_000_000) return { ok: false, erreur: "Minimum d'achat invalide : entier GNF entre 0 et 50 000 000.", action: "Corrigez le minimum d'achat." };
  return { ok: true, regle: { type: regle.type, valeur, minimumAchatGnf: minimum } };
}
export function validerPeriode(debut: string, fin: string): { ok: true } | { ok: false; erreur: string; action: string } {
  const d = Date.parse(debut), f = Date.parse(fin);
  if (!Number.isFinite(d) || !Number.isFinite(f) || f <= d) return { ok: false, erreur: "Période invalide : la fin doit être postérieure au début.", action: "Corrigez les dates." };
  return { ok: true };
}
export function etatCalcule(c: Pick<Campagne, "etat" | "fin" | "plafondUtilisations" | "utilisations">, maintenant = new Date()): EtatCampagne {
  if (c.etat === "suspendue" || c.etat === "brouillon") return c.etat;
  if (Date.parse(c.fin) <= maintenant.getTime() || c.utilisations >= c.plafondUtilisations) return "expirée";
  return "active";
}
export function calculerRemise(campagne: Pick<Campagne, "regle" | "etat" | "fin" | "debut" | "plafondMontantGnf" | "plafondUtilisations" | "utilisations">, panierGnf: number, maintenant = new Date()): ResultatRemise {
  if (!Number.isInteger(panierGnf) || panierGnf < 0) return { ok: false, erreur: "Panier invalide : le total doit être un entier GNF.", action: "Rechargez le panier." };
  const etat = etatCalcule(campagne, maintenant);
  if (etat !== "active") return { ok: false, erreur: etat === "expirée" ? "Code expiré ou plafond atteint." : "Code non actif.", action: "Choisissez un autre code." };
  if (maintenant.getTime() < Date.parse(campagne.debut)) return { ok: false, erreur: "Code pas encore valable.", action: "Réessayez pendant la période de validité." };
  if (panierGnf < campagne.regle.minimumAchatGnf) return { ok: false, erreur: `Minimum d'achat non atteint : ${campagne.regle.minimumAchatGnf.toLocaleString("fr-FR")} GNF.`, action: "Ajoutez des articles au panier." };
  const brut = campagne.regle.type === "pourcentage" ? Math.floor(panierGnf * campagne.regle.valeur / 100) : campagne.regle.valeur;
  const remiseGnf = Math.max(0, Math.min(brut, panierGnf, campagne.plafondMontantGnf));
  return { ok: true, remiseGnf, totalGnf: panierGnf - remiseGnf };
}
export function creerEmpreinteCampagne(valeur: unknown): string { const texte = JSON.stringify(valeur); let h = 2166136261; for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, "0"); }
